#!/usr/bin/env node
/**
 * Builds src/routes/tensors/macaw.ts: a small colour photograph, stored as the
 * height × width × channel block of 8-bit numbers the page slices and reshapes.
 *
 *   node scripts/data/tensors/build.mjs <cache dir>
 *
 * 1. Fetch. "Scarlet Macaw (Ara macao) at Combe Martin Wildlife and Dinosaur Park, North Devon,
 *    England", photograph by Adrian Pingstone, released into the public domain:
 *    https://commons.wikimedia.org/wiki/File:Parrot.red.macaw.1.arp.750pix.jpg (750 × 1002 JPEG).
 *    The download is cached in the given directory (outside the repository).
 * 2. Reduce. ImageMagick (a system tool, not an npm dependency) strips the metadata, keeps sRGB,
 *    averages each block of source pixels (box filter) down to 36 × 48 and writes the raw 8-bit
 *    RGB bytes, which are already in row-major height × width × channel order:
 *      magick macaw.jpg -strip -colorspace sRGB -filter Box -resize 36x48! -depth 8 rgb:-
 *    The source's aspect ratio (0.749) is within 0.2 % of 36 : 48.
 * 3. Write. The 5184 bytes as base64, with the shape.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const URL = 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Parrot.red.macaw.1.arp.750pix.jpg';
const OUT = path.resolve(import.meta.dirname, '../../../src/routes/tensors/macaw.ts');
const W = 36;
const H = 48;

const cache = process.argv[2];
if (!cache) {
	console.error('usage: node scripts/data/tensors/build.mjs <cache dir>');
	process.exit(1);
}
fs.mkdirSync(cache, { recursive: true });
const file = path.join(cache, 'Parrot.red.macaw.1.arp.750pix.jpg');
if (!fs.existsSync(file)) {
	const res = await fetch(URL, { headers: { 'User-Agent': 'how-things-work data build' } });
	if (!res.ok) throw new Error(`${URL}: ${res.status}`);
	fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
const raw = execFileSync('magick', [
	file,
	'-strip',
	'-colorspace',
	'sRGB',
	'-filter',
	'Box',
	'-resize',
	`${W}x${H}!`,
	'-depth',
	'8',
	'rgb:-'
]);
if (raw.length !== W * H * 3) throw new Error(`expected ${W * H * 3} bytes, got ${raw.length}`);
const b64 = raw.toString('base64');
const lines = b64.match(/.{1,96}/g) ?? [];
fs.writeFileSync(
	OUT,
	`/**
 * A colour photograph as a height × width × channel block: ${H} × ${W} pixels × 3 channels (red,
 * green, blue), 8-bit sRGB values 0–255, stored row-major (the channel index changes fastest,
 * then the column, then the row) and base64-encoded.
 *
 * Source: "Scarlet Macaw (Ara macao) at Combe Martin Wildlife and Dinosaur Park, North Devon,
 * England", photograph by Adrian Pingstone, public domain.
 * https://commons.wikimedia.org/wiki/File:Parrot.red.macaw.1.arp.750pix.jpg
 *
 * Reduced from the 750 × 1002 JPEG by scripts/data/tensors/build.mjs (box-filter average down to
 * ${W} × ${H}, ImageMagick). Generated file: do not edit.
 */
export const MACAW_HEIGHT = ${H};
export const MACAW_WIDTH = ${W};
export const MACAW_RGB_BASE64 =
${lines.map((l, i) => `\t'${l}'${i < lines.length - 1 ? ' +' : ';'}`).join('\n')}
`
);
console.log(`wrote ${OUT}: ${raw.length} bytes; first pixel`, [...raw.subarray(0, 3)]);
