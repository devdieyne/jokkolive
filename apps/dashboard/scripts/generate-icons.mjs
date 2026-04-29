#!/usr/bin/env node
/**
 * Génère les PNG (favicon, apple-touch-icon, OG image) à partir des SVG sources.
 *
 * Usage : node scripts/generate-icons.mjs
 *
 * Nécessite `sharp` en devDependency.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');

const FAVICON_SVG = await readFile(resolve(PUBLIC, 'favicon.svg'));
const OG_SVG = await readFile(resolve(PUBLIC, 'og-image.svg'));

async function render(svg, size, out, opts = {}) {
  const buf = await sharp(svg, { density: 384 })
    .resize(size.w, size.h, { fit: 'contain', background: opts.bg ?? { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(PUBLIC, out), buf);
  console.log(`  ✓ ${out} (${size.w}×${size.h})`);
}

console.log('→ Génération des icônes JokkoLive…');
await render(FAVICON_SVG, { w: 32, h: 32 }, 'favicon-32.png');
await render(FAVICON_SVG, { w: 180, h: 180 }, 'apple-touch-icon.png');
await render(FAVICON_SVG, { w: 192, h: 192 }, 'favicon-192.png');
await render(FAVICON_SVG, { w: 512, h: 512 }, 'favicon-512.png');
await render(OG_SVG, { w: 1200, h: 630 }, 'og-image.png', { bg: { r: 6, g: 95, b: 70, alpha: 1 } });
console.log('✅ Terminé.');
