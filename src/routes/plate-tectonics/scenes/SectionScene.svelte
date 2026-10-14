<script lang="ts">
	/**
	 * Two plates seen from above (top strip) and in cross-section (below), driven by the model in
	 * `section.ts`. The reader drags the round handle on the right plate: sideways in the top view
	 * moves the plates apart or together, up and down slides them past each other. Each step keeps
	 * its own distance in its own control (`ridgeOpen`, `subClose`, …; `sbNormal`/`sbSlide` in the
	 * sandbox), so the slider under the stage follows the handle.
	 *
	 * The section's vertical scale is stretched: 6 px/km near sea level (the crust and the shape of
	 * the sea floor would be invisible otherwise), easing smoothly to 0.75 px/km at depth, against
	 * a horizontal scale of 0.49 px/km; the depth ticks on the left show it. Everything that moves
	 * (magma, earthquake flashes, markers carried by the plates) is a function of `t`; when a step
	 * opens, the plates move from where they started to the set distance over 3 s.
	 */
	import {
		Label,
		VectorHandle,
		cycle,
		smoothstep,
		easeInOut,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ARC_SLAB_DEPTH,
		CONTINENT_CRUST,
		HALF_WIDTH,
		OCEAN_AGE,
		airyElevation,
		feature,
		section,
		type Column,
		type Crust,
		type Section
	} from '../section';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	type Mode = 'apart' | 'together' | 'sideways' | 'free' | 'none';
	type Phase =
		| 'layers'
		| 'ridge'
		| 'rift'
		| 'subduction'
		| 'island-arc'
		| 'collision'
		| 'transform'
		| 'sandbox';
	const phase = $derived((step.hints?.phase as Phase | undefined) ?? 'sandbox');
	const PARAM: Partial<Record<Phase, string>> = {
		ridge: 'ridgeOpen',
		rift: 'riftOpen',
		subduction: 'subClose',
		'island-arc': 'arcClose',
		collision: 'colClose',
		transform: 'slide'
	};
	const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
	const crustOf = (v: unknown, d: Crust): Crust => (v === 'ocean' || v === 'continent' ? v : d);

	interface Cfg {
		mode: Mode;
		left: Crust;
		right: Crust;
		normal: number;
		slide: number;
		thickness: number;
	}
	const cfg = $derived.by((): Cfg => {
		const h = step.hints ?? {};
		const mode = (h.mode as Mode | undefined) ?? 'none';
		if (phase === 'layers')
			return {
				mode,
				left: 'continent',
				right: 'ocean',
				normal: 0,
				slide: 0,
				thickness: num(params.crust, CONTINENT_CRUST)
			};
		if (phase === 'sandbox')
			return {
				mode,
				left: crustOf(params.sbLeft, 'continent'),
				right: crustOf(params.sbRight, 'ocean'),
				normal: num(params.sbNormal, 0),
				slide: num(params.sbSlide, 0),
				thickness: CONTINENT_CRUST
			};
		const v = num(params[PARAM[phase] ?? ''], 0);
		return {
			mode,
			left: crustOf(h.left, 'ocean'),
			right: crustOf(h.right, 'ocean'),
			normal: mode === 'apart' ? v : mode === 'together' ? -v : 0,
			slide: mode === 'sideways' ? v : 0,
			thickness: CONTINENT_CRUST
		};
	});
	const speed = $derived(num(params.speed, 5));

	// The plates travel to the set distance in the first 3 s of a step.
	const grow = $derived(reduced ? 1 : easeInOut(Math.min(1, t / 3)));
	const sec: Section = $derived(
		section({
			left: cfg.left,
			right: cfg.right,
			normal: cfg.normal * grow,
			slide: cfg.slide * grow,
			speed,
			crustThickness: cfg.thickness
		})
	);

	// ---- geometry ----------------------------------------------------------------------
	const X0 = 500;
	const KX = 440 / HALF_WIDTH; // px per km
	const X = (x: number) => X0 + x * KX;
	// Vertical scale: 6 px/km above sea level and near it, easing smoothly to 0.75 px/km at depth
	// (dy/dd = 0.75 + 5.25 / (1 + (d/18)²), integrated).
	const TOP = 152; // y of +8 km
	const Y0 = TOP + 8 * 6;
	const Y = (z: number) => (z >= 0 ? Y0 - z * 6 : Y0 + 0.75 * -z + 5.25 * 18 * Math.atan(-z / 18));
	const BOTTOM = 588;
	const ZBOTTOM = (() => {
		let lo = -1000;
		let hi = 0;
		for (let i = 0; i < 50; i++) {
			const m = (lo + hi) / 2;
			if (Y(m) > BOTTOM) lo = m;
			else hi = m;
		}
		return lo;
	})();
	const SEA = Y(0);
	const LEFT = X(-HALF_WIDTH);
	const RIGHT = X(HALF_WIDTH);
	const f1 = (v: number) => v.toFixed(1);

	// Plan view (top strip).
	const PT = 22;
	const PB = 128;
	const PCY = (PT + PB) / 2;
	const KS = 0.15; // px per km, sideways
	const HX0 = X(520);
	const KN = 0.1; // px of handle per km moved across

	// ---- crust polygons ----------------------------------------------------------------
	const AGE_BAND = 5; // Myr
	const youngMix = (age: number) => Math.round(100 * Math.max(0, 1 - age / 45));
	const crustFill = (c: Column) => {
		if (c.crust === 'continent') return 'var(--pt-continent)';
		if (c.crust === 'stretched') return 'var(--pt-stretched)';
		if (c.crust === 'new-ocean') {
			const band = Math.floor(c.age / AGE_BAND) * AGE_BAND + AGE_BAND / 2;
			return `color-mix(in srgb, var(--pt-young) ${youngMix(band)}%, var(--pt-ocean-crust))`;
		}
		return 'var(--pt-ocean-crust)';
	};
	interface Run {
		key: string;
		fill: string;
		d: string;
	}
	/** Polygons between two profiles of the columns, split where the fill changes. */
	function runs(
		cols: Column[],
		top: (c: Column) => number,
		bottom: (c: Column) => number,
		fill: (c: Column) => string
	): Run[] {
		const out: Run[] = [];
		let start = 0;
		for (let i = 1; i <= cols.length; i++) {
			if (i < cols.length && fill(cols[i]) === fill(cols[start])) continue;
			const seg = cols.slice(start, Math.min(cols.length, i + 1));
			let d = '';
			seg.forEach((c, k) => (d += `${k ? 'L' : 'M'}${f1(X(c.x))} ${f1(Y(top(c)))}`));
			for (let k = seg.length - 1; k >= 0; k--) d += `L${f1(X(seg[k].x))} ${f1(Y(bottom(seg[k])))}`;
			out.push({ key: `${start}`, fill: fill(cols[start]), d: d + 'Z' });
			start = i;
		}
		return out;
	}
	const cols = $derived(sec.columns);
	const crustRuns = $derived(
		runs(
			cols,
			(c) => c.z,
			(c) => c.moho,
			crustFill
		)
	);
	const lithoPath = $derived(
		runs(
			cols,
			(c) => c.moho,
			(c) => c.litho,
			() => 'l'
		)[0].d
	);
	const waterPath = $derived.by(() => {
		// one polygon per stretch of sea floor below sea level
		let d = '';
		let run: Column[] = [];
		const flush = () => {
			if (run.length < 2) return void (run = []);
			d += `M${f1(X(run[0].x))} ${f1(SEA)}`;
			for (const c of run) d += `L${f1(X(c.x))} ${f1(Y(Math.min(0, c.z)))}`;
			d += `L${f1(X(run[run.length - 1].x))} ${f1(SEA)}Z`;
			run = [];
		};
		for (const c of cols) {
			if (c.z < 0) run.push(c);
			else {
				if (run.length) run.push(c);
				flush();
			}
		}
		flush();
		return d;
	});
	const surfacePath = $derived(
		cols.map((c, i) => `${i ? 'L' : 'M'}${f1(X(c.x))} ${f1(Y(c.z))}`).join('')
	);
	const slabPaths = $derived.by(() => {
		const s = sec.slab;
		if (!s) return null;
		type ZP = { x: number; z: number };
		const ring = (a: ZP[], b: ZP[]) => {
			const pa = a.filter((p) => p.z > ZBOTTOM - 40);
			const pb = b.slice(0, pa.length);
			return (
				pa.map((p, i) => `${i ? 'L' : 'M'}${f1(X(p.x))} ${f1(Y(p.z))}`).join('') +
				pb
					.slice()
					.reverse()
					.map((p) => `L${f1(X(p.x))} ${f1(Y(p.z))}`)
					.join('') +
				'Z'
			);
		};
		return {
			litho: ring(s.crustBase, s.base),
			crust: ring(s.top, s.crustBase),
			top: s.top
		};
	});
	const slabSide = $derived(sec.slab?.side ?? null);

	// ---- moving markers carried by the plates -------------------------------------------
	const drift = $derived(reduced ? 0 : cycle(t, 5) * 100);
	const colAt = (x: number) =>
		cols[Math.max(0, Math.min(cols.length - 1, Math.round((x + HALF_WIDTH) / 5)))];
	const markers = $derived.by(() => {
		const out: { k: string; x: number; y: number; o: number }[] = [];
		const moving = (side: 'left' | 'right') => {
			const sh = sec.shift[side];
			return sh === 0 ? 0 : Math.sign(sh);
		};
		for (const side of ['left', 'right'] as const) {
			const dir = moving(side);
			const off = (((sec.shift[side] + dir * drift) % 100) + 100) % 100;
			for (let k = -10; k <= 10; k++) {
				const u = k * 100 + off;
				const subducting = slabSide === side && sec.slab;
				// distance along the plate, positive towards the boundary on the sinking side
				const along = side === 'left' ? u : -u;
				if (subducting && sec.slab && along > 0) {
					const i = Math.round(along / 5);
					const p = sec.slab.top[i];
					const q = sec.slab.crustBase[i];
					if (!p || !q || p.z < ZBOTTOM + 10) continue;
					out.push({ k: `${side}${k}`, x: X((p.x + q.x) / 2), y: Y((p.z + q.z) / 2), o: 1 });
					continue;
				}
				const x = u;
				if (Math.abs(x) > HALF_WIDTH - 10) continue;
				const c = colAt(x);
				if (c.plate !== side) continue;
				if (sec.kind === 'collision' && Math.abs(x) < 60) continue;
				const o = smoothstep(HALF_WIDTH - 10, HALF_WIDTH - 60, Math.abs(x)) * (dir !== 0 ? 1 : 0.8);
				out.push({ k: `${side}${k}`, x: X(x), y: Y((c.z + c.moho) / 2), o });
			}
		}
		return out;
	});

	// ---- magma -------------------------------------------------------------------------
	const arc = $derived(sec.volcanoes.find((v) => v.kind === 'arc') ?? null);
	const meltPath = $derived.by((): Point[] | null => {
		if (!arc || !sec.slab) return null;
		const i = sec.slab.top.findIndex((p) => p.z <= -ARC_SLAB_DEPTH);
		if (i < 0) return null;
		const s = sec.slab.top[i];
		const c = colAt(arc.x);
		return [
			{ x: X(s.x) - Math.sign(s.x) * 4, y: Y(s.z) - 6 },
			{ x: X((s.x + arc.x) / 2), y: Y((s.z + c.moho) / 2) },
			{ x: X(arc.x), y: Y(c.moho) },
			{ x: X(arc.x), y: Y(arc.top) + 6 }
		];
	});
	const drops = $derived.by(() => {
		const out: { i: number; x: number; y: number; o: number }[] = [];
		const add = (path: Point[], n: number, period: number, salt: number) => {
			for (let i = 0; i < n; i++) {
				const u = reduced ? (i + 0.5) / n : cycle(t, period, i / n);
				// piecewise-linear position along the path
				const segs = path.length - 1;
				const f = u * segs;
				const s = Math.min(segs - 1, Math.floor(f));
				const w = f - s;
				const a = path[s];
				const b = path[s + 1];
				out.push({
					i: salt * 100 + i,
					x: a.x + (b.x - a.x) * w,
					y: a.y + (b.y - a.y) * w,
					o: reduced ? 0.9 : smoothstep(0, 0.1, u) * (1 - smoothstep(0.88, 1, u))
				});
			}
		};
		if (meltPath && arc && arc.top - arc.base > 0.3) add(meltPath, 7, 4, 1);
		for (const [vi, v] of sec.volcanoes.entries()) {
			if (v.kind === 'arc') continue;
			const c = colAt(v.x);
			const fromZ = v.kind === 'ridge' ? -45 : -60;
			for (const side of [-1, 1]) {
				const path = [
					{ x: X(v.x + side * 70), y: Y(fromZ) },
					{ x: X(v.x + side * 20), y: Y((fromZ + c.litho) / 2) },
					{ x: X(v.x), y: Y(c.moho) },
					{ x: X(v.x), y: Y(v.top) + 4 }
				];
				add(path, 4, 5, 10 + vi * 2 + (side > 0 ? 1 : 0));
			}
		}
		return out;
	});

	// ---- the asthenosphere creeping slowly (layers step) ------------------------------
	const creep = $derived.by(() => {
		if (phase !== 'layers') return [];
		const out: { i: number; x: number; y: number; o: number }[] = [];
		for (let i = 0; i < 12; i++) {
			const u = reduced ? (i * 0.618) % 1 : cycle(t, 40, (i * 0.618) % 1);
			const x = -HALF_WIDTH + 40 + u * (2 * HALF_WIDTH - 80);
			const z = -205 - ((i * 37) % 85);
			out.push({
				i,
				x: X(x),
				y: Y(z),
				o: 0.3 * smoothstep(0, 0.08, u) * (1 - smoothstep(0.92, 1, u))
			});
		}
		return out;
	});

	// ---- earthquakes -------------------------------------------------------------------
	const depthClass = (z: number) => (-z < 70 ? 'shallow' : -z <= 300 ? 'intermediate' : 'deep');
	const quakes = $derived(
		sec.quakes
			.filter((q) => q.z > ZBOTTOM + 4 && Math.abs(q.x) < HALF_WIDTH - 5)
			.map((q, i) => {
				const ph = reduced ? 0.5 : cycle(t, 2.4 + (i % 5) * 0.6, (i * 0.37) % 1);
				const flash = reduced ? 0 : Math.exp(-ph * 9);
				return {
					i,
					x: X(q.x),
					y: Y(q.z),
					r: 4.2 + flash * 4,
					o: reduced ? 0.95 : 0.55 + 0.45 * flash,
					c: `var(--pt-${depthClass(q.z)})`
				};
			})
	);

	/** A small eight-pointed burst: the symbol for an earthquake. */
	function star(x: number, y: number, r: number) {
		let d = '';
		for (let k = 0; k < 16; k++) {
			const a = (k * Math.PI) / 8;
			const rr = k % 2 ? r * 0.45 : r;
			d += `${k ? 'L' : 'M'}${f1(x + rr * Math.cos(a))} ${f1(y + rr * Math.sin(a))}`;
		}
		return d + 'Z';
	}

	// ---- the handle ---------------------------------------------------------------------
	const mode = $derived(cfg.mode);
	const handleOn = $derived(mode !== 'none');
	const hx = $derived(HX0 + cfg.normal * KN);
	const hy = $derived(PCY - cfg.slide * KS);
	const round10 = (v: number) => Math.round(v / 10) * 10;
	const limits = { apart: [0, 1500], together: [0, 1200], slide: [-300, 300], free: [-1200, 1500] };
	const clampTo = (v: number, [a, b]: number[]) => Math.max(a, Math.min(b, v));
	function write(normal: number, slide: number) {
		const id = PARAM[phase];
		if (mode === 'apart' && id) setParam(id, clampTo(round10(normal), limits.apart));
		else if (mode === 'together' && id) setParam(id, clampTo(round10(-normal), limits.together));
		else if (mode === 'sideways' && id) setParam(id, clampTo(round10(slide), limits.slide));
		else if (mode === 'free') {
			setParam('sbNormal', clampTo(round10(normal), limits.free));
			setParam('sbSlide', clampTo(round10(slide), limits.slide));
		}
	}
	function onmove(p: Point) {
		write((p.x - HX0) / KN, (PCY - p.y) / KS);
	}
	function onkey(dx: number, dy: number) {
		write(cfg.normal + dx * 10, cfg.slide + dy * 10);
	}
	const handleText = $derived.by(() => {
		const parts: string[] = [];
		if (cfg.normal > 0) parts.push(`moved apart ${Math.round(cfg.normal)} km`);
		if (cfg.normal < 0) parts.push(`moved together ${Math.round(-cfg.normal)} km`);
		if (cfg.slide !== 0) parts.push(`slid sideways ${Math.round(Math.abs(cfg.slide))} km`);
		return parts.length ? parts.join(', ') : 'not moved';
	});

	// ---- plan view ----------------------------------------------------------------------
	const planFill = (c: Column) => {
		if (c.z >= 0) {
			const m = Math.min(100, Math.round((c.z / 6) * 100));
			return `color-mix(in srgb, var(--pt-continent) ${100 - Math.round(m * 0.45)}%, var(--stage-ink))`;
		}
		const m = Math.min(100, Math.round((-c.z / 10) * 100));
		return `color-mix(in srgb, var(--pt-sea) ${100 - Math.round(m * 0.6)}%, var(--pt-sea-edge))`;
	};
	const planRuns = $derived.by(() => {
		const out: { k: number; x: number; w: number; fill: string }[] = [];
		let start = 0;
		for (let i = 1; i <= cols.length; i++) {
			if (i < cols.length && planFill(cols[i]) === planFill(cols[start])) continue;
			const x0 = start === 0 ? LEFT : X(cols[start].x - 2.5);
			const x1 = i >= cols.length ? RIGHT : X(cols[i].x - 2.5);
			out.push({ k: start, x: x0, w: x1 - x0 + 0.4, fill: planFill(cols[start]) });
			start = i;
		}
		return out;
	});
	const isochrons = $derived.by(() => {
		const out: { k: string; x: number }[] = [];
		for (const c of cols)
			if (c.crust === 'new-ocean' && c.age > 0) {
				const prev = colAt(c.x - 5 * Math.sign(c.x || 1));
				if (Math.floor(c.age / 10) !== Math.floor(prev.age / 10) && prev.crust === 'new-ocean')
					out.push({ k: `${c.x}`, x: X(c.x) });
			}
		return out;
	});
	const slideNow = $derived(cfg.slide * grow);
	const roadY = (side: 'left' | 'right') =>
		PCY + 18 + (side === 'left' ? 1 : -1) * (slideNow / 2) * KS;
	const showRoad = $derived(phase === 'transform' || (phase === 'sandbox' && cfg.slide !== 0));
	const planMarkers = $derived.by(() => {
		const out: { k: string; x: number; y: number }[] = [];
		for (const side of ['left', 'right'] as const) {
			const sh = sec.shift[side];
			const dir = sh === 0 ? 0 : Math.sign(sh);
			const off = (((sh + dir * drift) % 100) + 100) % 100;
			const dy = (side === 'left' ? 1 : -1) * (slideNow / 2) * KS;
			const sdrift =
				slideNow === 0 || reduced
					? 0
					: (side === 'left' ? 1 : -1) * Math.sign(slideNow) * cycle(t, 5) * 30;
			for (let k = -10; k <= 10; k++) {
				const x = k * 100 + off;
				if (Math.abs(x) > HALF_WIDTH - 20) continue;
				if (colAt(x).plate !== side) continue;
				if (slabSide === side && (side === 'left' ? x > 0 : x < 0)) continue;
				for (const r of [0, 1, 2]) {
					let y = PT + 18 + r * 35 + dy + sdrift;
					y = PT + ((((y - PT) % (PB - PT)) + (PB - PT)) % (PB - PT));
					out.push({ k: `${side}${k}${r}`, x: X(x), y });
				}
			}
		}
		return out;
	});
	const boundaryKind = $derived(
		sec.kind === 'ridge' || sec.kind === 'young-ocean'
			? 'ridge'
			: sec.kind === 'rift'
				? 'rift'
				: sec.kind === 'subduction'
					? 'trench'
					: sec.kind === 'collision'
						? 'collision'
						: sec.kind === 'transform'
							? 'transform'
							: 'rest'
	);
	const trenchSign = $derived(slabSide === 'left' ? 1 : -1); // teeth point to the overriding plate

	// motion arrows on the plates (plan view): direction of each plate's motion
	const arrows = $derived.by(() => {
		const out: { k: string; x: number; y: number; ang: number }[] = [];
		const n = cfg.normal;
		const s = cfg.slide;
		if (Math.abs(n) < 1 && Math.abs(s) < 1) return out;
		for (const side of ['left', 'right'] as const) {
			const sg = side === 'left' ? -1 : 1;
			let ax = (sg * n) / 2;
			let ay = (sg * s) / 2; // northward (up in the top view)
			if (sec.kind === 'subduction') {
				// the overriding plate is held still; the sinking one moves towards the trench
				if (slabSide === side) {
					ax = -sg * Math.abs(n);
					ay = sg * s;
				} else {
					ax = 0;
					ay = 0;
				}
			}
			if (Math.hypot(ax, ay) < 1) continue;
			out.push({
				k: side,
				x: X(side === 'left' ? -560 : 300),
				y: PCY - 22,
				ang: (Math.atan2(-ay * KS, ax * KN) * 180) / Math.PI
			});
		}
		return out;
	});

	// sea-floor age labels on the right of a ridge, kept at least 70 px apart
	const ageLabels = $derived.by(() => {
		const out: { age: number; x: number }[] = [];
		let last = 0;
		for (const age of [10, 20, 40, 80]) {
			const x = age * speed * 5;
			if (x > HALF_WIDTH - 60) break;
			if (x * KX < 60 || (x - last) * KX < 70) continue;
			out.push({ age, x });
			last = x;
		}
		return out;
	});

	// ---- labels ------------------------------------------------------------------------
	const trench = $derived(feature(sec, 'trench'));
	const ridge = $derived(feature(sec, 'ridge'));
	const rift = $derived(feature(sec, 'rift'));
	const mountains = $derived(feature(sec, 'mountains'));
	const transformF = $derived(feature(sec, 'transform'));
	const midCol = $derived(colAt(0));
	const leftCol = $derived(colAt(-560));
	const rightCol = $derived(colAt(560));
	const crustName = (c: Column) =>
		c.crust === 'continent'
			? 'continental crust'
			: c.crust === 'stretched'
				? 'stretched crust'
				: 'ocean crust';
	const km = (v: number) => `${Math.round(v)} km`;
	const km1 = (v: number) => `${v.toFixed(1)} km`;
	const moved = $derived(Math.hypot(cfg.normal, cfg.slide) * grow);
	const myrText = $derived(
		sec.myr < 0.05 ? '' : `${sec.myr < 10 ? sec.myr.toFixed(1) : Math.round(sec.myr)} million years`
	);
	const movedText = $derived(
		moved < 1
			? 'Plates at rest'
			: cfg.normal > 0 && cfg.slide === 0
				? `Moved apart ${km(moved)}`
				: cfg.normal < 0 && cfg.slide === 0
					? `Moved together ${km(moved)}`
					: cfg.normal === 0
						? `Slid past ${km(moved)}`
						: `Moved ${km(moved)} at a slant`
	);
	const cardRight = $derived(slabSide !== 'left'); // the slab runs under the other plate
	const CARD_W = 236;
	const cardX = $derived(cardRight ? RIGHT - CARD_W - 4 : LEFT + 4);
	const showClock = $derived(phase !== 'layers');

	// Layers step: the handle on the base of the continent's crust (drag the root down).
	const rootX = -450;
	const rootCol = $derived(colAt(rootX));
	function rootMove(p: Point) {
		// find the thickness whose Moho is under the pointer
		let best = 20;
		let bestD = Infinity;
		for (let h = 20; h <= 70; h++) {
			const z = airyElevation(h) - h;
			const d = Math.abs(Y(z) - p.y);
			if (d < bestD) {
				bestD = d;
				best = h;
			}
		}
		setParam('crust', best);
	}
	const ticks = [0, 10, 20, 30, 50, 100, 200, 300];
	const zLabelY = (z: number) => Y(z);
	const leftAge = $derived(OCEAN_AGE.left + sec.myr);
</script>

<g class="section-scene">
	<defs>
		<clipPath id="section-scene-clip">
			<rect x={LEFT} y={TOP - 8} width={RIGHT - LEFT} height={BOTTOM - TOP + 8} />
		</clipPath>
		<clipPath id="section-scene-plan">
			<rect x={LEFT} y={PT} width={RIGHT - LEFT} height={PB - PT} rx="6" />
		</clipPath>
	</defs>

	<!-- ================================================================ plan view -->
	<g clip-path="url(#section-scene-plan)">
		{#each planRuns as r (r.k)}
			<rect x={r.x} y={PT} width={r.w} height={PB - PT} fill={r.fill} />
		{/each}
		{#each isochrons as i (i.k)}
			<line
				x1={i.x}
				x2={i.x}
				y1={PT}
				y2={PB}
				stroke="var(--stage-bg)"
				stroke-width="0.8"
				opacity="0.6"
			/>
		{/each}
		{#each planMarkers as m (m.k)}
			<circle cx={m.x} cy={m.y} r="2" fill="var(--stage-ink)" opacity="0.35" />
		{/each}
		{#if showRoad}
			<line
				x1={LEFT}
				x2={X(0)}
				y1={roadY('left')}
				y2={roadY('left')}
				stroke="var(--stage-ink)"
				stroke-width="2.4"
				stroke-dasharray="7 4"
			/>
			<line
				x1={X(0)}
				x2={RIGHT}
				y1={roadY('right')}
				y2={roadY('right')}
				stroke="var(--stage-ink)"
				stroke-width="2.4"
				stroke-dasharray="7 4"
			/>
		{/if}
	</g>
	<rect
		x={LEFT}
		y={PT}
		width={RIGHT - LEFT}
		height={PB - PT}
		rx="6"
		fill="none"
		stroke="var(--border)"
	/>
	<!-- the boundary seen from above -->
	{#if boundaryKind === 'ridge'}
		<line x1={X(-4)} x2={X(-4)} y1={PT} y2={PB} stroke="var(--pt-apart)" stroke-width="2" />
		<line x1={X(4)} x2={X(4)} y1={PT} y2={PB} stroke="var(--pt-apart)" stroke-width="2" />
	{:else if boundaryKind === 'rift'}
		<line
			x1={X(0)}
			x2={X(0)}
			y1={PT}
			y2={PB}
			stroke="var(--pt-apart)"
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
	{:else if boundaryKind === 'trench'}
		<line x1={X(0)} x2={X(0)} y1={PT} y2={PB} stroke="var(--pt-together)" stroke-width="2.2" />
		{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
			{@const y = PT + 8 + k * 13}
			<path
				d="M{X(0)} {y - 4} L{X(0) + trenchSign * 8} {y} L{X(0)} {y + 4} Z"
				fill="var(--pt-together)"
			/>
		{/each}
	{:else if boundaryKind === 'collision'}
		<line x1={X(0)} x2={X(0)} y1={PT} y2={PB} stroke="var(--pt-together)" stroke-width="2.2" />
	{:else if boundaryKind === 'transform'}
		<line x1={X(0)} x2={X(0)} y1={PT} y2={PB} stroke="var(--pt-sideways)" stroke-width="2.4" />
	{:else}
		<line
			x1={X(0)}
			x2={X(0)}
			y1={PT}
			y2={PB}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			stroke-dasharray="4 4"
		/>
	{/if}
	{#each arrows as a (a.k)}
		<g transform="translate({a.x} {a.y}) rotate({a.ang})" opacity="0.85">
			<path d="M-16 0 H12" stroke="var(--stage-ink)" stroke-width="2.4" />
			<path d="M10 -6 L18 0 L10 6 Z" fill="var(--stage-ink)" />
		</g>
	{/each}
	<Readout id="plan-title">
		<Label x={LEFT + 10} y={PT + 16} text="Seen from above" anchor="start" size={12} weight={600} />
	</Readout>
	{#if handleOn}
		<circle
			cx={HX0}
			cy={PCY}
			r="5"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 2"
		/>
		{#if Math.hypot(hx - HX0, hy - PCY) > 8}
			<line
				x1={HX0}
				y1={PCY}
				x2={hx}
				y2={hy}
				stroke="var(--explainer-accent, var(--accent))"
				stroke-width="1.6"
				stroke-dasharray="4 3"
			/>
		{/if}
		<Readout id="drag-hint">
			<Label
				x={HX0}
				y={PB - 8}
				text={mode === 'apart'
					? '← together · apart →'
					: mode === 'together'
						? '← together'
						: mode === 'sideways'
							? '↑ ↓ slide'
							: 'drag any way'}
				size={11}
				muted
			/>
		</Readout>
		<VectorHandle
			x={hx}
			y={hy}
			label="Right plate"
			value={Math.round(cfg.normal)}
			valuetext={handleText}
			color="var(--explainer-accent, var(--accent))"
			{onmove}
			{onkey}
		/>
	{/if}

	<!-- ================================================================ cross-section -->
	<g clip-path="url(#section-scene-clip)">
		<rect
			x={LEFT}
			y={SEA}
			width={RIGHT - LEFT}
			height={BOTTOM - SEA + 2}
			fill="var(--pt-astheno)"
		/>
		<path d={waterPath} fill="var(--pt-sea)" />
		{#each creep as c (c.i)}
			<path
				d="M{f1(c.x - 7)} {f1(c.y)} h14 m-4 -3 l4 3 l-4 3"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				opacity={c.o}
			/>
		{/each}
		{#if slabPaths}
			<path d={slabPaths.litho} fill="var(--pt-litho)" />
			<path d={slabPaths.crust} fill="var(--pt-ocean-crust)" />
		{/if}
		<path d={lithoPath} fill="var(--pt-litho)" />
		{#each crustRuns as r (r.key + r.fill)}
			<path d={r.d} fill={r.fill} />
		{/each}
		<path d={surfacePath} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" opacity="0.55" />
		<line
			x1={LEFT}
			x2={RIGHT}
			y1={SEA}
			y2={SEA}
			stroke="var(--pt-sea-edge)"
			stroke-width="1"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
		{#each markers as m (m.k)}
			<circle cx={m.x} cy={m.y} r="2.2" fill="var(--stage-bg)" opacity={0.75 * m.o} />
		{/each}
		<!-- magma -->
		{#each drops as d (d.i)}
			<ellipse cx={d.x} cy={d.y} rx="2.6" ry="3.6" fill="var(--pt-magma)" opacity={d.o * 0.85} />
		{/each}
		{#each sec.volcanoes as v, i (i)}
			{@const glow = reduced ? 0.8 : 0.5 + 0.5 * Math.sin(t * 3 + i)}
			{#if v.top - v.base > 0.3 || v.kind === 'ridge'}
				<circle cx={X(v.x)} cy={Y(v.top)} r="4" fill="var(--pt-magma)" opacity={glow} />
			{/if}
		{/each}
		<!-- earthquakes -->
		{#each quakes as q (q.i)}
			<path
				d={star(q.x, q.y, q.r)}
				fill={q.c}
				opacity={q.o}
				stroke="var(--stage-bg)"
				stroke-width="0.7"
				stroke-linejoin="round"
			/>
		{/each}
	</g>
	<rect
		x={LEFT}
		y={TOP - 8}
		width={RIGHT - LEFT}
		height={BOTTOM - TOP + 8}
		fill="none"
		stroke="var(--border)"
	/>

	<!-- depth axis -->
	<Readout id="axis">
		{#each ticks as d (d)}
			<line
				x1={LEFT - 4}
				x2={LEFT}
				y1={zLabelY(-d)}
				y2={zLabelY(-d)}
				stroke="var(--stage-ink-muted)"
			/>
			<text x={LEFT - 6} y={zLabelY(-d) + 4} font-size="10" text-anchor="end" class="muted"
				>{d}</text
			>
		{/each}
		<text x={LEFT - 6} y={TOP + 2} font-size="10" text-anchor="end" class="muted">km</text>
	</Readout>

	<!-- ================================================================ labels -->
	{#if phase === 'layers'}
		<Readout
			id="l-cc"
			order={1}
			label="Continental crust"
			value="{km(cfg.thickness)} thick"
			color="var(--pt-continent)"
		>
			<Label
				x={X(-640)}
				y={Y((leftCol.z + leftCol.moho) / 2) + 4}
				text="continental crust · {km(cfg.thickness)}"
				size={12}
			/>
		</Readout>
		<Readout
			id="l-oc"
			order={2}
			label="Ocean crust"
			value="7 km thick"
			color="var(--pt-ocean-crust)"
		>
			<Label x={X(560)} y={Y(rightCol.moho) + 16} text="ocean crust · 7 km" size={12} />
		</Readout>
		<Readout
			id="l-land"
			order={3}
			label={rootCol.z >= 0 ? 'Land stands' : 'Under the sea'}
			value={rootCol.z >= 0
				? `${km1(rootCol.z)} above sea level`
				: `${km1(-rootCol.z)} below sea level`}
		>
			<Label
				x={X(-640)}
				y={Y(Math.max(rootCol.z, 0)) - 8}
				text={rootCol.z >= 0
					? `${km1(rootCol.z)} above sea level`
					: `${km1(-rootCol.z)} below sea level`}
				size={12}
				pill
			/>
		</Readout>
		<Readout id="l-root" order={4} label="Root reaches" value="{km(-rootCol.moho)} down">
			<Label x={X(-250)} y={Y(rootCol.moho) + 18} text="root: {km(-rootCol.moho)} down" size={12} />
		</Readout>
		<Readout id="l-sea">
			<Label x={X(560)} y={Y(-1.4)} text="sea" size={12} muted />
		</Readout>
		<Readout id="l-litho" order={5} label="Lithosphere (the plate)" color="var(--pt-litho)">
			<Label x={X(560)} y={Y(-70)} text="lithosphere = the plate" size={12} weight={600} />
			<Label
				x={X(560)}
				y={Y(-70) + 16}
				text="crust + the stiff top of the mantle"
				size={11}
				muted
			/>
		</Readout>
		<Readout
			id="l-astheno"
			order={6}
			label="Asthenosphere: solid but slowly flowing"
			color="var(--pt-astheno)"
		>
			<Label
				x={X(300)}
				y={Y(-160)}
				text="asthenosphere: hot, solid rock that flows slowly"
				size={12}
			/>
		</Readout>
		<VectorHandle
			x={X(rootX)}
			y={Y(rootCol.moho)}
			label="Base of the continent's crust"
			value={cfg.thickness}
			valuetext="crust {km(cfg.thickness)} thick"
			color="var(--explainer-accent, var(--accent))"
			onmove={rootMove}
			onkey={(_dx, dy) => setParam('crust', Math.max(20, Math.min(70, cfg.thickness - dy)))}
		/>
	{/if}

	{#if ridge && (phase === 'ridge' || phase === 'rift' || phase === 'sandbox')}
		<Readout id="f-ridge" order={2} label="Mid-ocean ridge" value="{km1(ridge.value)} deep">
			<Label
				x={X(0)}
				y={Y(0) - 10}
				text="mid-ocean ridge · {km1(ridge.value)} deep"
				size={12}
				pill
			/>
		</Readout>
	{/if}
	{#if phase === 'ridge'}
		{#each ageLabels as a (a.age)}
			<Readout id="age-{a.age}">
				<Label x={X(a.x)} y={Y(colAt(a.x).moho) + 14} text="{a.age} million yr" size={11} muted />
			</Readout>
		{/each}
		<Readout id="r-new" order={3} label="New sea floor" value={km(sec.newOcean)}>
			<Label x={X(0)} y={Y(-80)} text="hot mantle rises and melts" size={12} />
		</Readout>
	{/if}
	{#if rift}
		<Readout
			id="f-rift"
			order={2}
			label="Rift valley floor"
			value={rift.z < 0 ? `${km1(-rift.z)} below sea level` : `${km1(rift.z)} up`}
		>
			<Label
				x={X(0)}
				y={Y(Math.max(0.6, rift.z, ...sec.volcanoes.map((v) => v.top))) - 14}
				text={rift.z < 0 ? 'rift valley, flooded by the sea' : 'rift valley'}
				size={12}
				pill
			/>
		</Readout>
		<Readout
			id="f-beta"
			order={3}
			label="Crust stretched"
			value="{sec.beta.toFixed(1)} times, now {km(CONTINENT_CRUST / sec.beta)} thick"
		>
			<Label
				x={X(0)}
				y={Y(-55)}
				text="crust stretched {sec.beta.toFixed(1)}× · {km(CONTINENT_CRUST / sec.beta)} thick"
				size={12}
			/>
		</Readout>
	{/if}
	{#if sec.kind === 'young-ocean'}
		<Readout id="f-young" order={3} label="New ocean" value="{km(sec.newOcean)} wide">
			<Label x={X(0)} y={Y(-80)} text="a new ocean · {km(sec.newOcean)} wide" size={12} />
		</Readout>
	{/if}
	{#if trench}
		<Readout
			id="f-trench"
			order={2}
			label="Trench"
			value="{km1(trench.value)} deep"
			color="var(--pt-together)"
		>
			<Label
				x={X(0) + (slabSide === 'left' ? -14 : 14)}
				y={Y(trench.z) + 22}
				text="trench · {km1(trench.value)} deep"
				size={12}
				anchor={slabSide === 'left' ? 'end' : 'start'}
				pill
			/>
		</Readout>
		{#if sec.slab && sec.slab.top.length > 30}
			{@const p = sec.slab.top[Math.min(sec.slab.top.length - 1, 50)]}
			<Readout id="f-slab" order={5} label="Sinking plate">
				<Label
					x={X(p.x) + (slabSide === 'left' ? -30 : 30)}
					y={Y(p.z) + 34}
					text="sinking plate"
					size={12}
					anchor={slabSide === 'left' ? 'end' : 'start'}
				/>
			</Readout>
		{/if}
	{/if}
	{#if arc}
		<Readout
			id="f-arc"
			order={3}
			label={arc.base < -1 ? 'Island arc' : 'Volcanic arc'}
			value="{km(Math.abs(arc.x))} from the trench"
			color="var(--pt-volcano)"
		>
			<Label
				x={X(arc.x)}
				y={Y(Math.max(arc.top, 0)) - 14}
				text="{arc.base < -1
					? arc.top > 0
						? 'volcanic islands'
						: 'growing volcano'
					: 'volcanoes'} · {km(Math.abs(arc.x))} from the trench"
				size={12}
				pill
			/>
		</Readout>
		{#if meltPath}
			<Readout id="f-melt" order={6} label="Melting" value="where the plate is ~100 km deep">
				<Label
					x={meltPath[0].x + (slabSide === 'left' ? 12 : -12)}
					y={meltPath[0].y - 10}
					text="water from the plate melts the mantle"
					size={11}
					anchor={slabSide === 'left' ? 'start' : 'end'}
				/>
			</Readout>
		{/if}
	{:else if sec.kind === 'subduction' && sec.slab}
		<Readout id="f-noarc" order={3} label="Volcanoes" value="not yet: the plate is not deep enough">
			<Label
				x={X(slabSide === 'left' ? 220 : -220)}
				y={Y(1) - 12}
				text="no volcanoes yet: the plate isn't 100 km deep"
				size={12}
				pill
			/>
		</Readout>
	{/if}
	{#if mountains}
		<Readout
			id="f-mount"
			order={2}
			label="Mountains"
			value="{km1(mountains.value)} high"
			color="var(--pt-continent)"
		>
			<Label
				x={X(0)}
				y={Y(mountains.value) - 10}
				text="mountains · {km1(mountains.value)} high"
				size={12}
				pill
			/>
		</Readout>
		<Readout
			id="f-rootc"
			order={3}
			label="Crust under the peak"
			value="{km(midCol.z - midCol.moho)} thick"
		>
			<Label
				x={X(0)}
				y={Y(midCol.moho) + 18}
				text="root · crust {km(midCol.z - midCol.moho)} thick"
				size={12}
			/>
		</Readout>
		<Readout id="f-novolc" order={4} label="Volcanoes" value="none: nothing sinks">
			<Label x={X(0)} y={Y(-170)} text="no plate sinks: no volcanoes" size={12} muted />
		</Readout>
	{/if}
	{#if transformF && sec.kind === 'transform'}
		{@const zt = midCol.z}
		<g transform="translate({X(0)} {Y(Math.max(zt, 0)) - 26})">
			<!-- ⊙ coming towards you on one side, ⊗ going away on the other -->
			{#each [-1, 1] as s (s)}
				{@const towards = s < 0 === transformF.value > 0}
				<circle
					cx={s * 18}
					cy="0"
					r="7"
					fill="var(--surface)"
					stroke="var(--pt-sideways)"
					stroke-width="1.6"
				/>
				{#if towards}
					<circle cx={s * 18} cy="0" r="2" fill="var(--pt-sideways)" />
				{:else}
					<path
						d="M{s * 18 - 4} -4 l8 8 M{s * 18 + 4} -4 l-8 8"
						stroke="var(--pt-sideways)"
						stroke-width="1.6"
					/>
				{/if}
			{/each}
		</g>
		<Readout
			id="f-transform"
			order={2}
			label="Transform fault"
			value="slid {km(Math.abs(transformF.value))}"
			color="var(--pt-sideways)"
		>
			<Label
				x={X(0)}
				y={Y(Math.max(zt, 0)) - 44}
				text="transform fault: the plates slide past"
				size={12}
				pill
			/>
		</Readout>
	{:else if transformF}
		<Readout
			id="f-transform"
			order={2}
			label="Also sliding past"
			value="{km(Math.abs(transformF.value))}: a transform fault"
			color="var(--pt-sideways)"
		>
			<Label
				x={X(0) - 12}
				y={PB - 12}
				text="transform fault: also sliding past"
				size={11}
				anchor="end"
				pill
			/>
		</Readout>
	{/if}
	{#if phase !== 'layers'}
		<Readout id="crust-l" order={8}>
			<Label x={X(-640)} y={Y(leftCol.moho) - 4} text={crustName(leftCol)} size={11} muted />
		</Readout>
		{#if !(slabSide === 'right')}
			<Readout id="crust-r">
				<Label x={X(640)} y={Y(rightCol.moho) - 4} text={crustName(rightCol)} size={11} muted />
			</Readout>
		{/if}
		{#if phase === 'island-arc' || (phase === 'sandbox' && cfg.left === 'ocean' && cfg.right === 'ocean' && sec.kind === 'subduction')}
			<Readout id="ages">
				<Label
					x={X(-640)}
					y={Y(leftCol.z) - 10}
					text="{Math.round(leftAge)} million years old"
					size={11}
				/>
				<Label
					x={X(640)}
					y={Y(rightCol.z) - 10}
					text="{Math.round(OCEAN_AGE.right + sec.myr)} million years old"
					size={11}
				/>
			</Readout>
		{/if}
	{/if}

	{#if showClock}
		<Readout
			id="clock"
			order={1}
			label={movedText}
			value={myrText ? `${myrText} at ${speed} cm a year` : '—'}
		>
			<g transform="translate({cardX} {BOTTOM - 54})">
				<rect width={CARD_W} height="48" rx="8" fill="var(--surface)" stroke="var(--border)" />
				<text x="12" y="20" font-size="14" font-weight="600">{movedText}</text>
				<text x="12" y="38" font-size="12" class="muted"
					>{myrText ? `${myrText} at ${speed} cm a year` : 'drag the handle on the plate'}</text
				>
			</g>
		</Readout>
	{/if}
	{#if quakes.length}
		<Readout id="q-legend" order={9} label="Earthquakes" color="var(--pt-shallow)">
			<g transform="translate({cardRight ? LEFT + 10 : RIGHT - 120} {BOTTOM - 14})">
				<path d={star(4, -4, 5)} fill="var(--pt-shallow)" />
				<path d={star(15, -4, 5)} fill="var(--pt-intermediate)" />
				<path d={star(26, -4, 5)} fill="var(--pt-deep)" />
				<text x="34" y="0" font-size="11" class="muted">earthquakes</text>
			</g>
		</Readout>
	{/if}
</g>

<style>
	.muted {
		fill: var(--stage-ink-muted);
	}
</style>
