// scripts/generate-manifest.js
const fs = require('fs').promises;
const path = require('path');

const ROOT = path.join(__dirname, '..');
const META_DIR = path.join(ROOT, 'meta');
const OUT_FILE = path.join(ROOT, 'docs', 'media.json');

function fixPath(p) {
  if (!p) return '';
  p = String(p).trim();
  // remove leading slashes so paths stay relative for GitHub Pages
  p = p.replace(/^\/+/, '');
  // if path already points into media/, keep it; otherwise prefix
  if (!p.startsWith('media/')) p = `media/${p}`;
  return p;
}

function parseKeyValue(text) {
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^tags?$/i.test(key)) {
      value = value.split(',').map(s => s.trim()).filter(Boolean);
    }
    out[key] = value;
  });
  return out;
}

function normalize(parsed, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const id = String(parsed.id || parsed.id === 0 ? parsed.id : base);
  const srcRaw = parsed.src || parsed.file || parsed.url || '';
  const thumbRaw = parsed.thumb || parsed.thumbnail || `thumbs/${id}.webp`;

  const tags = Array.isArray(parsed.tags) ? parsed.tags : (parsed.tags ? String(parsed.tags).split(',').map(s=>s.trim()).filter(Boolean) : []);

  const type = parsed.type || (/\.(jpe?g|png|gif|webp|avif)$/i.test(srcRaw) ? 'image' : (/\.(mp4|webm|mov|mkv)$/i.test(srcRaw) ? 'video' : (parsed.type || 'video')));

  return {
    id: id,
    title: parsed.title || parsed.name || `Item ${id}`,
    type,
    src: fixPath(srcRaw),
    thumb: fixPath(thumbRaw),
    description: parsed.description || parsed.desc || '',
    tags
  };
}

(async () => {
  try {
    await fs.mkdir(path.join(ROOT, 'docs'), { recursive: true });
    const files = await fs.readdir(META_DIR).catch(()=>[]);
    const items = [];

    for (const f of files) {
      if (!/\.(json|txt|md)$/i.test(f)) continue;
      const full = path.join(META_DIR, f);
      const raw = await fs.readFile(full, 'utf8').catch(()=>null);
      if (!raw) continue;

      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        parsed = parseKeyValue(raw);
      }

      const norm = normalize(parsed, f);
      items.push(norm);
    }

    // optional: sort by id (string numeric aware)
    items.sort((a,b) => {
      const na = Number(a.id), nb = Number(b.id);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.id.localeCompare(b.id);
    });

    await fs.writeFile(OUT_FILE, JSON.stringify(items, null, 2), 'utf8');
    console.log(`Wrote manifest to ${OUT_FILE} (${items.length} items)`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();