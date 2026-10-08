<script module lang="ts">
	import { DESIGNS, envelope, size, solve, type Solution, type Structure } from '../structure';

	/** Everything about a structure that is computed once, not per frame. */
	export interface Analysis {
		s: Structure;
		areas: number[];
		env: { per: number[]; worst: number; unstable: boolean };
		/** Deflection exaggeration for the drawing. */
		factor: number;
		/** Solutions memoised per truck position (0.1 m buckets). */
		cache: Map<number, Solution>;
	}

	const NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500];

	export function analyse(s: Structure): Analysis {
		const areas = size(s);
		const env = envelope(s, areas);
		const mid = solve(s, 20, areas);
		// The largest "nice" factor that draws the midspan sag at most 2.5 m.
		const room = mid.unstable ? 1 : 2.5 / Math.max(mid.maxDeflection, 1e-6);
		const factor = NICE.filter((n) => n <= room).at(-1) ?? 1;
		return { s, areas, env, factor, cache: new Map() };
	}

	export function solveAt(a: Analysis, x: number): Solution {
		const key = Math.round(x * 10);
		let sol = a.cache.get(key);
		if (!sol) {
			sol = solve(a.s, key / 10, a.areas);
			if (a.cache.size > 800) a.cache.clear();
			a.cache.set(key, sol);
		}
		return sol;
	}

	/** The four designs, analysed once for the whole page (about 40 ms each). */
	// A plain cache, deliberately not reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const designCache = new Map<string, Analysis>();
	export function designAnalysis(id: string): Analysis {
		let a = designCache.get(id);
		if (!a) {
			a = analyse(DESIGNS[id] ?? DESIGNS.beam);
			designCache.set(id, a);
		}
		return a;
	}
</script>

<script lang="ts">
	/**
	 * The gap, its banks and one bridge, with a 30-tonne truck driving across.
	 *
	 * Steps (`step.hints`): `design` on beam/truss/arch/suspension; on `compare`
	 * the design is `params.design`; on `build` (`hints.edit`) the reader's
	 * structure lives in `params['bridge:build']` (`serializeStructure`), falling
	 * back to `STARTER`, and `params.resetBridge` restores it.
	 *
	 * Every frame the structure is solved with the truck's centre as the load
	 * (`solveAt`, memoised per 0.1 m); sizes, envelopes and the deflection
	 * factor are computed once per structure (`analyse`).
	 *
	 * Members: a beam is a band whose two faces are coloured by the stress on
	 * that face (pull + bending): a member that is mainly pulled or pushed is
	 * one colour, a beam that bends is red on its squashed face and blue on its
	 * stretched one. Cables are thin ropes tinted blue by utilisation; slack
	 * ones dashed. Members past their limit get a `--struct-fail` halo and a
	 * crack; one "would fail" tag on the worst.
	 *
	 * The truck: on the shape steps it crosses on a 12 s loop (pure function of
	 * t); the "Drive" press count restarts the loop: the t of the last change of
	 * the count is kept in a closure inside a `$derived` (reset when t restarts
	 * at a step change). On build it waits at midspan until Drive is pressed.
	 *
	 * Build: drag between grid points (pointer) or Tab to a joint, Enter, arrow
	 * keys, Enter (keyboard); the eraser removes a clicked member, or Delete on
	 * a focused one. The structure is drawn undeformed there (so it lines up with
	 * the grid) with the deflected shape as a dashed ghost.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, smoothstep, startDrag, toSvg, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		BUDGET,
		DEPTH,
		GRID,
		SPAN,
		STARTER,
		YIELD,
		addMember,
		boxSection,
		deckMemberAt,
		isAnchor,
		isDeck,
		isRoller,
		parseStructure,
		removeMember,
		serializeStructure,
		type Joint,
		type MemberKind,
		type MemberResult
	} from '../structure';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- world → screen: a uniform 12.5 px per metre --------------------------------
	const S = 12.5;
	const Y0 = 248;
	const PX = (x: number) => 480 + (x - 20) * S;
	const PY = (y: number) => Y0 - y * S;
	const WX = (px: number) => 20 + (px - 480) / S;
	const WY = (py: number) => (Y0 - py) / S;
	const GROUND_BOTTOM = PY(-14);
	const L = 16; // safe margins
	const R = 944;

	// ---- which structure ----------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'beam'));
	const editing = $derived(step.hints?.edit === true);
	const designId = $derived(
		editing
			? 'build'
			: phase === 'compare'
				? String(params.design ?? 'beam')
				: String(step.hints?.design ?? 'beam')
	);
	const NAMES: Record<string, string> = {
		beam: 'Beam bridge',
		truss: 'Truss bridge',
		arch: 'Arch bridge',
		suspension: 'Suspension bridge',
		build: 'Your bridge'
	};
	const SHORT: Record<string, string> = {
		beam: 'Beam',
		truss: 'Truss',
		arch: 'Arch',
		suspension: 'Suspension'
	};
	const ORDER = ['beam', 'truss', 'arch', 'suspension'];

	const buildText = $derived(String(params['bridge:build'] ?? ''));
	const built = $derived(parseStructure(buildText) ?? STARTER);
	const buildAnalysis = $derived(editing ? analyse(built) : null);
	const an = $derived(buildAnalysis ?? designAnalysis(designId));
	const s = $derived(an.s);

	// Fade the structure in when the design changes (not on every edit).
	const fade = new Tween(1, { duration: 500, easing: cubicInOut });
	$effect(() => {
		void designId;
		untrack(() => {
			fade.set(0.15, { duration: 0 });
			fade.set(1, { duration: reduced ? 0 : 500 });
		});
	});

	// "Start again" on the build step: react to a change of the press count only.
	let lastReset: number | null = null;
	$effect(() => {
		const c = Number(params.resetBridge ?? 0);
		untrack(() => {
			if (lastReset !== null && c !== lastReset) {
				setParam('bridge:build', serializeStructure(STARTER));
				sel = null;
				cursor = null;
			}
			lastReset = c;
		});
	});

	// ---- the truck ----------------------------------------------------------------------
	const TRUCK_HALF = 4.5; // m
	const X_START = -9;
	const X_END = 49;
	const LOOP = 12;

	// Where the truck must stop: before a gap in the road, or on the bank if the
	// structure cannot stand.
	const stopX = $derived.by(() => {
		if (!editing) return Infinity;
		const sol0 = solveAt(an, -100);
		if (sol0.unstable) return -TRUCK_HALF - 0.3;
		if (!sol0.gapInDeck) return Infinity;
		const spans = s.members
			.filter((m) => isDeck(s, m))
			.map((m) => [
				Math.min(s.joints[m.a].x, s.joints[m.b].x),
				Math.max(s.joints[m.a].x, s.joints[m.b].x)
			])
			.sort((p, q) => p[0] - q[0]);
		let reach = 0;
		for (const [lo, hi] of spans) {
			if (lo > reach + 1e-6) break;
			reach = Math.max(reach, hi);
		}
		return reach - TRUCK_HALF - 0.3;
	});

	// Sanctioned bookkeeping: the t at which the Drive count last changed (see the doc comment).
	let mark = { count: -1, t0: 0, pressed: false };
	const sinceDrive = $derived.by(() => {
		const c = Number(params.drive ?? 0);
		if (mark.count < 0) mark = { count: c, t0: 0, pressed: false };
		else if (c !== mark.count) mark = { count: c, t0: t, pressed: true };
		if (t < mark.t0) mark = { ...mark, t0: 0, pressed: false };
		return { e: t - mark.t0, pressed: mark.pressed };
	});

	function crossing(u: number) {
		const x =
			u < 0.08
				? X_START
				: u < 0.86
					? lerp(X_START, X_END, smoothstep(0, 1, (u - 0.08) / 0.78))
					: X_END;
		return { x, o: smoothstep(0, 0.04, u) * (1 - smoothstep(0.95, 1, u)) };
	}

	const truck = $derived.by(() => {
		const park = Math.min(20, stopX);
		if (reduced) return { x: park, o: 1 };
		const { e, pressed } = sinceDrive;
		let c: { x: number; o: number };
		if (editing) {
			if (!pressed || e >= LOOP) c = { x: park, o: pressed ? smoothstep(LOOP, LOOP + 0.5, e) : 1 };
			else c = crossing(e / LOOP);
		} else c = crossing((((e % LOOP) + LOOP) % LOOP) / LOOP);
		return { x: Math.min(c.x, stopX), o: c.o };
	});

	// ---- the solution now -----------------------------------------------------------------
	const sol = $derived(solveAt(an, truck.x));
	const unstable = $derived(sol.unstable);
	const exag = $derived(unstable ? 0 : an.factor);
	/** Drawn positions: displaced (shape steps) or undeformed (build, so it lines up with the grid). */
	const drawnJ = $derived(
		s.joints.map((j, i) => {
			const d = editing || unstable ? [0, 0] : sol.displacement[i];
			return { x: PX(j.x + d[0] * exag), y: PY(j.y + d[1] * exag) };
		})
	);
	const ghost = $derived(
		editing && !unstable
			? s.members
					.map((m) => {
						const p = s.joints[m.a];
						const q = s.joints[m.b];
						const dp = sol.displacement[m.a];
						const dq = sol.displacement[m.b];
						return `M${PX(p.x + dp[0] * exag).toFixed(1)} ${PY(p.y + dp[1] * exag).toFixed(1)}L${PX(q.x + dq[0] * exag).toFixed(1)} ${PY(q.y + dq[1] * exag).toFixed(1)}`;
					})
					.join('')
			: ''
	);

	/** Height of the drawn road at x (screen). */
	function roadY(x: number) {
		if (x <= 0 || x >= SPAN) return PY(0);
		const i = s.members.findIndex((m) => {
			if (!isDeck(s, m)) return false;
			const lo = Math.min(s.joints[m.a].x, s.joints[m.b].x);
			const hi = Math.max(s.joints[m.a].x, s.joints[m.b].x);
			return x >= lo - 1e-9 && x <= hi + 1e-9;
		});
		if (i < 0) return PY(0);
		const m = s.members[i];
		const pa = s.joints[m.a];
		const pb = s.joints[m.b];
		const u = (x - pa.x) / (pb.x - pa.x);
		return lerp(drawnJ[m.a].y, drawnJ[m.b].y, u);
	}
	const truckDraw = $derived.by(() => {
		const sx = PX(truck.x);
		const yr = roadY(truck.x - 3.5);
		const yf = roadY(truck.x + 3.5);
		// Wheels on top of the deck band, not on its centre line.
		const k = truck.x > 0 && truck.x < SPAN ? deckMemberAt(s, truck.x) : -1;
		const sy = (yr + yf) / 2 - (k >= 0 ? members[k].hw / 2 : 1.5);
		const angle = (Math.atan2(yf - yr, 7 * S) * 180) / Math.PI;
		return { sx, sy, angle };
	});

	// ---- colours ---------------------------------------------------------------------------
	/**
	 * Colour strength from utilisation, shared with the basics scene: 0 → plain steel,
	 * 1 → the full colour, with a square root so lightly loaded members still show
	 * their sign. Quantised to 5 % steps so the colour strings don't churn per frame.
	 */
	const huePct = (u: number) => (u < 0.005 ? 0 : 35 + 65 * Math.sqrt(clamp(u)));
	function tone(sign: number, strength: number) {
		if (sign === 0) return 'var(--struct-steel)';
		const pct = Math.round(huePct(strength) / 5) * 5;
		const hue = sign > 0 ? 'var(--struct-tension)' : 'var(--struct-compression)';
		return `color-mix(in oklab, ${hue} ${pct}%, var(--struct-steel))`;
	}
	/** Legend gradient stops: the same mapping along a 0 → 100 % bar. */
	const SCALE_STOPS = [0, 0.01, 0.1, 0.25, 0.5, 1].map((u) => ({ u, pct: huePct(u) }));

	// ---- members ---------------------------------------------------------------------------
	interface Drawn {
		key: string;
		i: number;
		kind: MemberKind;
		a: Point;
		b: Point;
		hw: number;
		/**
		 * Beams: three strips along the band — the face towards local +y, the core
		 * (coloured by the pull or push alone) and the face towards local −y (each
		 * face coloured by its own stress: pull or push plus bending).
		 */
		strips: { d: string; color: string; w: number }[];
		color: string;
		dash: string | null;
		opacity: number;
		fail: boolean;
		/** A crack across the band, opening from the stretched face. */
		crack: string | null;
		r: MemberResult;
	}
	const fmtPath = (a: Point, b: Point, ox = 0, oy = 0) =>
		`M${(a.x + ox).toFixed(1)} ${(a.y + oy).toFixed(1)}L${(b.x + ox).toFixed(1)} ${(b.y + oy).toFixed(1)}`;

	const members = $derived.by((): Drawn[] =>
		s.members.map((m, i) => {
			const r = sol.members[i];
			const p = s.joints[m.a];
			const q = s.joints[m.b];
			const a = drawnJ[m.a];
			const b = drawnJ[m.b];
			const key = `${m.kind}${p.x},${p.y}-${q.x},${q.y}`;
			const width = sol.widths[i] ?? 0.2;
			const base = {
				key,
				i,
				kind: m.kind,
				a,
				b,
				strips: [] as { d: string; color: string; w: number }[],
				dash: null as string | null,
				opacity: 1,
				fail: !unstable && r.utilisation > 1,
				crack: null as string | null,
				r
			};
			if (unstable || r.unsupported) {
				return {
					...base,
					hw: m.kind === 'beam' ? 4 : 2,
					color: 'var(--struct-steel)',
					dash: '5 4',
					opacity: 0.6
				};
			}
			if (m.kind === 'cable') {
				return {
					...base,
					hw: 2.2,
					color: r.slack ? 'var(--struct-cable)' : tone(1, r.utilisation),
					dash: r.slack ? '4 4' : null,
					opacity: r.slack ? 0.45 : 1,
					fail: r.utilisation > 1
				};
			}
			// A beam: stresses on its two faces (tension +).
			const A = an.areas[i];
			const { I, w } = boxSection(A);
			const sa = r.axial / A;
			const peak = r.momentAt.reduce((x, y) => (Math.abs(y.m) > Math.abs(x.m) ? y : x), {
				u: 0.5,
				m: 0
			});
			const sb = (Math.abs(peak.m) * (w / 2)) / I;
			const sm = Math.sign(peak.m); // sagging +: the local +y face is squashed
			const sPlus = sa - sm * sb;
			const sMinus = sa + sm * sb;
			const big = Math.max(Math.abs(sPlus), Math.abs(sMinus), 1);
			// A face whose stress is small next to the member's larger face is drawn as plain
			// steel: an arch rib that is mainly pushed reads red, not red-and-blue.
			const faceSign = (v: number) =>
				Math.abs(v) < 0.004 * YIELD || Math.abs(v) < 0.3 * big ? 0 : Math.sign(v);
			const hw = clamp(width * S * 1.8, 4, 12);
			const L2 = Math.hypot(q.x - p.x, q.y - p.y);
			const c = (q.x - p.x) / L2;
			const sn = (q.y - p.y) / L2;
			// Local +y in world is (−sn, c); on screen (y down) that is (−sn, −c).
			const fw = hw * 0.3; // each face strip; the core gets the remaining 0.4
			const nx = -sn * (hw / 2 - fw / 2);
			const ny = -c * (hw / 2 - fw / 2);
			const plus = tone(faceSign(sPlus), (r.utilisation * Math.abs(sPlus)) / big);
			const minus = tone(faceSign(sMinus), (r.utilisation * Math.abs(sMinus)) / big);
			const core = tone(faceSign(sa), (r.utilisation * Math.abs(sa)) / big);
			let crack: string | null = null;
			if (r.utilisation > 1) {
				// Cracks open on the stretched face, where the bending is largest: a zigzag
				// across the band from that face to past its middle.
				const side = sPlus > sMinus ? 1 : -1;
				const at = { x: lerp(a.x, b.x, peak.u), y: lerp(a.y, b.y, peak.u) };
				const ux = -sn * side; // unit normal towards the stretched face (screen)
				const uy = -c * side;
				const tx = c; // unit tangent (screen)
				const ty = -sn;
				const pt = (n: number, tt: number) =>
					`${(at.x + ux * n + tx * tt).toFixed(1)} ${(at.y + uy * n + ty * tt).toFixed(1)}`;
				const h = hw / 2;
				crack = `M${pt(h + 3, 0)}L${pt(h * 0.45, 2.5)}L${pt(0, -2)}L${pt(-h * 0.45, 1.5)}`;
			}
			return {
				...base,
				hw,
				strips: [
					{ d: fmtPath(a, b, nx, ny), color: plus, w: fw },
					{ d: fmtPath(a, b), color: core, w: hw - 2 * fw },
					{ d: fmtPath(a, b, -nx, -ny), color: minus, w: fw }
				],
				color: core,
				crack
			};
		})
	);

	const worstIdx = $derived.by(() => {
		let k = -1;
		sol.members.forEach((r, i) => {
			if (k < 0 || r.utilisation > sol.members[k].utilisation) k = i;
		});
		return k;
	});
	const failTag = $derived.by(() => {
		if (unstable || worstIdx < 0 || sol.members[worstIdx].utilisation <= 1) return null;
		const d = members[worstIdx];
		const x = clamp((d.a.x + d.b.x) / 2, 70, 890);
		const y = Math.max(d.a.y, d.b.y) + 26;
		return { x, y };
	});

	// Joints (one path of round dots) and the supports.
	const jointDots = $derived(drawnJ.map((p) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`).join(''));
	const supports = $derived(
		s.joints
			.filter((j) => isAnchor(j))
			.map((j) => {
				const key = `${j.x},${j.y}`;
				const x = PX(j.x);
				const y = PY(j.y);
				if (isRoller(j)) return { key, kind: 'roller' as const, x, y, d: '' };
				const onWall = (j.x === 0 || j.x === SPAN) && j.y < 0 && j.y > -DEPTH;
				const k = 9;
				if (onWall) {
					const dir = j.x === 0 ? -1 : 1; // into the rock
					const bx = x + dir * k;
					return {
						key,
						kind: 'pin' as const,
						x,
						y,
						d: `M${x} ${y}L${bx} ${y - k * 0.7}L${bx} ${y + k * 0.7}Z`,
						hatch: `M${bx} ${y - k}L${bx} ${y + k}M${bx} ${y - 6}l${dir * 4} 3M${bx} ${y}l${dir * 4} 3M${bx} ${y + 6}l${dir * 4} 3`
					};
				}
				// On a bank top or the floor: the pin sits below, nudged onto the bank at the gap's edges.
				const cx = j.y === 0 && j.x === 0 ? x - 5 : j.y === 0 && j.x === SPAN ? x + 5 : x;
				return {
					key,
					kind: 'pin' as const,
					x,
					y,
					d: `M${x} ${y}L${cx - k * 0.7} ${y + k}L${cx + k * 0.7} ${y + k}Z`,
					hatch: `M${cx - k} ${y + k}L${cx + k} ${y + k}M${cx - 6} ${y + k}l-3 4M${cx} ${y + k}l-3 4M${cx + 6} ${y + k}l-3 4`
				};
			})
	);

	// ---- arch and suspension: forces on the ground ------------------------------------------
	/** Force (N, world) the structure's non-deck members exert on an anchor joint. */
	function forceOn(jx: number, jy: number, kind?: MemberKind) {
		const ji = s.joints.findIndex((j) => j.x === jx && Math.abs(j.y - jy) < 1e-6);
		if (ji < 0) return null;
		let fx = 0;
		let fy = 0;
		s.members.forEach((m, i) => {
			if ((m.a !== ji && m.b !== ji) || isDeck(s, m) || (kind && m.kind !== kind)) return;
			const o = s.joints[m.a === ji ? m.b : m.a];
			const j = s.joints[ji];
			const len = Math.hypot(o.x - j.x, o.y - j.y);
			const ax = sol.members[i].axial;
			fx += ((o.x - j.x) / len) * ax;
			fy += ((o.y - j.y) / len) * ax;
		});
		const mag = Math.hypot(fx, fy);
		return mag < 1 ? null : { ux: fx / mag, uy: fy / mag, mag };
	}
	const kN = (n: number) => `${Math.round(Math.abs(n) / 1000)} kN`;

	const groundArrows = $derived.by(() => {
		if (unstable) return [];
		const out: {
			key: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			lines: string[];
			lx: number;
			ly: number;
			anchor: 'start' | 'end';
			color: string;
		}[] = [];
		if (designId === 'arch') {
			for (const [x, side] of [
				[0, -1],
				[SPAN, 1]
			] as const) {
				const f = forceOn(x, -10);
				if (!f) continue;
				const sx = PX(x);
				const sy = PY(-10);
				// Arrow tip pressing into the wall, along the push.
				out.push({
					key: `arch${x}`,
					x1: sx + 3 * f.ux,
					y1: sy - 3 * f.uy,
					x2: sx + 40 * f.ux,
					y2: sy - 40 * f.uy,
					lines: ['pushes down and', 'outwards on the rock', kN(f.mag)],
					lx: sx + side * 24,
					ly: sy - 44,
					anchor: side < 0 ? 'end' : 'start',
					color: 'var(--struct-compression)'
				});
			}
		}
		if (designId === 'suspension') {
			for (const [x, side] of [
				[-12.5, -1],
				[SPAN + 12.5, 1]
			] as const) {
				const f = forceOn(x, 0, 'cable');
				if (!f) continue;
				const sx = PX(x);
				const sy = PY(0);
				// The cable pulls the anchor up and inwards: the arrow ends at the anchor.
				out.push({
					key: `anchor${x}`,
					x1: sx - 42 * f.ux,
					y1: sy + 42 * f.uy,
					x2: sx - 4 * f.ux,
					y2: sy + 4 * f.uy,
					lines: ['anchor pulled', kN(f.mag)],
					lx: sx - 42 * f.ux + (side < 0 ? 4 : -4),
					ly: sy + 42 * f.uy + 18,
					anchor: side < 0 ? 'start' : 'end',
					color: 'var(--struct-tension)'
				});
			}
			for (const [x, side] of [
				[0, -1],
				[SPAN, 1]
			] as const) {
				const f = forceOn(x, 0, 'beam');
				if (!f) continue;
				const sx = PX(x) + side * 6;
				const sy = PY(0);
				out.push({
					key: `tower${x}`,
					x1: sx,
					y1: sy + 6,
					x2: sx,
					y2: sy + 44,
					lines: ['tower pushed down', kN(f.mag)],
					lx: sx + side * 10,
					ly: sy + 98,
					anchor: side < 0 ? 'end' : 'start',
					color: 'var(--struct-compression)'
				});
			}
		}
		return out;
	});

	// ---- readouts --------------------------------------------------------------------------
	const pct = (u: number) => `${Math.round(u * 100)}%`;
	const nowWorst = $derived(unstable ? NaN : sol.worst);
	const envWorst = $derived(an.env.unstable ? NaN : an.env.worst);
	const memberCount = $derived(s.members.length);
	const typicalWidth = $derived.by(() => {
		const ws = an.areas.map((A) => boxSection(A).w).sort((x, y) => x - y);
		return ws.length ? ws[Math.floor(ws.length / 2)] : 0;
	});
	const subtitle = $derived(
		editing && memberCount === 0
			? `${BUDGET / 1000} t of steel, nothing built yet`
			: editing
				? `${BUDGET / 1000} t shared by ${memberCount} member${memberCount === 1 ? '' : 's'} — each about ${Math.round(typicalWidth * 100)} cm wide`
				: `${BUDGET / 1000} t of steel · ${memberCount} members · ${SPAN} m gap`
	);

	function partName(i: number) {
		const m = s.members[i];
		if (m.kind === 'cable') return 'a cable';
		if (isDeck(s, m)) {
			const lo = Math.min(s.joints[m.a].x, s.joints[m.b].x);
			const hi = Math.max(s.joints[m.a].x, s.joints[m.b].x);
			return truck.x >= lo - 3 && truck.x <= hi + 3 ? 'the road under the truck' : 'the road';
		}
		const p = s.joints[m.a];
		const q = s.joints[m.b];
		if (Math.abs(p.x - q.x) < 1e-6) return 'a post';
		return 'a member';
	}
	const modeWord = (r: MemberResult) =>
		r.mode === 'bending'
			? 'bent past its limit'
			: r.mode === 'buckling'
				? 'would buckle'
				: r.mode === 'compression'
					? 'pushed past its limit'
					: 'pulled past its limit';

	const note = $derived.by((): { text: string; sub: string; bad: boolean } => {
		if (editing && unstable)
			return {
				text: "This structure can't hold itself up",
				sub: 'It would fold: add triangles or supports.',
				bad: true
			};
		if (editing && sol.gapInDeck)
			return {
				text: "The road has a gap — the truck can't cross",
				sub: 'Every metre of road needs a beam under it.',
				bad: true
			};
		if (nowWorst > 1 && worstIdx >= 0)
			return {
				text: `Fails: ${partName(worstIdx)} — ${modeWord(sol.members[worstIdx])}`,
				sub:
					sol.members[worstIdx].mode === 'bending'
						? 'Top squashed, bottom stretched, beyond what steel takes.'
						: 'Marked “would fail” in the drawing.',
				bad: true
			};
		if (envWorst > 1)
			return {
				text: 'Fails once the truck is on it',
				sub: `It holds its own weight (${pct(nowWorst)} now).`,
				bad: true
			};
		const idle = sol.members.filter((r) => r.unsupported).length;
		return {
			text: 'Every member within its limit',
			sub: idle
				? `${idle === 1 ? 'One member is' : `${idle} members are`} not joined to the ground: wasted steel.`
				: `Steel to spare: the busiest part reaches ${Number.isFinite(envWorst) ? pct(envWorst) : '—'}.`,
			bad: false
		};
	});

	const captions: Record<string, string[]> = {
		beam: ['Under the truck the beam bends:', 'top squashed (red), bottom stretched (blue).'],
		truss: [
			'Top chord pushed, bottom chord pulled;',
			'the diagonals take turns as the truck passes.'
		],
		arch: ['The rib is pushed all along its curve', 'and pushes down and outwards on the rock.'],
		suspension: ['Main cable and hangers pulled,', 'towers pushed down, anchors pulled up.']
	};
	const tool = $derived(String(params.tool ?? 'beam'));
	const toolLines = $derived(
		tool === 'erase'
			? ['Click a member to remove it.', 'Keyboard: Tab to a member, then Delete.']
			: [
					`Drag from point to point to add a ${tool}.`,
					'Keyboard: Tab to a joint, Enter, arrows, Enter.'
				]
	);

	// Compare: every design's worst over a crossing.
	const compareRows = $derived(
		phase === 'compare' ? ORDER.map((id) => ({ id, worst: designAnalysis(id).env.worst })) : []
	);
	const CMP_X0 = 450;
	const CMP_W = 180;
	const CMP_MAX = 1.4;

	// ---- hover / focus tooltips --------------------------------------------------------------
	let hoverIdx = $state<number | null>(null);
	let focusKey = $state<string | null>(null);
	const tipIdx = $derived.by(() => {
		if (focusKey) {
			const k = members.findIndex((d) => d.key === focusKey);
			if (k >= 0) return k;
		}
		return hoverIdx !== null && hoverIdx < members.length ? hoverIdx : null;
	});
	function describe(i: number, long: boolean) {
		const m = s.members[i];
		const r = sol.members[i];
		const kind = m.kind === 'beam' ? 'Beam' : 'Cable';
		if (unstable) return `${kind} — the structure can't stand`;
		if (r.unsupported) return `${kind} — not joined to the ground: carries nothing`;
		if (r.slack) return `${kind} — slack: it would have to push, so it carries nothing`;
		const dir =
			Math.abs(r.axial) < 500 ? 'barely pulled or pushed' : r.axial > 0 ? 'pulled' : 'pushed';
		const extra =
			r.mode === 'bending' ? ' (bending)' : r.mode === 'buckling' ? ' (would buckle)' : '';
		if (!long) return `${kind}, ${dir}, ${pct(r.utilisation)} of its limit${extra}`;
		const force = Math.abs(r.axial) < 500 ? '' : `, ${kN(r.axial)}`;
		return `${kind} — ${dir}${force}, ${pct(r.utilisation)} of its limit${extra}`;
	}
	const tip = $derived.by(() => {
		if (tipIdx === null || dragFrom) return null;
		const d = members[tipIdx];
		const text = describe(tipIdx, true);
		const w = text.length * 12 * 0.58 + 14;
		const x = clamp((d.a.x + d.b.x) / 2, L + w / 2, R - w / 2);
		const y = Math.max(28, Math.min(d.a.y, d.b.y) - 16);
		return { text, x, y };
	});

	// ---- editing ------------------------------------------------------------------------------
	const valid = (p: Joint) =>
		p.x >= -12.5 - 1e-6 &&
		p.x <= SPAN + 12.5 + 1e-6 &&
		p.y >= -DEPTH - 1e-6 &&
		p.y <= 17.5 + 1e-6 &&
		!(p.y < -1e-6 && (p.x < -1e-6 || p.x > SPAN + 1e-6));
	const snapG = (v: number) => Math.round(v / GRID) * GRID;
	/** The nearest usable grid point to a world point. */
	function nearestGrid(x: number, y: number): Joint {
		let p = { x: clamp(snapG(x), -12.5, SPAN + 12.5), y: clamp(snapG(y), -DEPTH, 17.5) };
		if (!valid(p)) {
			// Inside the rock: onto the wall or onto the bank top, whichever is nearer.
			const wall = p.x < 0 ? 0 : SPAN;
			p = Math.abs(x - wall) < Math.abs(y) ? { x: wall, y: p.y } : { x: p.x, y: 0 };
		}
		return p;
	}
	const gridPath = (() => {
		let d = '';
		for (let x = -12.5; x <= SPAN + 12.5 + 1e-6; x += GRID)
			for (let y = -DEPTH; y <= 17.5 + 1e-6; y += GRID) {
				const p = { x, y };
				if (valid(p) && !isAnchor(p)) d += `M${PX(x)} ${PY(y)}h0`;
			}
		return d;
	})();
	const anchorPath = (() => {
		let d = '';
		for (let x = -12.5; x <= SPAN + 12.5 + 1e-6; x += GRID)
			for (let y = -DEPTH; y <= 0 + 1e-6; y += GRID)
				if (isAnchor({ x, y })) d += `M${PX(x)} ${PY(y)}h0`;
		return d;
	})();

	let sel = $state<Joint | null>(null);
	let cursor = $state<Joint | null>(null);
	let dragFrom = $state<Joint | null>(null);
	let dragTo = $state<Joint | null>(null);

	$effect(() => {
		void tool;
		void editing;
		untrack(() => {
			sel = null;
			cursor = null;
		});
	});

	function commit(next: typeof built) {
		setParam('bridge:build', serializeStructure(next));
	}
	/**
	 * Joins members that pass straight through a joint at that joint: a pier drawn up to
	 * the middle of a road segment holds the road, and a long beam drawn over existing
	 * joints is connected to them. (`addMember` only connects at a member's two ends.)
	 */
	function joinThrough(st: Structure): Structure {
		for (let guard = 0; guard < 200; guard++) {
			let split: { i: number; j: Joint } | null = null;
			for (let i = 0; i < st.members.length && !split; i++) {
				const m = st.members[i];
				const pa = st.joints[m.a];
				const pb = st.joints[m.b];
				const vx = pb.x - pa.x;
				const vy = pb.y - pa.y;
				const len2 = vx * vx + vy * vy;
				for (const j of st.joints) {
					const wx = j.x - pa.x;
					const wy = j.y - pa.y;
					const u = (wx * vx + wy * vy) / len2;
					if (u > 1e-6 && u < 1 - 1e-6 && Math.abs(wx * vy - wy * vx) < 1e-6 * len2) {
						split = { i, j };
						break;
					}
				}
			}
			if (!split) return st;
			const m = st.members[split.i];
			const pa = st.joints[m.a];
			const pb = st.joints[m.b];
			st = removeMember(st, split.i);
			st = addMember(st, m.kind, pa, split.j);
			st = addMember(st, m.kind, split.j, pb);
		}
		return st;
	}
	function addBetween(p: Joint, q: Joint) {
		if (p.x === q.x && p.y === q.y) return;
		commit(joinThrough(addMember(built, tool === 'cable' ? 'cable' : 'beam', p, q)));
	}
	function eraseAt(i: number) {
		commit(removeMember(built, i));
		hoverIdx = null;
		focusKey = null;
	}

	/** The member nearest a screen point, within a few pixels. */
	function hit(p: Point): number | null {
		let best: number | null = null;
		let bestD = Infinity;
		members.forEach((d, i) => {
			const vx = d.b.x - d.a.x;
			const vy = d.b.y - d.a.y;
			const len2 = vx * vx + vy * vy || 1;
			const u = clamp(((p.x - d.a.x) * vx + (p.y - d.a.y) * vy) / len2);
			const dist = Math.hypot(d.a.x + u * vx - p.x, d.a.y + u * vy - p.y);
			if (dist < Math.max(8, d.hw / 2 + 4) && dist < bestD) {
				bestD = dist;
				best = i;
			}
		});
		return best;
	}

	function onpointermove(e: PointerEvent) {
		if (dragFrom) return;
		hoverIdx = hit(toSvg(e, e.currentTarget as Element));
	}
	function onpointerdown(e: PointerEvent) {
		if (!editing) return;
		const at = toSvg(e, e.currentTarget as Element);
		if (tool === 'erase') {
			const i = hit(at);
			if (i !== null && e.button === 0) eraseAt(i);
			return;
		}
		sel = null;
		cursor = null;
		startDrag(
			e,
			(p) => {
				const g = nearestGrid(WX(p.x), WY(p.y));
				if (!dragFrom) dragFrom = g;
				dragTo = g;
			},
			() => {
				if (dragFrom && dragTo) addBetween(dragFrom, dragTo);
				dragFrom = null;
				dragTo = null;
			}
		);
	}

	// Keyboard targets: every joint, plus the road's two ends when there are none.
	const focusJoints = $derived.by(() => {
		const list = s.joints.map((j) => ({ ...j, joint: true }));
		for (const p of [
			{ x: 0, y: 0 },
			{ x: SPAN, y: 0 }
		])
			if (!list.some((j) => j.x === p.x && j.y === p.y)) list.push({ ...p, joint: false });
		return list;
	});
	const num = (v: number) => `${+v.toFixed(2)}`.replace('-', '−');
	const same = (p: Joint | null, q: Joint | null) => !!p && !!q && p.x === q.x && p.y === q.y;

	function onJointKey(e: KeyboardEvent, j: Joint) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-GRID, 0],
			ArrowRight: [GRID, 0],
			ArrowUp: [0, GRID],
			ArrowDown: [0, -GRID]
		};
		if (e.key === 'Escape') {
			e.preventDefault();
			sel = null;
			cursor = null;
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!sel || !same(sel, { x: j.x, y: j.y })) {
				sel = { x: j.x, y: j.y };
				cursor = { x: j.x, y: j.y };
			} else if (cursor && !same(cursor, sel)) {
				addBetween(sel, cursor);
				sel = null;
				cursor = null;
			} else {
				sel = null;
				cursor = null;
			}
		} else if (moves[e.key]) {
			e.preventDefault();
			if (!sel || !same(sel, { x: j.x, y: j.y })) {
				sel = { x: j.x, y: j.y };
				cursor = { x: j.x, y: j.y };
			}
			const [dx, dy] = moves[e.key];
			const next = { x: cursor!.x + dx, y: cursor!.y + dy };
			if (valid(next)) cursor = next;
		}
	}
	function onMemberKey(e: KeyboardEvent, i: number) {
		if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			eraseAt(i);
		}
	}

	const band = $derived(
		dragFrom && dragTo ? { p: dragFrom, q: dragTo } : sel && cursor ? { p: sel, q: cursor } : null
	);

	// ---- legend -------------------------------------------------------------------------------
	const LG_X = 700;
	const sagNow = $derived(unstable ? 0 : sol.maxDeflection);
	const sagText = $derived(
		sagNow >= 0.995 ? `${sagNow.toFixed(1)} m` : `${Math.max(0.1, sagNow * 100).toFixed(1)} cm`
	);
	const BAR_W = 300;
	const barLen = (u: number) => BAR_W * clamp(u / 1.5);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet meter(x: number, y: number, label: string, u: number)}
	{@render txt(x, y, label, 12, { muted: true })}
	{@render txt(x + BAR_W, y, Number.isFinite(u) ? pct(u) : '—', 13, {
		anchor: 'end',
		weight: 700,
		tabular: true
	})}
	<rect {x} y={y + 6} width={BAR_W} height="6" rx="3" fill="var(--stage-line)" opacity="0.35" />
	<rect
		{x}
		y={y + 6}
		width={Math.max(3, Number.isFinite(u) ? barLen(u) : 0)}
		height="6"
		rx="3"
		fill={u > 1 ? 'var(--struct-fail)' : 'var(--stage-ink-muted)'}
	/>
	<line
		x1={x + barLen(1)}
		x2={x + barLen(1)}
		y1={y + 3}
		y2={y + 15}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
{/snippet}

<g>
	<defs>
		{#each ['tension', 'compression'] as hue (hue)}
			<linearGradient id="bridge-scale-{hue}" x1="0" x2="1">
				{#each SCALE_STOPS as st (st.u)}
					<stop
						offset={st.u}
						style:stop-color="color-mix(in oklab, var(--struct-{hue}) {st.pct}%,
						var(--struct-steel))"
					/>
				{/each}
			</linearGradient>
		{/each}
	</defs>

	<!-- ground: the banks, the gap and its floor -->
	<rect x={PX(0)} y={PY(0)} width={SPAN * S} height={DEPTH * S} fill="var(--struct-gap)" />
	<path
		d="M{L} {PY(0)}H{PX(0)}V{PY(-DEPTH)}H{PX(SPAN)}V{PY(0)}H{R}V{GROUND_BOTTOM}H{L}Z"
		fill="var(--struct-ground)"
	/>
	<path
		d="M{L} {PY(0)}H{PX(0)}V{PY(-DEPTH)}H{PX(SPAN)}V{PY(0)}H{R}"
		fill="none"
		stroke="var(--struct-ground-edge)"
		stroke-width="2"
	/>
	<!-- the approach roads on the banks -->
	<path
		d="M{L} {PY(0) - 1.5}H{PX(0)}M{PX(SPAN)} {PY(0) - 1.5}H{R}"
		stroke="var(--struct-road)"
		stroke-width="3"
	/>

	{#if editing}
		<path
			d={gridPath}
			stroke="var(--stage-ink-muted)"
			stroke-width="2.6"
			stroke-linecap="round"
			opacity="0.4"
		/>
		<path
			d={anchorPath}
			stroke="var(--struct-ground-edge)"
			stroke-width="6"
			stroke-linecap="round"
			opacity="0.9"
		/>
		{#if ghost}
			<path
				d={ghost}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.8"
			/>
		{/if}
	{/if}

	<!-- the truck -->
	<g
		transform="translate({truckDraw.sx} {truckDraw.sy}) rotate({truckDraw.angle})"
		opacity={truck.o}
		style:pointer-events="none"
	>
		<rect
			x="-56"
			y="-46"
			width="78"
			height="36"
			rx="3"
			fill="var(--surface)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<path
			d="M25 -10V-30Q25 -38 33 -38H46Q50 -38 52 -33L56 -24V-10Z"
			fill="var(--stage-ink-muted)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<path d="M38 -35H47L51 -26H38Z" fill="var(--struct-gap)" />
		<rect x="-57" y="-11" width="114" height="4" rx="1.5" fill="var(--stage-ink)" />
		{#each [-45, -31, 43] as wx (wx)}
			<circle
				cx={wx}
				cy="-6"
				r="6"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
		{@render txt(-17, -23, '30 t', 13, { anchor: 'middle', weight: 700 })}
	</g>

	<!-- the structure -->
	<g opacity={fade.current} style:pointer-events="none">
		{#each members as d (d.key)}
			{#if d.fail}
				<path
					d={fmtPath(d.a, d.b)}
					stroke="var(--struct-fail)"
					stroke-width={d.hw + 8}
					stroke-linecap="round"
					opacity="0.55"
				/>
			{/if}
		{/each}
		{#each members as d (d.key)}
			<g opacity={d.opacity}>
				{#if d.strips.length && !d.dash}
					{#each d.strips as h, k (k)}
						<path d={h.d} stroke={h.color} stroke-width={h.w + 0.3} />
					{/each}
				{:else}
					<path
						d={fmtPath(d.a, d.b)}
						stroke={d.color}
						stroke-width={d.kind === 'cable' ? d.hw : d.hw}
						stroke-dasharray={d.dash}
						stroke-linecap="round"
					/>
				{/if}
			</g>
		{/each}
		{#each members as d (d.key)}
			{#if d.crack}
				<path
					d={d.crack}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.8"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/if}
		{/each}
		<path d={jointDots} stroke="var(--stage-ink)" stroke-width="4.5" stroke-linecap="round" />
	</g>

	<!-- supports -->
	{#each supports as sp (sp.key)}
		{#if sp.kind === 'roller'}
			<circle
				cx={sp.x + 5}
				cy={sp.y + 5.5}
				r="4"
				fill="var(--surface)"
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			<path d="M{sp.x - 3} {sp.y + 10.5}h17" stroke="var(--stage-ink)" stroke-width="1.5" />
		{:else}
			<path d={sp.d} fill="var(--surface)" stroke="var(--stage-ink)" stroke-width="1.3" />
			<path d={sp.hatch} fill="none" stroke="var(--stage-ink)" stroke-width="1.1" />
		{/if}
	{/each}

	<!-- forces on the ground (arch, suspension) -->
	{#each groundArrows as ga (ga.key)}
		<line
			x1={ga.x1}
			y1={ga.y1}
			x2={ga.x2}
			y2={ga.y2}
			stroke={ga.color}
			stroke-width="3"
			marker-end="url(#arrowhead)"
			opacity={fade.current}
		/>
		{@const w = Math.max(...ga.lines.map((l) => l.length)) * 6.5 + 14}
		<!-- a card behind the label: it sits on the rock -->
		<rect
			x={ga.anchor === 'end' ? ga.lx - w + 7 : ga.lx - 7}
			y={ga.ly - 14}
			width={w}
			height={ga.lines.length * 15 + 6}
			rx="6"
			fill="var(--surface)"
			opacity={0.9 * fade.current}
		/>
		{#each ga.lines as line, k (k)}
			{@render txt(ga.lx, ga.ly + k * 15, line, k === ga.lines.length - 1 ? 11 : 12, {
				anchor: ga.anchor,
				weight: k === ga.lines.length - 1 ? 500 : 600,
				muted: k === ga.lines.length - 1,
				opacity: fade.current
			})}
		{/each}
	{/each}

	{#if failTag}
		<g style:pointer-events="none">
			<rect
				x={failTag.x - 40}
				y={failTag.y - 13}
				width="80"
				height="20"
				rx="10"
				fill="var(--surface)"
				stroke="var(--struct-fail)"
				stroke-width="2"
			/>
			{@render txt(failTag.x, failTag.y + 1, 'would fail', 12, { anchor: 'middle', weight: 700 })}
		</g>
	{/if}

	<!-- rubber band while adding a member -->
	{#if editing && band}
		<g style:pointer-events="none">
			<line
				x1={PX(band.p.x)}
				y1={PY(band.p.y)}
				x2={PX(band.q.x)}
				y2={PY(band.q.y)}
				stroke={tool === 'cable' ? 'var(--struct-cable)' : 'var(--stage-ink)'}
				stroke-width={tool === 'cable' ? 2 : 4}
				stroke-dasharray="6 4"
				opacity="0.75"
			/>
			<circle
				cx={PX(band.p.x)}
				cy={PY(band.p.y)}
				r="7"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
			<circle
				cx={PX(band.q.x)}
				cy={PY(band.q.y)}
				r="9"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
		</g>
	{/if}

	<!-- pointer: hover for every step, drawing and erasing on build -->
	<rect
		x={L}
		y={L}
		width={R - L}
		height={GROUND_BOTTOM - L}
		fill="transparent"
		class="surface"
		class:editing
		class:draw={editing && tool !== 'erase'}
		class:erase={editing && tool === 'erase' && hoverIdx !== null}
		role="presentation"
		{onpointermove}
		onpointerleave={() => (hoverIdx = null)}
		{onpointerdown}
	/>

	<!-- keyboard: joints (drawing tools) or members (eraser) -->
	{#if editing && tool !== 'erase'}
		{#each focusJoints as j (`${j.x},${j.y}`)}
			{@const picked = same(sel, j)}
			<circle
				class="kbd"
				cx={PX(j.x)}
				cy={PY(j.y)}
				r="8"
				fill="transparent"
				stroke={picked ? 'var(--focus)' : 'none'}
				stroke-width="2"
				role="button"
				tabindex="0"
				aria-pressed={picked}
				aria-label="{j.joint ? 'Joint' : 'Point'} at {num(j.x)} m, {num(j.y)} m"
				onkeydown={(e) => onJointKey(e, j)}
				onblur={() => {
					if (picked && !dragFrom) {
						sel = null;
						cursor = null;
					}
				}}
			/>
		{/each}
	{:else}
		<!-- members: focus one for its tooltip; with the eraser, Delete removes it -->
		{#each members as d (d.key)}
			<line
				class="kbd"
				x1={d.a.x}
				y1={d.a.y}
				x2={d.b.x}
				y2={d.b.y}
				stroke="transparent"
				stroke-width="12"
				role="button"
				tabindex="0"
				aria-label={describe(d.i, false)}
				onfocus={() => (focusKey = d.key)}
				onblur={() => (focusKey = null)}
				onkeydown={(e) => editing && onMemberKey(e, d.i)}
			/>
		{/each}
	{/if}

	{#if tip}
		<g style:pointer-events="none">
			<rect
				x={tip.x - (tip.text.length * 12 * 0.58 + 14) / 2}
				y={tip.y - 15}
				width={tip.text.length * 12 * 0.58 + 14}
				height="22"
				rx="11"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(tip.x, tip.y, tip.text, 12, { anchor: 'middle', weight: 600 })}
		</g>
	{/if}

	<!-- ===================== bottom strip ===================== -->
	<!-- readout card -->
	<g>
		<rect
			x={L}
			y="436"
			width="336"
			height="148"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(L + 16, 458, NAMES[designId] ?? 'Bridge', 15, { weight: 700 })}
		{@render txt(L + 16, 475, subtitle, 11, { muted: true })}
		{@render meter(L + 18, 497, 'Busiest member now', nowWorst)}
		{@render meter(L + 18, 527, 'Busiest member as the truck crosses', envWorst)}
		{#if note.bad}
			<circle cx={L + 8} cy="556" r="4" fill="var(--struct-fail)" />
		{/if}
		{@render txt(L + 16, 560, note.text, 12, { weight: 700 })}
		{@render txt(L + 16, 576, note.sub, 11, { muted: true })}
	</g>

	<!-- middle: captions, the comparison chart or the build tool -->
	{#if phase === 'compare'}
		<g>
			{@render txt(368, 452, 'Busiest member over a crossing', 13, { weight: 700 })}
			<line
				x1={CMP_X0 + (CMP_W * 1) / CMP_MAX}
				x2={CMP_X0 + (CMP_W * 1) / CMP_MAX}
				y1="460"
				y2="560"
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				stroke-dasharray="3 3"
			/>
			{@render txt(CMP_X0 + (CMP_W * 1) / CMP_MAX + 4, 470, 'limit', 11, { muted: true })}
			{#each compareRows as row, k (row.id)}
				{@const y = 474 + k * 22}
				{@const on = row.id === designId}
				<g
					class="pick"
					role="button"
					tabindex="0"
					aria-label="Show the {SHORT[row.id].toLowerCase()} bridge: busiest member {pct(
						row.worst
					)} of its limit"
					aria-pressed={on}
					onclick={() => setParam('design', row.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							setParam('design', row.id);
						}
					}}
				>
					<rect
						x="364"
						y={y - 2}
						width="320"
						height="20"
						rx="4"
						fill="transparent"
						class="pick-bg"
					/>
					{@render txt(370, y + 12, SHORT[row.id], 12, { weight: on ? 700 : 500, muted: !on })}
					<rect
						x={CMP_X0}
						y={y + 2}
						width={Math.max(3, (CMP_W * Math.min(row.worst, CMP_MAX)) / CMP_MAX)}
						height="12"
						rx="3"
						fill={row.worst > 1 ? 'var(--struct-fail)' : 'var(--stage-ink-muted)'}
						opacity={on ? 1 : 0.45}
					/>
					{@render txt(CMP_X0 + CMP_W + 8, y + 12, pct(row.worst), 12, {
						weight: on ? 700 : 500,
						tabular: true,
						muted: !on
					})}
				</g>
			{/each}
			{@render txt(368, 576, 'Same gap, same 25 t of steel: only the shape differs.', 12, {
				weight: 600
			})}
		</g>
	{:else if editing}
		<g>
			{@render txt(
				368,
				458,
				tool === 'erase' ? 'Eraser' : tool === 'cable' ? 'Cable tool' : 'Beam tool',
				13,
				{
					weight: 700
				}
			)}
			{@render txt(368, 478, toolLines[0], 12)}
			{@render txt(368, 496, toolLines[1], 11, { muted: true })}
			{@render txt(368, 522, 'Ground points (dark) hold whatever touches them.', 11, {
				muted: true
			})}
			{@render txt(368, 540, 'Cables can only pull; beams pull, push and bend.', 11, {
				muted: true
			})}
			{@render txt(368, 566, 'Same 25 t of steel, however many members.', 12, { weight: 600 })}
		</g>
	{:else}
		<g>
			{#each captions[phase] ?? [] as line, k (k)}
				{@render txt(368, 458 + k * 18, line, 12, { weight: k === 0 ? 600 : 500 })}
			{/each}
			{@render txt(368, 520, 'Point at a member to see its force.', 11, { muted: true })}
			{@render txt(368, 566, 'Same 25 t of steel, same 40 m gap for every design.', 12, {
				weight: 600
			})}
		</g>
	{/if}

	<!-- legend -->
	<g style:pointer-events="none">
		<path d="M{LG_X} 452h26" stroke="var(--struct-tension)" stroke-width="5" />
		{@render txt(LG_X + 34, 456, 'pulled (tension)', 12)}
		<path d="M{LG_X} 474h26" stroke="var(--struct-compression)" stroke-width="5" />
		{@render txt(LG_X + 34, 478, 'pushed (compression)', 12)}
		<path
			d="M{LG_X} 496h26"
			stroke="var(--struct-fail)"
			stroke-width="11"
			stroke-linecap="round"
			opacity="0.55"
		/>
		<path d="M{LG_X} 496h26" stroke="var(--struct-compression)" stroke-width="4" />
		{@render txt(LG_X + 34, 500, 'would fail (over 100%)', 12)}
		{@render txt(LG_X, 524, 'how hard it works', 11, { muted: true })}
		<rect x={LG_X} y="530" width="120" height="5" rx="2" fill="url(#bridge-scale-tension)" />
		<rect x={LG_X} y="537" width="120" height="5" rx="2" fill="url(#bridge-scale-compression)" />
		{@render txt(LG_X, 556, '0%', 11, { muted: true })}
		{@render txt(LG_X + 120, 556, '100% of its limit', 11, { muted: true, anchor: 'middle' })}
		{@render txt(
			LG_X,
			578,
			unstable
				? 'no bent shape: it would fold up'
				: editing
					? `dashed: bent shape × ${an.factor} (sag ${sagText})`
					: `bending drawn × ${an.factor} (real sag ${sagText})`,
			11,
			{ muted: true }
		)}
	</g>
</g>

<style>
	.surface.editing {
		touch-action: none;
	}
	.surface.draw {
		cursor: crosshair;
	}
	.surface.erase {
		cursor: pointer;
	}
	.kbd {
		outline: none;
		pointer-events: none;
	}
	.kbd:focus-visible {
		stroke: var(--focus);
		stroke-opacity: 0.8;
	}
	circle.kbd:focus-visible {
		stroke-width: 2.5;
	}
	.pick {
		cursor: pointer;
		outline: none;
	}
	.pick:hover .pick-bg,
	.pick:focus-visible .pick-bg {
		fill: var(--stage-grid);
	}
	.pick:focus-visible .pick-bg {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
