#!/usr/bin/env node
/**
 * Builds `src/routes/ecg-arrhythmias/records-data.ts`: short excerpts of real, annotated ECG
 * recordings from the MIT-BIH Arrhythmia Database (Moody & Mark 2001; Goldberger et al. 2000,
 * PhysioNet), https://physionet.org/content/mitdb/1.0.0/ , licensed under the Open Data Commons
 * Attribution License v1.0.
 *
 * For each excerpt it reads the record's header (`.hea`) and reference annotations (`.atr`, MIT
 * annotation format), then fetches only the bytes of the signal file (`.dat`, format 212: two
 * 12-bit two's-complement samples per three bytes, the two signals interleaved) that cover the
 * window, with an HTTP Range request. It keeps the first signal (MLII, a modified limb lead II),
 * converts it to millivolts with the header's gain and baseline, averages it down from 360 to
 * 120 samples a second, and keeps the beat and rhythm annotations inside the window.
 *
 *   node scripts/data/ecg-arrhythmias/build-records.mjs            # writes the data file
 *   node scripts/data/ecg-arrhythmias/build-records.mjs --list 231 # lists a record's rhythm runs
 *
 * Formats: https://physionet.org/physiotools/wag/signal-5.htm (format 212) and
 * https://physionet.org/physiotools/wag/annot-5.htm (MIT annotation format); annotation codes
 * from the WFDB library's ecgcodes.h.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://physionet.org/files/mitdb/1.0.0/';
const OUT = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../src/routes/ecg-arrhythmias/records-data.ts'
);
const FS = 360;
const DOWN = 3; // 360 → 120 samples per second

/**
 * The excerpts: record, start (seconds into the record), length (seconds) and what it shows.
 * Starts were chosen with `--list` from the reference annotations.
 */
const EXCERPTS = [
	{ id: 'sinus', record: '100', start: 0, length: 8, title: 'Normal sinus rhythm' },
	{ id: 'pvc', record: '119', start: 21.5, length: 8, title: 'Ventricular premature beats' },
	{ id: 'block', record: '231', start: 98, length: 8, title: '2:1 AV block' },
	{ id: 'vt', record: '205', start: 1464, length: 8, title: 'Ventricular tachycardia' },
	{ id: 'vfl', record: '207', start: 247, length: 8, title: 'Ventricular flutter' }
];

/** Beat codes (ecgcodes.h) → symbol; the rest of the beat-like codes are kept as 'Q'. */
const SYMBOL = {
	1: 'N',
	2: 'L',
	3: 'R',
	4: 'a',
	5: 'V',
	6: 'F',
	7: 'J',
	8: 'A',
	9: 'S',
	10: 'E',
	11: 'j',
	12: '/',
	13: 'Q',
	14: '~',
	24: 'p',
	28: '+',
	31: '!',
	32: '[',
	33: ']',
	34: 'e',
	35: 'n',
	37: 'x',
	38: 'f',
	41: 'r'
};

async function get(url, range) {
	const res = await fetch(
		url,
		range ? { headers: { Range: `bytes=${range[0]}-${range[1]}` } } : {}
	);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	if (range && res.status !== 206) throw new Error(`${url}: range not honoured`);
	return Buffer.from(await res.arrayBuffer());
}

function header(text) {
	const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
	const [, nsig, fs] = lines[0].split(/\s+/);
	const signals = lines.slice(1, 1 + Number(nsig)).map((l) => {
		const f = l.split(/\s+/);
		return { format: f[1], gain: Number(f[2]), baseline: Number(f[4]), name: f[8] };
	});
	return { fs: Number(fs), signals };
}

/** MIT-format annotations: [{ sample, code, aux }]. */
function annotations(buf) {
	const out = [];
	let t = 0;
	let i = 0;
	while (i + 1 < buf.length) {
		const word = buf[i] | (buf[i + 1] << 8);
		i += 2;
		const A = word >> 10;
		const I = word & 0x3ff;
		if (A === 0 && I === 0) break;
		if (A === 59) {
			// SKIP: a PDP-11 long, high 16 bits first, low byte first in each pair
			const hi = buf[i] | (buf[i + 1] << 8);
			const lo = buf[i + 2] | (buf[i + 3] << 8);
			t += ((hi << 16) | lo) >> 0;
			i += 4;
		} else if (A === 63) {
			const aux = buf
				.subarray(i, i + I)
				.toString('latin1')
				.replace(/\0+$/, '');
			if (out.length) out[out.length - 1].aux = aux;
			i += I + (I % 2);
		} else if (A === 60 || A === 61 || A === 62) {
			// NUM, SUB, CHN: not needed
		} else {
			t += I;
			out.push({ sample: t, code: A, aux: '' });
		}
	}
	return out;
}

/** Signal 0 of a two-signal format-212 record, samples [from, to). */
async function signal0(record, from, to) {
	const bytes = await get(`${BASE}${record}.dat`, [from * 3, to * 3 - 1]);
	const out = new Int16Array(to - from);
	for (let k = 0; k < out.length; k++) {
		const b0 = bytes[3 * k];
		const b1 = bytes[3 * k + 1];
		let s = b0 | ((b1 & 0x0f) << 8);
		if (s & 0x800) s -= 0x1000;
		out[k] = s;
	}
	return out;
}

async function list(record) {
	const ann = annotations(await get(`${BASE}${record}.atr`));
	for (const a of ann) {
		if (a.code === 28 || a.code === 32 || a.code === 33)
			console.log((a.sample / FS).toFixed(1).padStart(8), SYMBOL[a.code], a.aux);
	}
	const counts = {};
	for (const a of ann)
		counts[SYMBOL[a.code] ?? a.code] = (counts[SYMBOL[a.code] ?? a.code] ?? 0) + 1;
	console.log(counts);
}

async function build() {
	const rows = [];
	for (const ex of EXCERPTS) {
		const h = header((await get(`${BASE}${ex.record}.hea`)).toString('latin1'));
		if (h.fs !== FS || h.signals[0].format !== '212' || h.signals[0].name !== 'MLII')
			throw new Error(`${ex.record}: unexpected header`);
		const { gain, baseline } = h.signals[0];
		const from = Math.round(ex.start * FS);
		const to = from + Math.round(ex.length * FS);
		const raw = await signal0(ex.record, from, to);
		const mv = [];
		for (let k = 0; k + DOWN <= raw.length; k += DOWN) {
			let s = 0;
			for (let j = 0; j < DOWN; j++) s += raw[k + j];
			mv.push(Math.round(((s / DOWN - baseline) / gain) * 1000) / 1000);
		}
		const ann = annotations(await get(`${BASE}${ex.record}.atr`));
		// the rhythm in force at the window's start, then everything inside it
		let rhythm = '';
		for (const a of ann) if (a.code === 28 && a.sample <= from) rhythm = a.aux;
		const marks = ann
			.filter((a) => a.sample >= from && a.sample < to && SYMBOL[a.code])
			.map((a) => ({
				t: Math.round(((a.sample - from) / FS) * 1000) / 1000,
				s: SYMBOL[a.code],
				...(a.aux ? { aux: a.aux } : {})
			}));
		rows.push({ ...ex, rhythm, fs: FS / DOWN, mv, marks });
		console.log(ex.id, ex.record, rhythm, marks.length, 'marks', mv.length, 'samples');
	}
	const body = rows
		.map(
			(r) => `\t{
		id: ${JSON.stringify(r.id)},
		record: ${JSON.stringify(r.record)},
		title: ${JSON.stringify(r.title)},
		start: ${r.start},
		rhythm: ${JSON.stringify(r.rhythm)},
		fs: ${r.fs},
		mv: [${r.mv.join(', ')}],
		marks: ${JSON.stringify(r.marks)}
	}`
		)
		.join(',\n');
	writeFileSync(
		OUT,
		`/**
 * Excerpts of real ECG recordings from the MIT-BIH Arrhythmia Database (Moody GB, Mark RG. The
 * impact of the MIT-BIH Arrhythmia Database. IEEE Eng in Med and Biol 20(3):45-50, 2001;
 * Goldberger AL et al., PhysioBank, PhysioToolkit, and PhysioNet, Circulation 101(23):e215-e220,
 * 2000), https://physionet.org/content/mitdb/1.0.0/ , Open Data Commons Attribution License
 * v1.0. Built by scripts/data/ecg-arrhythmias/build-records.mjs: the first signal (MLII, a
 * modified limb lead II) in millivolts, averaged from 360 to 120 samples a second, and the
 * database's reference annotations inside each window (t in seconds from the excerpt's start;
 * s the annotation symbol: N normal, V ventricular premature, ! flutter wave, + rhythm change
 * with its label in aux, [ and ] the start and end of flutter or fibrillation, ...).
 * Generated file: do not edit by hand.
 */
export interface RecordMark {
	t: number;
	s: string;
	aux?: string;
}
export interface EcgRecord {
	id: string;
	record: string;
	title: string;
	/** Seconds into the 30-minute record. */
	start: number;
	/** The rhythm label in force at the excerpt's start. */
	rhythm: string;
	/** Samples per second. */
	fs: number;
	mv: number[];
	marks: RecordMark[];
}

export const RECORDS: EcgRecord[] = [
${body}
];
`
	);
	console.log('wrote', OUT);
}

if (process.argv[2] === '--list') await list(process.argv[3]);
else await build();
