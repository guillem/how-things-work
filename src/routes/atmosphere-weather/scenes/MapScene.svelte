<script lang="ts">
	/**
	 * A weather map, 3000 km wide, with high- and low-pressure systems the
	 * reader places, moves and strengthens.
	 *
	 * Phases (`step.hints.phase`):
	 *   pressure — isobars every 4 hPa, the wind near the ground as arrows and
	 *              moving streaks (crossing the isobars in towards the lows),
	 *              hemisphere switch (45° N or 45° S)
	 *   fronts   — the air's temperature, carried round by the winds aloft for
	 *              36 hours (`advectedTemperature`), with isotherms and the
	 *              fronts that form where the contrast is sharpest
	 *
	 * State: the systems of each step live in `params['map:' + step.id]` as
	 * "L,x,y,dp,r;H,x,y,dp,r" (km and hPa, whole numbers, dp unsigned); a missing
	 * value means the step's defaults, '-' an empty map. "Add a low/high" add one
	 * at the free-est spot (at most four), "Clear the map" empties it. The action
	 * counts are shared by both steps, so the scene applies the difference since
	 * the last counts it saw.
	 *
	 * Temperature (fronts): frames every 3 h are computed lazily (≈3 ms each)
	 * and cached until the systems change. Each frame is drawn as two small
	 * greyscale images used as luminance masks over a warm and a cold rectangle
	 * (the colours stay theme variables, the browser smooths the 48 × 32 grid),
	 * and consecutive frames are cross-faded by t. The clock restarts when the
	 * reader changes the map (`t0`, set in event handlers), so new fronts can be
	 * watched forming. Isotherms and fronts come from marching squares on the
	 * interpolated grid, every frame (cheap).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, cycle, hash, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { advectedTemperature, pressure, wind, type System } from '../atmosphere';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- map geometry ------------------------------------------------------------------
	const MX0 = 16;
	const MY0 = 16;
	const MW = 928;
	const MH = 568;
	const K = MW / 3000; // px per km
	const XMAX = 1500; // km
	const YMAX = MH / 2 / K; // ≈ 918 km
	const PX = (x: number) => MX0 + (x + XMAX) * K;
	const PY = (y: number) => MY0 + (YMAX - y) * K;
	const KX = (px: number) => (px - MX0) / K - XMAX;
	const KY = (py: number) => YMAX - (py - MY0) / K;

	// Legend card (top left, over the map).
	const CX = 28;
	const CY = 28;
	const CW = 262;

	// ---- phase -------------------------------------------------------------------------
	const phase = $derived(step.hints?.phase === 'fronts' ? 'fronts' : 'pressure');
	const fronts = $derived(phase === 'fronts');
	const fw = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = fronts ? 1 : 0;
		untrack(() => fw.set(v, { duration: reduced ? 0 : 700 }));
	});
	const south = $derived(!fronts && params.hemisphere === 'south');
	const lat = $derived(south ? -45 : 45);

	// ---- systems -----------------------------------------------------------------------
	const DEFAULTS: Record<string, System[]> = {
		pressure: [
			{ kind: 'low', x: -600, y: 60, dp: -20, r: 450 },
			{ kind: 'high', x: 700, y: -60, dp: 20, r: 600 }
		],
		// A moderate low: in 36 hours it winds up one warm and one cold front.
		fronts: [{ kind: 'low', x: 0, y: 0, dp: -15, r: 500 }]
	};
	const MAX_SYSTEMS = 4;
	const R_MIN = 250;
	const R_MAX = 800;
	const DP_MIN = 5;
	const DP_MAX = 35;

	const key = $derived('map:' + step.id);
	const raw = $derived(typeof params[key] === 'string' ? (params[key] as string) : null);

	function parse(s: string | null, fallback: System[]): System[] {
		if (s === null) return fallback;
		const out: System[] = [];
		for (const item of s.split(';')) {
			const [k, ...nums] = item.split(',');
			const [x, y, dp, r] = nums.map(Number);
			if ((k !== 'L' && k !== 'H') || ![x, y, dp, r].every(Number.isFinite)) continue;
			const low = k === 'L';
			out.push({
				kind: low ? 'low' : 'high',
				x,
				y,
				dp: (low ? -1 : 1) * clamp(Math.abs(dp), DP_MIN, DP_MAX),
				r: clamp(r, R_MIN, R_MAX)
			});
		}
		return out.slice(0, MAX_SYSTEMS);
	}
	const encode = (list: System[]) =>
		list.length === 0
			? '-'
			: list
					.map(
						(s) =>
							`${s.kind === 'low' ? 'L' : 'H'},${Math.round(s.x)},${Math.round(s.y)},${Math.round(Math.abs(s.dp))},${Math.round(s.r)}`
					)
					.join(';');

	const systems = $derived(parse(raw, DEFAULTS[phase]));

	// The fronts clock restarts whenever the reader changes the map.
	let t0 = $state(0);
	$effect(() => {
		void step.id;
		untrack(() => (t0 = 0));
	});
	function write(list: System[]) {
		// Reading t here is fine: write() runs in event handlers, or untracked in
		// the action effect, never as a dependency.
		t0 = t;
		setParam(key, encode(list));
	}

	// Free spots for new systems, away from the legend card.
	const SPOTS: Point[] = [];
	for (const y of [450, 0, -450])
		for (const x of [-1000, -500, 0, 500, 1000])
			if (!(x <= -1000 && y >= 450)) SPOTS.push({ x, y });
	function add(kind: 'low' | 'high', list: System[]): System[] {
		if (list.length >= MAX_SYSTEMS) return list;
		let best = SPOTS[0];
		let bestD = -1;
		for (const p of SPOTS) {
			const d = Math.min(1e9, ...list.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
			if (d > bestD + 1) {
				best = p;
				bestD = d;
			}
		}
		return [
			...list,
			kind === 'low'
				? { kind, x: best.x, y: best.y, dp: fronts ? -15 : -20, r: 450 }
				: { kind, x: best.x, y: best.y, dp: 20, r: 600 }
		];
	}

	// Action buttons: apply the presses since the last counts seen (the counts
	// are shared by both steps, and several presses can arrive at once).
	const count = (id: string) => Number(params[id] ?? 0);
	const counts = $derived({
		low: count('addLow'),
		high: count('addHigh'),
		clear: count('clearMap')
	});
	let seen: { low: number; high: number; clear: number } | null = null;
	$effect(() => {
		const c = counts;
		untrack(() => {
			if (!seen) {
				seen = { ...c };
				return;
			}
			let list = systems;
			let changed = false;
			if (c.clear > seen.clear) {
				list = [];
				changed = true;
			}
			for (let k = seen.low; k < c.low; k++) {
				list = add('low', list);
				changed = true;
			}
			for (let k = seen.high; k < c.high; k++) {
				list = add('high', list);
				changed = true;
			}
			seen = { ...c };
			if (changed) write(list);
		});
	});

	// ---- interaction -------------------------------------------------------------------
	let grab: { dx: number; dy: number } | null = null;
	// Centres stay far enough inside the map for their letter and labels, and
	// out from under the legend card.
	function keepIn(x: number, y: number): Point {
		let px = clamp(PX(x), MX0 + 80, MX0 + MW - 80);
		let py = clamp(PY(y), MY0 + 50, MY0 + MH - 58);
		const right = CX + CW + 30;
		const below = CY + 150 + 46;
		if (px < right && py < below) {
			if (right - px < below - py) px = right;
			else py = below;
		}
		return { x: KX(px), y: KY(py) };
	}
	function place(i: number, x: number, y: number) {
		const p = keepIn(x, y);
		write(systems.map((s, j) => (j === i ? { ...s, x: p.x, y: p.y } : s)));
	}
	function moveCentre(i: number, p: Point) {
		const s = systems[i];
		if (!s) return;
		if (!grab) grab = { dx: PX(s.x) - p.x, dy: PY(s.y) - p.y };
		place(i, KX(p.x + grab.dx), KY(p.y + grab.dy));
	}
	// Handle reports ±1 for both axes: remember which arrow key it was.
	let lastKey = '';
	function keyCentre(i: number, k: number | 'start' | 'end') {
		const s = systems[i];
		if (!s || typeof k !== 'number') return;
		const d = 25 * k;
		if (lastKey === 'ArrowUp' || lastKey === 'ArrowDown') place(i, s.x, s.y + d);
		else place(i, s.x + d, s.y);
	}
	// Strength and size together: dragging outwards makes the system bigger and
	// stronger in proportion.
	function resize(i: number, r: number) {
		write(
			systems.map((s, j) => {
				if (j !== i) return s;
				const nr = clamp(r, R_MIN, R_MAX);
				const mag = clamp((Math.abs(s.dp) * nr) / s.r, DP_MIN, DP_MAX);
				return { ...s, r: nr, dp: Math.sign(s.dp) * mag };
			})
		);
	}
	function moveEdge(i: number, p: Point) {
		const s = systems[i];
		if (s) resize(i, Math.hypot(p.x - PX(s.x), p.y - PY(s.y)) / K);
	}
	function keyEdge(i: number, k: number | 'start' | 'end') {
		const s = systems[i];
		if (!s) return;
		if (k === 'start') resize(i, R_MIN);
		else if (k === 'end') resize(i, R_MAX);
		else resize(i, s.r + 10 * k);
	}
	// Edge handle on the first diagonal that stays inside the map.
	const DIAG = [
		[1, -1],
		[-1, -1],
		[1, 1],
		[-1, 1]
	].map(([a, b]) => [a / Math.SQRT2, b / Math.SQRT2]);
	function edgeOf(s: System): Point {
		const cx = PX(s.x);
		const cy = PY(s.y);
		const rp = s.r * K;
		for (const [a, b] of DIAG) {
			const x = cx + a * rp;
			const y = cy + b * rp;
			const inside = x > MX0 + 12 && x < MX0 + MW - 12 && y > MY0 + 12 && y < MY0 + MH - 12;
			const underCard = x < CX + CW + 12 && y < CY + 160; // hidden behind the legend
			if (inside && !underCard) return { x, y };
		}
		return { x: cx + DIAG[0][0] * rp, y: cy + DIAG[0][1] * rp };
	}

	const markers = $derived(
		systems.map((s, i) => ({
			i,
			s,
			x: PX(s.x),
			y: PY(s.y),
			p: Math.round(pressure(systems, s.x, s.y)),
			edge: edgeOf(s),
			color: s.kind === 'low' ? 'var(--atm-low)' : 'var(--atm-high)'
		}))
	);

	// ---- marching squares ----------------------------------------------------------------
	/**
	 * Contour lines of a grid `f` (nx × ny, row-major, row 0 at the top) at
	 * `level`, as flat [x0, y0, x1, y1, …] polylines in grid coordinates,
	 * joined across cells.
	 */
	function contour(f: ArrayLike<number>, nx: number, ny: number, level: number): number[][] {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const pts = new Map<number, [number, number]>();
		const segs: [number, number][] = [];
		const H = (i: number, j: number) => j * nx + i;
		const V = (i: number, j: number) => nx * ny + j * nx + i;
		const cross = (
			id: number,
			x1: number,
			y1: number,
			v1: number,
			x2: number,
			y2: number,
			v2: number
		) => {
			if (!pts.has(id)) {
				const u = (level - v1) / (v2 - v1);
				pts.set(id, [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u]);
			}
			return id;
		};
		for (let j = 0; j < ny - 1; j++)
			for (let i = 0; i < nx - 1; i++) {
				const a = f[j * nx + i];
				const b = f[j * nx + i + 1];
				const c = f[(j + 1) * nx + i + 1];
				const d = f[(j + 1) * nx + i];
				const A = a >= level;
				const B = b >= level;
				const C = c >= level;
				const D = d >= level;
				if (A === B && B === C && C === D) continue;
				const top = A !== B ? cross(H(i, j), i, j, a, i + 1, j, b) : -1;
				const right = B !== C ? cross(V(i + 1, j), i + 1, j, b, i + 1, j + 1, c) : -1;
				const bottom = D !== C ? cross(H(i, j + 1), i, j + 1, d, i + 1, j + 1, c) : -1;
				const left = A !== D ? cross(V(i, j), i, j, a, i, j + 1, d) : -1;
				const e = [top, right, bottom, left].filter((v) => v >= 0);
				if (e.length === 2) segs.push([e[0], e[1]]);
				else if (e.length === 4) {
					// Saddle: the centre decides which corners are connected.
					if ((a + b + c + d) / 4 >= level === A) segs.push([top, right], [bottom, left]);
					else segs.push([left, top], [right, bottom]);
				}
			}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const at = new Map<number, number[]>();
		segs.forEach(([p, q], s) => {
			for (const id of [p, q]) {
				const l = at.get(id);
				if (l) l.push(s);
				else at.set(id, [s]);
			}
		});
		const used = new Uint8Array(segs.length);
		const lines: number[][] = [];
		const walk = (s0: number, from: number) => {
			const line: number[] = [...pts.get(from)!];
			let s = s0;
			let e = from;
			while (s >= 0 && !used[s]) {
				used[s] = 1;
				const [p, q] = segs[s];
				e = p === e ? q : p;
				line.push(...pts.get(e)!);
				s = (at.get(e) ?? []).find((n) => !used[n]) ?? -1;
			}
			lines.push(line);
		};
		// Open lines (ending at the border) first, then closed loops.
		for (const [id, l] of at) if (l.length === 1 && !used[l[0]]) walk(l[0], id);
		for (let s = 0; s < segs.length; s++) if (!used[s]) walk(s, segs[s][0]);
		return lines;
	}
	const toPath = (lines: number[][], fx: (g: number) => number, fy: (g: number) => number) =>
		lines
			.map((l) => {
				let d = '';
				for (let k = 0; k < l.length; k += 2)
					d += `${k ? 'L' : 'M'}${fx(l[k]).toFixed(1)} ${fy(l[k + 1]).toFixed(1)}`;
				return d;
			})
			.join('');

	// ---- isobars -------------------------------------------------------------------------
	const PNX = 61;
	const PNY = 41;
	const pgx = (g: number) => MX0 + (g * MW) / (PNX - 1);
	const pgy = (g: number) => MY0 + (g * MH) / (PNY - 1);
	const isobars = $derived.by(() => {
		const f = new Float64Array(PNX * PNY);
		let lo = Infinity;
		let hi = -Infinity;
		for (let j = 0; j < PNY; j++)
			for (let i = 0; i < PNX; i++) {
				const v = pressure(systems, KX(pgx(i)), KY(pgy(j)));
				f[j * PNX + i] = v;
				lo = Math.min(lo, v);
				hi = Math.max(hi, v);
			}
		const out: { level: number; d: string; lines: number[][] }[] = [];
		for (let level = Math.ceil(lo / 4) * 4; level <= hi; level += 4) {
			const lines = contour(f, PNX, PNY, level);
			if (lines.length) out.push({ level, lines, d: toPath(lines, pgx, pgy) });
		}
		return out;
	});
	// A few labels, one per level, away from the markers, the card and each other.
	const isobarLabels = $derived.by(() => {
		const placed: { x: number; y: number; level: number }[] = [];
		const ok = (x: number, y: number) =>
			x > MX0 + 30 &&
			x < MX0 + MW - 30 &&
			y > MY0 + 16 &&
			y < MY0 + MH - 12 &&
			!(x < CX + CW + 24 && y < CY + 150) &&
			// clear of each letter, its pressure and its 'rising air…' label, and its edge handle
			markers.every(
				(m) =>
					(Math.abs(m.x - x) > 84 || y < m.y - 56 || y > m.y + 60) &&
					Math.hypot(m.edge.x - x, m.edge.y - y) > 24
			) &&
			placed.every((p) => Math.hypot(p.x - x, p.y - y) > 90);
		for (const iso of isobars) {
			if (placed.length >= 7) break;
			let done = false;
			for (const l of iso.lines) {
				for (let k = 0; k < l.length && !done; k += 8) {
					const x = pgx(l[k]);
					const y = pgy(l[k + 1]);
					if (ok(x, y)) {
						placed.push({ x, y, level: iso.level });
						done = true;
					}
				}
				if (done) break;
			}
		}
		return placed;
	});

	// ---- wind: arrows and streaks -------------------------------------------------------
	// Near the ground on the pressure step; aloft (the wind that carries the
	// temperature) on the fronts step.
	const surface = $derived(!fronts);
	const arrows = $derived.by(() => {
		let d = '';
		const nx = 16;
		const ny = 10;
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const px = MX0 + ((i + 0.5) * MW) / nx;
				const py = MY0 + ((j + 0.5) * MH) / ny;
				if (px < CX + CW + 10 && py < CY + 150) continue;
				// Keep the letters and their labels clear.
				if (systems.some((s) => Math.abs(PX(s.x) - px) < 80 && Math.abs(PY(s.y) - py) < 54))
					continue;
				const [u, v] = wind(systems, KX(px), KY(py), lat, surface);
				const sp = Math.hypot(u, v);
				if (sp < 2) continue;
				const len = Math.min(30, 6 + sp * 1.1);
				const ux = u / sp;
				const uy = -v / sp;
				const x1 = px - (ux * len) / 2;
				const y1 = py - (uy * len) / 2;
				const x2 = px + (ux * len) / 2;
				const y2 = py + (uy * len) / 2;
				const h = 5;
				d +=
					`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}` +
					`M${(x2 - h * ux + h * 0.6 * uy).toFixed(1)} ${(y2 - h * uy - h * 0.6 * ux).toFixed(1)}` +
					`L${x2.toFixed(1)} ${y2.toFixed(1)}` +
					`L${(x2 - h * ux - h * 0.6 * uy).toFixed(1)} ${(y2 - h * uy + h * 0.6 * ux).toFixed(1)}`;
			}
		return d;
	});

	// Streaks: short streamlines from jittered seeds, each 6 hours of wind long;
	// a dash runs along each (pathLength 100), so it covers more ground where the
	// wind is faster.
	const STREAK_COLS = 12;
	const STREAK_ROWS = 7;
	const streaks = $derived.by(() => {
		const out: { id: number; d: string; period: number; offset: number }[] = [];
		for (let j = 0; j < STREAK_ROWS; j++)
			for (let i = 0; i < STREAK_COLS; i++) {
				const id = j * STREAK_COLS + i;
				let x = KX(MX0 + ((i + 0.15 + 0.7 * hash(id, 1)) * MW) / STREAK_COLS);
				let y = KY(MY0 + ((j + 0.15 + 0.7 * hash(id, 2)) * MH) / STREAK_ROWS);
				let d = `M${PX(x).toFixed(1)} ${PY(y).toFixed(1)}`;
				let travelled = 0;
				const dt = 900; // s
				for (let k = 0; k < 24; k++) {
					const [u1, v1] = wind(systems, x, y, lat, surface);
					const [u2, v2] = wind(systems, x + (u1 * dt) / 2000, y + (v1 * dt) / 2000, lat, surface);
					const nx = x + (u2 * dt) / 1000;
					const ny = y + (v2 * dt) / 1000;
					travelled += Math.hypot(nx - x, ny - y);
					x = nx;
					y = ny;
					if (Math.abs(x) > XMAX || Math.abs(y) > YMAX) break;
					// Stop short of the markers, so no streak crosses a letter or label.
					if (systems.some((s) => Math.hypot(x - s.x, y - s.y) * K < 58)) break;
					d += `L${PX(x).toFixed(1)} ${PY(y).toFixed(1)}`;
				}
				if (travelled * K < 30) continue; // calm: nothing to show
				out.push({ id, d, period: 3.2 + 0.8 * hash(id, 3), offset: hash(id, 4) });
			}
		return out;
	});
	const streakFrame = $derived(
		streaks.map((s) => {
			const u = cycle(t, s.period, s.offset);
			return {
				id: s.id,
				d: s.d,
				// dash [u·116 − 16, u·116] along the 100-unit path
				dash: 16 - u * 116,
				o: smoothstep(0, 0.15, u) * (1 - smoothstep(0.8, 1, u))
			};
		})
	);

	// ---- temperature (fronts) ------------------------------------------------------------
	const TNX = 48;
	const TNY = 32;
	const tgx = (g: number) => MX0 + ((g + 0.5) * MW) / TNX;
	const tgy = (g: number) => MY0 + ((g + 0.5) * MH) / TNY;
	const T_MID = 12; // °C, the initial temperature along the middle of the map
	const T_SPAN = 14;
	const HOURS = 36; // then held: much later the spiral winds into many thin arms
	const STEP_H = 3;
	const PLAY = 13; // seconds for the 36 hours

	interface Frame {
		T: Float64Array;
		warm: string;
		cold: string;
	}
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	let cache = new Map<number, Frame>();
	let cacheKey = '';
	let canvas: HTMLCanvasElement | null = null;
	let big: HTMLCanvasElement | null = null;
	const UP = 4; // mask images are drawn at 4× the grid
	function maskURL(T: Float64Array, sign: 1 | -1) {
		if (typeof document === 'undefined') return '';
		canvas ??= document.createElement('canvas');
		canvas.width = TNX;
		canvas.height = TNY;
		big ??= document.createElement('canvas');
		big.width = TNX * UP;
		big.height = TNY * UP;
		const ctx = canvas.getContext('2d');
		const out = big.getContext('2d');
		if (!out) return '';
		if (!ctx) return '';
		const img = ctx.createImageData(TNX, TNY);
		for (let k = 0; k < T.length; k++) {
			const v = Math.round(255 * clamp((sign * (T[k] - T_MID)) / T_SPAN));
			img.data[4 * k] = v;
			img.data[4 * k + 1] = v;
			img.data[4 * k + 2] = v;
			img.data[4 * k + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
		// Upscale with a blur of about one grid cell, so a front sharper than the
		// grid shows as a smooth line rather than the staircase of bilinear scaling.
		// The unblurred copy underneath keeps the borders from fading.
		out.imageSmoothingEnabled = true;
		out.filter = 'none';
		out.drawImage(canvas, 0, 0, big.width, big.height);
		out.filter = `blur(${UP * 0.8}px)`;
		out.drawImage(canvas, 0, 0, big.width, big.height);
		return big.toDataURL();
	}
	function frame(list: System[], k: number): Frame {
		const ck = encode(list);
		if (ck !== cacheKey) {
			cache = new Map();
			cacheKey = ck;
		}
		const hit = cache.get(k);
		if (hit) return hit;
		const T = new Float64Array(TNX * TNY);
		for (let j = 0; j < TNY; j++)
			for (let i = 0; i < TNX; i++)
				T[j * TNX + i] = advectedTemperature(list, KX(tgx(i)), KY(tgy(j)), k * STEP_H, 45);
		const f = { T, warm: maskURL(T, 1), cold: maskURL(T, -1) };
		cache.set(k, f);
		return f;
	}

	const hours = $derived(
		reduced ? HOURS : clamp(((t >= t0 ? t - t0 : t) / PLAY) * HOURS, 0, HOURS)
	);
	const temp = $derived.by(() => {
		if (!fronts) return null;
		const k0 = Math.min(HOURS / STEP_H - 1, Math.floor(hours / STEP_H));
		const f = clamp(hours / STEP_H - k0);
		const a = frame(systems, k0);
		const b = frame(systems, k0 + 1);
		const T = new Float64Array(TNX * TNY);
		for (let n = 0; n < T.length; n++) T[n] = a.T[n] + (b.T[n] - a.T[n]) * f;
		return { a, b, f, T };
	});

	const isotherms = $derived.by(() => {
		if (!temp) return '';
		let d = '';
		for (let level = 0; level <= 24; level += 4)
			if (level !== T_MID) d += toPath(contour(temp.T, TNX, TNY, level), tgx, tgy);
		return d;
	});

	// Fronts: the middle isotherm where the temperature changes faster than
	// GRAD_MIN. Cold front where the wind blows across it from the cold side to
	// the warm side (cold air advancing), warm front the other way.
	const GRAD_MIN = 4.5; // °C per 100 km
	const DKX = MW / TNX / K; // km between grid points
	const DKY = MH / TNY / K;
	interface FrontRun {
		kind: 'cold' | 'warm';
		pts: { x: number; y: number; nx: number; ny: number }[];
	}
	const frontRuns = $derived.by(() => {
		if (!temp || hours < 1) return [] as FrontRun[];
		const T = temp.T;
		const at = (i: number, j: number) => T[clamp(j, 0, TNY - 1) * TNX + clamp(i, 0, TNX - 1)];
		// Gradient (°C per 100 km; x east, y north) at grid coordinates, bilinear.
		const grad = (gx: number, gy: number) => {
			const i = Math.floor(gx);
			const j = Math.floor(gy);
			const fx = gx - i;
			const fy = gy - j;
			let ex = 0;
			let ey = 0;
			for (const [di, dj, w] of [
				[0, 0, (1 - fx) * (1 - fy)],
				[1, 0, fx * (1 - fy)],
				[0, 1, (1 - fx) * fy],
				[1, 1, fx * fy]
			]) {
				const ii = i + di;
				const jj = j + dj;
				ex += (w * (at(ii + 1, jj) - at(ii - 1, jj))) / (2 * DKX);
				ey += (w * (at(ii, jj - 1) - at(ii, jj + 1))) / (2 * DKY); // row 0 is north
			}
			return [ex * 100, ey * 100];
		};
		const runs: FrontRun[] = [];
		for (const line of contour(T, TNX, TNY, T_MID)) {
			let cur: FrontRun | null = null;
			for (let k = 0; k < line.length; k += 2) {
				const [ex, ey] = grad(line[k], line[k + 1]);
				const g = Math.hypot(ex, ey);
				const x = tgx(line[k]);
				const y = tgy(line[k + 1]);
				let kind: 'cold' | 'warm' | null = null;
				let nx = 0;
				let ny = 0;
				// Not in the tightly wound middle of a system, where the spiral arms
				// are finer than the grid.
				const kx = KX(x);
				const ky = KY(y);
				const core = systems.some((s) => Math.hypot(kx - s.x, ky - s.y) < 0.45 * s.r);
				if (g > GRAD_MIN && !core) {
					const [u, v] = wind(systems, KX(x), KY(y), 45, false);
					const across = (u * ex + v * ey) / g; // m/s towards the warm side
					if (Math.abs(across) > 1.5) {
						kind = across > 0 ? 'cold' : 'warm';
						// Direction the front moves, in screen coordinates (y down).
						const s = Math.sign(across);
						nx = (s * ex) / g;
						ny = (-s * ey) / g;
					}
				}
				if (kind && cur && cur.kind === kind) cur.pts.push({ x, y, nx, ny });
				else {
					if (cur) runs.push(cur);
					cur = kind ? { kind, pts: [{ x, y, nx, ny }] } : null;
				}
			}
			if (cur) runs.push(cur);
		}
		return runs.filter((r) => {
			let len = 0;
			for (let k = 1; k < r.pts.length; k++)
				len += Math.hypot(r.pts[k].x - r.pts[k - 1].x, r.pts[k].y - r.pts[k - 1].y);
			return len > 50;
		});
	});
	const frontGfx = $derived.by(() => {
		const out = { cold: { line: '', marks: '' }, warm: { line: '', marks: '' } };
		const SPACING = 34;
		for (const r of frontRuns) {
			const g = out[r.kind];
			g.line += r.pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
			let acc = SPACING / 2;
			for (let k = 1; k < r.pts.length; k++) {
				const p = r.pts[k - 1];
				const q = r.pts[k];
				const seg = Math.hypot(q.x - p.x, q.y - p.y);
				while (seg > 0 && acc <= seg) {
					const u = acc / seg;
					const x = p.x + (q.x - p.x) * u;
					const y = p.y + (q.y - p.y) * u;
					const tx = (q.x - p.x) / seg;
					const ty = (q.y - p.y) / seg;
					// Normal on the side the front moves towards.
					let nx = -ty;
					let ny = tx;
					if (nx * p.nx + ny * p.ny < 0) {
						nx = -nx;
						ny = -ny;
					}
					const w = 7;
					const ax = (x - tx * w).toFixed(1);
					const ay = (y - ty * w).toFixed(1);
					const bx = (x + tx * w).toFixed(1);
					const by = (y + ty * w).toFixed(1);
					if (r.kind === 'cold') {
						g.marks += `M${ax} ${ay}L${(x + nx * 10).toFixed(1)} ${(y + ny * 10).toFixed(1)}L${bx} ${by}Z`;
					} else {
						// Arc from a to b bulging towards n: sweep 1 bulges to the left of a→b
						// in screen coordinates (y down) when (−ty, tx)·n < 0.
						const sweep = -ty * nx + tx * ny > 0 ? 0 : 1;
						g.marks += `M${ax} ${ay}A${w} ${w} 0 0 ${sweep} ${bx} ${by}Z`;
					}
					acc += SPACING;
				}
				acc -= seg;
			}
		}
		return out;
	});

	// ---- readouts ------------------------------------------------------------------------
	const hoursText = $derived(
		hours < 0.5 ? 'Start: warm air south, cold north' : `After ${Math.round(hours)} hours`
	);
	const full = $derived(systems.length >= MAX_SYSTEMS);
	const cardH = $derived((fronts ? 126 : 118) + (full ? 18 : 0));
	const cloud = (x: number, y: number) =>
		`M${x - 15} ${y + 6}a7 7 0 0 1 3 -12a9 9 0 0 1 16 -4a7 7 0 0 1 11 6a6 6 0 0 1 0 10z`;
	const pw = $derived(1 - fw.current);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<clipPath id="map-clip">
			<rect x={MX0} y={MY0} width={MW} height={MH} rx="10" />
		</clipPath>
		{#if temp}
			{#each [['warm', temp.a.warm, temp.b.warm] as const, ['cold', temp.a.cold, temp.b.cold] as const] as [id, a, b] (id)}
				<mask id="map-{id}-mask" maskUnits="userSpaceOnUse" x={MX0} y={MY0} width={MW} height={MH}>
					<image href={a} x={MX0} y={MY0} width={MW} height={MH} preserveAspectRatio="none" />
					<image
						href={b}
						x={MX0}
						y={MY0}
						width={MW}
						height={MH}
						preserveAspectRatio="none"
						opacity={temp.f}
					/>
				</mask>
			{/each}
		{/if}
		<linearGradient id="map-tscale" x1="0" x2="1" y1="0" y2="0">
			<stop offset="0" style:stop-color="var(--atm-cold)" />
			<stop offset="0.5" style:stop-color="var(--atm-neutral)" />
			<stop offset="1" style:stop-color="var(--atm-warm)" />
		</linearGradient>
	</defs>

	<!-- the map -->
	<rect x={MX0} y={MY0} width={MW} height={MH} rx="10" fill="var(--surface)" />
	<g clip-path="url(#map-clip)" style:pointer-events="none">
		{#if temp}
			<g opacity={fw.current}>
				<!-- the middle of the temperature scale -->
				<rect x={MX0} y={MY0} width={MW} height={MH} fill="var(--atm-neutral)" />
				<rect
					x={MX0}
					y={MY0}
					width={MW}
					height={MH}
					fill="var(--atm-warm)"
					opacity="0.8"
					mask="url(#map-warm-mask)"
				/>
				<rect
					x={MX0}
					y={MY0}
					width={MW}
					height={MH}
					fill="var(--atm-cold)"
					opacity="0.8"
					mask="url(#map-cold-mask)"
				/>
				<path
					d={isotherms}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="0.8"
					stroke-dasharray="3 3"
					opacity="0.3"
				/>
			</g>
		{/if}

		<!-- isobars -->
		<g opacity={fronts ? 0.45 : 1}>
			{#each isobars as iso (iso.level)}
				<path
					d={iso.d}
					fill="none"
					stroke={fronts ? 'var(--stage-ink-muted)' : 'var(--stage-line)'}
					stroke-width={fronts ? 0.9 : 1.3}
					stroke-linejoin="round"
				/>
			{/each}
		</g>
		{#if !fronts}
			{#each isobarLabels as l (l.level)}
				{@render txt(l.x, l.y + 4, String(l.level), 11, { anchor: 'middle', muted: true })}
			{/each}
		{/if}

		<!-- fronts, with their cloud and rain bands -->
		{#if fronts}
			<g opacity={fw.current}>
				<path
					d={frontGfx.warm.line}
					fill="none"
					stroke="var(--atm-cloud)"
					stroke-width="22"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.7"
				/>
				<path
					d={frontGfx.cold.line}
					fill="none"
					stroke="var(--atm-cloud)"
					stroke-width="14"
					stroke-linecap="round"
					stroke-linejoin="round"
					opacity="0.7"
				/>
				<path
					d={frontGfx.cold.line}
					fill="none"
					stroke="var(--atm-high)"
					stroke-width="2.5"
					stroke-linejoin="round"
				/>
				<path d={frontGfx.cold.marks} fill="var(--atm-high)" />
				<path
					d={frontGfx.warm.line}
					fill="none"
					stroke="var(--atm-low)"
					stroke-width="2.5"
					stroke-linejoin="round"
				/>
				<path d={frontGfx.warm.marks} fill="var(--atm-low)" />
			</g>
		{/if}

		<!-- wind -->
		<path
			d={arrows}
			fill="none"
			stroke="var(--atm-wind)"
			stroke-width="1.3"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={0.7 * pw}
		/>
		{#if !reduced}
			<g opacity={fronts ? 0.4 : 0.9}>
				{#each streakFrame as s (s.id)}
					<path
						d={s.d}
						pathLength="100"
						fill="none"
						stroke="var(--atm-wind)"
						stroke-width="2"
						stroke-linecap="round"
						stroke-dasharray="16 300"
						stroke-dashoffset={s.dash}
						opacity={s.o}
					/>
				{/each}
			</g>
		{/if}

		<!-- the size of each system (its strength handle sits on this circle) -->
		{#each markers as m (step.id + m.i)}
			<circle
				cx={m.x}
				cy={m.y}
				r={m.s.r * K}
				fill="none"
				stroke={m.color}
				stroke-width="1"
				stroke-dasharray="4 5"
				opacity="0.45"
			/>
		{/each}

		{#if systems.length === 0}
			{@render txt(
				MX0 + MW / 2,
				MY0 + MH / 2 - 6,
				'An empty map: 1013 hPa everywhere, and no wind',
				15,
				{
					anchor: 'middle',
					weight: 600
				}
			)}
			{@render txt(
				MX0 + MW / 2,
				MY0 + MH / 2 + 16,
				'Add a low or a high with the buttons below the map.',
				12,
				{
					anchor: 'middle',
					muted: true
				}
			)}
		{/if}

		<!-- clouds over lows, clear skies under highs -->
		{#if !fronts}
			{#each markers as m (m.i)}
				{#if m.s.kind === 'low'}
					<path
						d={cloud(m.x + 32, m.y - 34)}
						fill="var(--atm-cloud)"
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
					/>
				{/if}
				{@render txt(
					m.x,
					m.y + 44,
					m.s.kind === 'low' ? 'rising air → clouds, rain' : 'sinking air → clear skies',
					11,
					{ anchor: 'middle', muted: true }
				)}
			{/each}
		{/if}
	</g>
	<rect
		x={MX0}
		y={MY0}
		width={MW}
		height={MH}
		rx="10"
		fill="none"
		stroke="var(--border)"
		style:pointer-events="none"
	/>

	<!-- systems: draggable centres and strength handles -->
	{#each markers as m (step.id + m.i)}
		<g style:pointer-events="none">
			{@render txt(m.x, m.y - 14, m.s.kind === 'low' ? 'L' : 'H', 34, {
				anchor: 'middle',
				color: m.color,
				weight: 700
			})}
			{@render txt(m.x, m.y + 26, `${m.p} hPa`, 13, { anchor: 'middle', weight: 600 })}
		</g>
		<Handle
			x={m.edge.x}
			y={m.edge.y}
			r={5}
			color={m.color}
			label="Strength and size of the {m.s.kind}"
			value={Math.round(m.s.r)}
			min={R_MIN}
			max={R_MAX}
			valuetext="radius {Math.round(m.s.r)} km, {m.p} hPa at the centre"
			onmove={(p) => moveEdge(m.i, p)}
			onkey={(k) => keyEdge(m.i, k)}
		/>
		<g role="presentation" onkeydowncapture={(e: KeyboardEvent) => (lastKey = e.key)}>
			<Handle
				x={m.x}
				y={m.y}
				r={7}
				color={m.color}
				label="{m.s.kind === 'low' ? 'Low' : 'High'} pressure centre, {m.p} hPa"
				value={Math.round(m.s.x)}
				min={-XMAX}
				max={XMAX}
				valuetext="{m.p} hPa; arrow keys move it"
				onmove={(p) => moveCentre(m.i, p)}
				onkey={(k) => keyCentre(m.i, k)}
				ondragend={() => (grab = null)}
			/>
		</g>
	{/each}

	<!-- legend card -->
	<g style:pointer-events="none">
		<rect
			x={CX}
			y={CY}
			width={CW}
			height={cardH}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity="0.94"
		/>
		{#if fronts}
			{@render txt(CX + 14, CY + 24, hoursText, 15, { weight: 650 })}
			<rect
				x={CX + 14}
				y={CY + 36}
				width={CW - 28}
				height="9"
				rx="4.5"
				fill="url(#map-tscale)"
				stroke="var(--border)"
				stroke-width="0.5"
			/>
			{@render txt(CX + 14, CY + 59, '−2 °C', 11, { muted: true })}
			{@render txt(CX + CW / 2, CY + 59, '12 °C', 11, { muted: true, anchor: 'middle' })}
			{@render txt(CX + CW - 14, CY + 59, '26 °C', 11, { muted: true, anchor: 'end' })}
			<path d="M{CX + 14} {CY + 82}h34" stroke="var(--atm-high)" stroke-width="2.5" fill="none" />
			<path
				d="M{CX + 18} {CY + 82}l6 -9l6 9zM{CX + 34} {CY + 82}l6 -9l6 9z"
				fill="var(--atm-high)"
			/>
			{@render txt(CX + 58, CY + 86, 'cold front: cold air advancing', 12)}
			<path d="M{CX + 14} {CY + 108}h34" stroke="var(--atm-low)" stroke-width="2.5" fill="none" />
			<path
				d="M{CX + 18} {CY + 108}a6 6 0 0 1 12 0zM{CX + 34} {CY + 108}a6 6 0 0 1 12 0z"
				fill="var(--atm-low)"
			/>
			{@render txt(CX + 58, CY + 112, 'warm front: warm air advancing', 12)}
		{:else}
			{@render txt(
				CX + 14,
				CY + 24,
				south ? 'Southern hemisphere, 45° S' : 'Northern hemisphere, 45° N',
				14,
				{ weight: 650 }
			)}
			{@render txt(
				CX + 14,
				CY + 44,
				south ? 'clockwise round lows,' : 'anticlockwise round lows,',
				12
			)}
			{@render txt(
				CX + 14,
				CY + 60,
				south ? 'anticlockwise round highs' : 'clockwise round highs',
				12
			)}
			<path
				d="M{CX + 14} {CY + 82}h26m-6 -4l6 4l-6 4"
				stroke="var(--atm-wind)"
				stroke-width="1.5"
				fill="none"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{@render txt(CX + 50, CY + 86, 'wind near the ground', 12)}
			<path d="M{CX + 14} {CY + 104}h26" stroke="var(--stage-line)" stroke-width="1.5" />
			{@render txt(CX + 50, CY + 108, 'isobars, every 4 hPa', 12)}
		{/if}
		{#if full}
			{@render txt(CX + 14, CY + cardH - 10, 'The map holds four systems at most.', 11, {
				muted: true
			})}
		{/if}
	</g>
</g>
