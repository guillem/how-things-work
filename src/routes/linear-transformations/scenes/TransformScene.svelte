<script lang="ts">
	/**
	 * The plane moved by a 2 × 2 matrix, with draggable î and ĵ (every step from
	 * "transform" on).
	 *
	 * The matrix lives in `params.a`, `params.b`, `params.c`, `params.d`
	 * ([[a, b], [c, d]]: î lands on (a, c), ĵ on (b, d)); the handles write
	 * them, rounded to the sliders' step of 0.1. Steps with `hints.load` put an
	 * example matrix there when the step opens (and when its "Example" menu
	 * changes). What is drawn eases towards the params with a tween, except
	 * while a handle is dragged.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   drag    — the grid moves from the square grid to the matrix (a function
	 *             of t), then follows the handles
	 *   follow  — v (params.vx, vy) where it was, and where it lands, built from
	 *             x copies of the moved î and y of the moved ĵ
	 *   matrix  — the matrix times v, worked out in numbers
	 *   gallery — a named example
	 *   area    — the unit square and the F, and their areas: the determinant
	 *   flip    — the same, moving in from the square grid so the flip shows
	 *   eigen   — a thin arrow sweeping round with its image; eigen-directions
	 *   special — eigen-directions of named examples (none, one, all, two)
	 *   repeat  — v, Mv, M²v, … drawn as directions, appearing one by one
	 *   compose — a rotation then a shear (or the other way), in a loop
	 *   all     — everything, with both toggles
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		I2,
		angleOf,
		apply,
		col1,
		col2,
		compose,
		det,
		eigen,
		iterate,
		lerpMat,
		length,
		mat,
		num,
		rank,
		rotation,
		round1,
		shear,
		signedArea,
		vec,
		type Mat,
		type Vec
	} from '../matrix';
	import { R, S, examples, loads, specials, type Preset } from '../presets';
	import Arrow from './Arrow.svelte';
	import T from './T.svelte';
	import VectorHandle from './VectorHandle.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ------------------------------------------------------------------
	const CX = 300;
	const CY = 300;
	const U = 56; // one unit, in stage units
	const EDGE = 16; // the plane is clipped to the square 16…584
	const sx = (x: number) => CX + x * U;
	const sy = (y: number) => CY - y * U;
	const P = (v: Vec): Point => ({ x: sx(v.x), y: sy(v.y) });
	const O = P(vec(0, 0));
	const PX = 624; // readout panel
	const BASE = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

	// ---- phases ----------------------------------------------------------------------
	const phases = [
		'drag',
		'follow',
		'matrix',
		'gallery',
		'area',
		'flip',
		'eigen',
		'special',
		'repeat',
		'compose',
		'all'
	] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'drag') as Phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived(
		Object.fromEntries(phases.map((p) => [p, weights[p].current])) as Record<Phase, number>
	);
	const panel = (v: number) => smoothstep(0.5, 1, v);
	const showArea = $derived(params.area !== false);
	const showEigen = $derived(params.eigen !== false);
	// How strongly each overlay is drawn: only on the steps that offer its toggle.
	const areaW = $derived((w.area + w.flip + w.all) * (showArea ? 1 : 0));
	const eigenW = $derived((w.eigen + w.special + w.repeat + w.all) * (showEigen ? 1 : 0));

	// ---- the matrix ------------------------------------------------------------------
	const LIM = 3; // entries run from −3 to 3, like the sliders
	const entry = (id: string, fallback: number) => clamp(Number(params[id] ?? fallback), -LIM, LIM);
	const target = $derived(mat(entry('a', 1.5), entry('b', -0.5), entry('c', 0.5), entry('d', 1)));

	let dragging = $state(false);
	const shown = new Tween<Mat>(
		untrack(() => target),
		{ duration: 600, easing: cubicInOut }
	);
	$effect(() => {
		const m = target;
		untrack(() => {
			const jump = Math.max(
				Math.abs(m.a - shown.target.a),
				Math.abs(m.b - shown.target.b),
				Math.abs(m.c - shown.target.c),
				Math.abs(m.d - shown.target.d)
			);
			shown.set(m, { duration: dragging || reduced ? 0 : jump < 0.3 ? 250 : 650 });
		});
	});

	function setMatrix(m: Mat) {
		setParam('a', m.a);
		setParam('b', m.b);
		setParam('c', m.c);
		setParam('d', m.d);
	}
	// Example matrices: loaded when a step that names one opens, or when its menu changes.
	$effect(() => {
		const load = step.hints?.load;
		void step.id;
		const pick =
			load === 'example'
				? examples[String(params.example)]?.m
				: load === 'special'
					? specials[String(params.special)]?.m
					: typeof load === 'string'
						? loads[load]
						: undefined;
		if (pick) untrack(() => setMatrix(pick));
	});

	// The intro: on "drag" and "flip" the plane moves in from the square grid.
	const intro = $derived(
		reduced
			? 1
			: phase === 'drag'
				? smoothstep(0.4, 2.2, t)
				: phase === 'flip'
					? smoothstep(0.6, 4, t)
					: 1
	);

	// ---- phase compose: first one move, then the other, in a 9 s loop ----------------
	const composeOrder = $derived(params.order === 'sr' ? 'sr' : 'rs');
	const firstIs = $derived(composeOrder === 'rs' ? 'rotate' : 'shear');
	const stageOf = (kind: string, s: number) => (kind === 'rotate' ? rotation(90 * s) : shear(s));
	const ct = $derived(reduced ? 9 : t % 9);
	const s1 = $derived(smoothstep(1, 3, ct));
	const s2 = $derived(smoothstep(4.5, 6.5, ct));
	const composeM = $derived(
		compose(stageOf(firstIs === 'rotate' ? 'shear' : 'rotate', s2), stageOf(firstIs, s1))
	);
	const product = $derived(composeOrder === 'rs' ? compose(S, R) : compose(R, S));
	const other = $derived(composeOrder === 'rs' ? compose(R, S) : compose(S, R));

	/** What is drawn now. */
	const M = $derived(lerpMat(lerpMat(I2, shown.current, intro), composeM, w.compose));
	const iL = $derived(col1(M));
	const jL = $derived(col2(M));
	const dM = $derived(det(M));

	// ---- handles ---------------------------------------------------------------------
	const r1 = (v: number) => round1(clamp(v, -LIM, LIM));
	function moveI(p: Point) {
		setParam('a', r1((p.x - CX) / U));
		setParam('c', r1((CY - p.y) / U));
	}
	function moveJ(p: Point) {
		setParam('b', r1((p.x - CX) / U));
		setParam('d', r1((CY - p.y) / U));
	}
	const keyStep = (d: number) => (Math.abs(d) > 1 ? 0.5 : 0.1) * Math.sign(d);
	function keyI(dx: number, dy: number) {
		setParam('a', r1(target.a + keyStep(dx)));
		setParam('c', r1(target.c + keyStep(dy)));
	}
	function keyJ(dx: number, dy: number) {
		setParam('b', r1(target.b + keyStep(dx)));
		setParam('d', r1(target.d + keyStep(dy)));
	}
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));
	const handlesOn = $derived(1 - w.compose);

	// ---- the grids -------------------------------------------------------------------
	/** The moved grid as two paths: images of the lines x = k and y = k. */
	const grid = $derived.by(() => {
		// Smallest stretch of M (its smaller singular value): enough lines to cover the
		// clipped square, however much M shrinks the plane.
		const p = M.a * M.a + M.c * M.c;
		const q = M.b * M.b + M.d * M.d;
		const r = M.a * M.b + M.c * M.d;
		const smin = Math.sqrt(Math.max(0, (p + q) / 2 - Math.sqrt(((p - q) / 2) ** 2 + r * r)));
		const K = Math.min(30, Math.ceil(7.4 / Math.max(smin, 0.05)));
		const L = K;
		const seg = (a: Vec, b: Vec) => {
			const A = P(apply(M, a));
			const B = P(apply(M, b));
			return `M${A.x.toFixed(1)} ${A.y.toFixed(1)}L${B.x.toFixed(1)} ${B.y.toFixed(1)}`;
		};
		let lines = '';
		for (let k = -K; k <= K; k++) {
			if (k === 0) continue;
			lines += seg(vec(k, -L), vec(k, L)) + seg(vec(-L, k), vec(L, k));
		}
		return { lines, axes: seg(vec(-L, 0), vec(L, 0)) + seg(vec(0, -L), vec(0, L)) };
	});

	// ---- the F and the unit square -----------------------------------------------------
	// An F with no mirror symmetry (so a flip shows), area 2.25, in the top-left quarter.
	const F0 = [
		[0, 0],
		[0.6, 0],
		[0.6, 1.05],
		[1.35, 1.05],
		[1.35, 1.5],
		[0.6, 1.5],
		[0.6, 1.95],
		[1.65, 1.95],
		[1.65, 2.4],
		[0, 2.4]
	].map(([x, y]) => vec(x - 2.4, y + 0.4));
	const F0area = signedArea(F0);
	const square = [vec(0, 0), vec(1, 0), vec(1, 1), vec(0, 1)];
	const pathOf = (pts: Vec[]) =>
		pts.map((p, k) => `${k ? 'L' : 'M'}${P(p).x.toFixed(1)} ${P(p).y.toFixed(1)}`).join(' ') + 'Z';
	const Fpath = $derived(pathOf(F0.map((p) => apply(M, p))));
	const F0path = pathOf(F0);
	const squarePath = $derived(pathOf(square.map((p) => apply(M, p))));
	const square0 = pathOf(square);
	const areaColor = $derived(dM < -1e-9 ? 'var(--lt-neg)' : 'var(--lt-area)');
	const centreOfSquare = $derived(P(apply(M, vec(0.5, 0.5))));
	const Fcentre = $derived(P(apply(M, vec(-1.9, 1.6))));
	const onPlane = (p: Point, m = 30) =>
		p.x > EDGE + m && p.x < 600 - EDGE - m && p.y > EDGE + m && p.y < 600 - EDGE - m;

	// ---- readout helpers ---------------------------------------------------------------
	const n2 = (v: number) => num(v, 2);
	/** A factor in a product: negatives in brackets. */
	const f = (v: number) => (n2(v).startsWith('−') ? `(${n2(v)})` : n2(v));
	const pt = (v: Vec) => `(${n2(v.x)}, ${n2(v.y)})`;
	/** A direction as friendly numbers: (2, 1) rather than (0.89, 0.45). */
	function dir(v: Vec): string {
		if (Math.abs(v.x) < 1e-6) return '(0, 1)';
		if (Math.abs(v.y) < 1e-6) return '(1, 0)';
		const k = 1 / Math.min(Math.abs(v.x), Math.abs(v.y));
		const s = v.x < 0 ? -1 : 1;
		return `(${n2(s * v.x * k)}, ${n2(s * v.y * k)})`;
	}
	const same = (m: Mat, n: Mat) =>
		Math.abs(m.a - n.a) + Math.abs(m.b - n.b) + Math.abs(m.c - n.c) + Math.abs(m.d - n.d) < 1e-6;
	const named = (list: Record<string, Preset>) =>
		Object.values(list).find((p) => same(p.m, target)) ?? null;
	const galleryName = $derived(named(examples));
	const specialName = $derived(named(specials));

	const detText = $derived(`${f(M.a)} × ${f(M.d)} − ${f(M.b)} × ${f(M.c)}`);
	// Rank, orientation and eigenvectors of the matrix as shown (rounded like the readouts).
	const r2 = (v: number) => Math.round(v * 100) / 100;
	const Mr = $derived(mat(r2(M.a), r2(M.b), r2(M.c), r2(M.d)));
	const rk = $derived(rank(Mr));
	const dShown = $derived(r2(dM));
	const orientation = $derived(
		rk === 0
			? 'squashed to a single point'
			: rk === 1
				? 'flattened onto a line: no way back'
				: dShown < 0
					? 'flipped over: ĵ is now clockwise of î'
					: 'not flipped: ĵ is anticlockwise of î'
	);

	// ---- eigenvectors ----------------------------------------------------------------
	const E = $derived(eigen(Mr, 1e-6));
	const eigenPairs = $derived(E.kind === 'two' || E.kind === 'one' ? E.pairs : []);
	const eigenLines = $derived(
		eigenPairs.map((p, k) => {
			const far = 9;
			return {
				k,
				value: p.value,
				a: P(vec(-far * p.vector.x, -far * p.vector.y)),
				b: P(vec(far * p.vector.x, far * p.vector.y)),
				v: P(vec(1.2 * p.vector.x, 1.2 * p.vector.y)),
				lv: P(vec(1.2 * p.value * p.vector.x, 1.2 * p.value * p.vector.y)),
				vector: p.vector
			};
		})
	);
	/** Where an eigenvalue label goes: beyond the longer arrow, beside the line. */
	const eigenLabel = (l: (typeof eigenLines)[number]) => {
		const reach = Math.max(1.2, 1.2 * Math.abs(l.value)) + 0.5;
		const sgn = l.value < 0 && Math.abs(l.value) > 1 ? -1 : 1;
		const p = P(vec(sgn * reach * l.vector.x, sgn * reach * l.vector.y));
		const nx = -l.vector.y;
		const ny = l.vector.x;
		return { x: p.x + nx * 14, y: p.y - ny * 14 + 4, right: nx >= 0 };
	};
	const eigenSummary = $derived.by((): string[] => {
		switch (E.kind) {
			case 'two':
				return E.pairs.map((p) => `λ = ${n2(p.value)} along ${dir(p.vector)}`);
			case 'one':
				return [
					`λ = ${n2(E.pairs[0].value)} along ${dir(E.pairs[0].vector)}`,
					'only one eigen-direction'
				];
			case 'all':
				return [`every direction: λ = ${n2(E.value)}`];
			case 'none':
				return ['no eigenvectors:', 'every arrow is turned off its line'];
		}
		return [];
	});

	// The sweeping arrow (phase eigen): once round in 16 s.
	const sweepAngle = $derived(((reduced ? 2.5 : t) / 16) * 360 + 70);
	const u = $derived(
		vec(1.7 * Math.cos((sweepAngle * Math.PI) / 180), 1.7 * Math.sin((sweepAngle * Math.PI) / 180))
	);
	const Mu = $derived(apply(M, u));
	/** Angle between u's line and Mu, 0–90°. */
	const offLine = $derived.by(() => {
		if (length(Mu) < 1e-6) return 0;
		const d = Math.abs(((angleOf(Mu) - angleOf(u)) % 180) + 180) % 180;
		return Math.min(d, 180 - d);
	});
	const aligned = $derived(1 - smoothstep(1.5, 5, offLine));

	// ---- phase follow / matrix: v and where it lands ---------------------------------
	const vx = $derived(Math.round(clamp(Number(params.vx ?? 2), -4, 4) * 2) / 2);
	const vy = $derived(Math.round(clamp(Number(params.vy ?? 1), -4, 4) * 2) / 2);
	const v = $derived(vec(vx, vy));
	const Mv = $derived(apply(M, v));
	const pieces = (n: number) => {
		const out: [number, number][] = [];
		const s = Math.sign(n);
		for (let k = 0; k < Math.abs(n); k++) out.push([s * k, s * Math.min(k + 1, Math.abs(n))]);
		return out;
	};
	const route = $derived([
		...pieces(vx).map(([a, b]) => ({
			key: `i${a}`,
			from: P(apply(M, vec(a, 0))),
			to: P(apply(M, vec(b, 0))),
			color: 'var(--lt-i)'
		})),
		...pieces(vy).map(([a, b]) => ({
			key: `j${a}`,
			from: P(apply(M, vec(vx, a))),
			to: P(apply(M, vec(vx, b))),
			color: 'var(--lt-j)'
		}))
	]);

	// ---- phase repeat: v, Mv, M²v, … ------------------------------------------------------
	const V0 = vec(-1, 1.5);
	const powers = ['v', 'Mv', 'M²v', 'M³v', 'M⁴v', 'M⁵v', 'M⁶v', 'M⁷v'];
	const iterates = $derived(iterate(M, V0, 7));
	const shownCount = $derived(reduced ? 8 : clamp(Math.floor((t - 0.6) / 0.9) + 1, 0, 8));
	/** Where the repeats are heading, from the eigenvalues (the limit, not the last row). */
	const verdict = $derived.by((): string[] => {
		switch (E.kind) {
			case 'two': {
				const [big, small] = E.pairs;
				if (Math.abs(big.value) - Math.abs(small.value) < 1e-6)
					return ['no single direction wins:', 'both stretch by the same amount'];
				if (Math.abs(big.value) < 1e-9) return ['squashed to zero'];
				return [
					`heading for ${dir(big.vector)}, the`,
					`direction with the biggest stretch:`,
					`× ${n2(big.value)} each round`
				];
			}
			case 'one':
				return [`creeping slowly towards ${dir(E.pairs[0].vector)},`, 'the only eigen-direction'];
			case 'all':
				return ['never turns: every direction', `is an eigen-direction (λ = ${n2(E.value)})`];
			case 'none':
				return ['keeps turning: there is no', 'eigen-direction to settle on'];
		}
		return [];
	});

	// ---- labels for î and ĵ ------------------------------------------------------------
	const tipLabel = (p: Vec) => {
		const L = length(p);
		const q = P(p);
		if (L < 1e-6) return { x: q.x + 16, y: q.y - 14 };
		return { x: q.x + (p.x / L) * 30, y: q.y - (p.y / L) * 30 + 7 };
	};
	const iLabel = $derived(tipLabel(iL));
	const jLabel = $derived(tipLabel(jL));
</script>

{#snippet bracket(x: number, y: number, rows: string[][], colors: string[], size = 18, gap = 64)}
	{@const cols = rows[0].length}
	{@const h = rows.length * (size + 12)}
	{@const wdt = cols * gap}
	<path
		d="M{x + 8} {y - size - 2} h-8 v{h} h8 M{x + wdt - 8} {y - size - 2} h8 v{h} h-8"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
	/>
	{#each rows as row, r (r)}
		{#each row as cell, c (c)}
			<T
				x={x + gap / 2 + c * gap}
				y={y + r * (size + 12)}
				text={cell}
				{size}
				weight={600}
				anchor="middle"
				color={colors[c]}
			/>
		{/each}
	{/each}
{/snippet}

{#snippet matrixBox(x: number, y: number, m: Mat, size = 20)}
	{@render bracket(
		x,
		y,
		[
			[n2(m.a), n2(m.b)],
			[n2(m.c), n2(m.d)]
		],
		['var(--lt-i)', 'var(--lt-j)'],
		size,
		size * 3.4
	)}
{/snippet}

<g>
	<defs>
		<clipPath id="lt-transform-clip">
			<rect x={EDGE} y={EDGE} width={600 - 2 * EDGE} height={600 - 2 * EDGE} rx="10" />
		</clipPath>
	</defs>

	<g clip-path="url(#lt-transform-clip)">
		<!-- where the plane was: the square grid -->
		{#each BASE as g (g)}
			<line x1={sx(g)} x2={sx(g)} y1={EDGE} y2={600 - EDGE} stroke="var(--stage-grid)" />
			<line x1={EDGE} x2={600 - EDGE} y1={sy(g)} y2={sy(g)} stroke="var(--stage-grid)" />
		{/each}

		<!-- the moved grid -->
		<g opacity={1 - 0.55 * w.repeat}>
			<path d={grid.lines} stroke="var(--lt-grid)" stroke-width="1" opacity="0.42" fill="none" />
			<path d={grid.axes} stroke="var(--lt-grid)" stroke-width="2" opacity="0.85" fill="none" />
		</g>

		<!-- areas: the unit square and where it lands -->
		{#if areaW > 0.01}
			<g opacity={areaW}>
				<path d={square0} fill="none" stroke="var(--stage-ink-muted)" stroke-dasharray="4 4" />
				<path
					d={squarePath}
					fill={areaColor}
					fill-opacity="0.32"
					stroke={areaColor}
					stroke-width="1.5"
				/>
			</g>
		{/if}

		<!-- the F: where it was (dashed) and where it lands -->
		<g opacity={1 - 0.6 * w.eigen - 0.8 * w.repeat}>
			<path
				d={F0path}
				fill="none"
				stroke="var(--lt-shape)"
				stroke-dasharray="4 4"
				opacity={0.25 + 0.4 * areaW}
			/>
			<path
				d={Fpath}
				fill="var(--lt-shape)"
				fill-opacity="0.38"
				stroke="var(--lt-shape)"
				stroke-width="1.6"
				stroke-linejoin="round"
			/>
		</g>

		<!-- eigen-directions -->
		{#if eigenW > 0.01}
			<g opacity={eigenW}>
				{#if E.kind === 'all'}
					<!-- every direction is an eigen-direction: a few of them -->
					{#each [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330] as a (a)}
						{@const e = vec(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180))}
						<Arrow
							from={O}
							to={P(vec(1.6 * E.value * e.x, 1.6 * E.value * e.y))}
							color="var(--lt-eigen)"
							width={2.5}
							head={12}
							opacity={0.8}
						/>
					{/each}
				{/if}
				{#each eigenLines as l (l.k)}
					<line
						x1={l.a.x}
						y1={l.a.y}
						x2={l.b.x}
						y2={l.b.y}
						stroke="var(--lt-eigen)"
						stroke-width="2"
						stroke-dasharray="8 6"
						opacity="0.75"
					/>
					{#if w.repeat < 0.5}
						<Arrow from={O} to={l.lv} color="var(--lt-eigen)" width={5} head={16} />
						<Arrow from={O} to={l.v} color="var(--stage-ink)" width={2} head={11} opacity={0.75} />
					{/if}
				{/each}
			</g>
		{/if}

		<!-- phase eigen: a thin arrow sweeping round, and its image -->
		{#if w.eigen > 0.01}
			<g opacity={w.eigen}>
				<Arrow from={O} to={P(u)} color="var(--stage-ink)" width={1.8} head={11} dashed />
				<Arrow
					from={O}
					to={P(Mu)}
					color={aligned > 0.5 ? 'var(--lt-eigen)' : 'var(--stage-ink-muted)'}
					width={3 + 2 * aligned}
					head={15}
				/>
			</g>
		{/if}

		<!-- phase follow: v where it was, and built from the moved î and ĵ -->
		{#if w.follow > 0.01}
			<g opacity={w.follow}>
				<Arrow from={O} to={P(v)} color="var(--lt-v)" width={2} opacity={0.4} dashed />
				{#each route as r (r.key)}
					<Arrow from={r.from} to={r.to} color={r.color} width={2.5} head={11} opacity={0.85} />
				{/each}
			</g>
		{/if}
		<!-- phases follow and matrix: where v lands -->
		{#if w.follow + w.matrix > 0.01}
			<g opacity={w.follow + w.matrix}>
				<Arrow from={O} to={P(Mv)} color="var(--lt-v)" width={4} head={17} />
				{#if onPlane(P(Mv)) && length(Mv) > 0.4}
					{@const right = P(Mv).x < 420 && Mv.x >= 0}
					<T
						x={P(Mv).x + (right ? 14 : -14)}
						y={P(Mv).y + (Mv.y >= 0 ? -12 : 24)}
						text="v lands here"
						size={13}
						weight={600}
						anchor={right ? 'start' : 'end'}
						color="var(--lt-v)"
					/>
				{/if}
			</g>
		{/if}

		<!-- phase repeat: the directions of v, Mv, M²v, … -->
		{#if w.repeat > 0.01}
			<g opacity={w.repeat}>
				{#each iterates.slice(0, shownCount) as it, k (k)}
					{@const L = length(it)}
					{#if L > 1e-9}
						{@const tip = P(vec((3.6 * it.x) / L, (3.6 * it.y) / L))}
						{@const latest = k === shownCount - 1}
						<Arrow
							from={O}
							to={tip}
							color={k === 0 ? 'var(--lt-v)' : 'var(--stage-ink)'}
							width={latest ? 3.5 : 1.8}
							head={latest ? 16 : 11}
							opacity={latest ? 1 : 0.25 + 0.06 * k}
						/>
						{#if k === 0 || (latest && k > 0)}
							<T
								x={tip.x + (it.x / L >= 0 ? 12 : -12)}
								y={tip.y + (it.y / L >= 0 ? -10 : 20)}
								text={powers[k]}
								size={14}
								weight={700}
								italic
								anchor={it.x / L >= 0 ? 'start' : 'end'}
								color={k === 0 ? 'var(--lt-v)' : 'var(--stage-ink)'}
							/>
						{/if}
					{/if}
				{/each}
			</g>
		{/if}

		<!-- labels inside the plane -->
		{#if areaW > 0.01 && Math.abs(dM) > 0.15 && onPlane(centreOfSquare)}
			<T
				x={centreOfSquare.x}
				y={centreOfSquare.y + 5}
				text={n2(dM)}
				size={15}
				weight={700}
				anchor="middle"
				opacity={areaW}
			/>
		{/if}
		{#if eigenW > 0.01 && w.repeat < 0.5}
			{#each eigenLines as l (l.k)}
				{@const lab = eigenLabel(l)}
				{#if onPlane(lab, 10)}
					<T
						x={lab.x}
						y={lab.y}
						text="λ = {n2(l.value)}"
						size={14}
						weight={700}
						anchor={lab.right ? 'start' : 'end'}
						color="var(--lt-eigen)"
						opacity={eigenW}
					/>
				{/if}
			{/each}
		{/if}
		{#if w.drag + w.gallery + w.flip > 0.3 && onPlane(Fcentre, 20)}
			<T
				x={Fcentre.x}
				y={Fcentre.y + 5}
				text="F"
				size={16}
				weight={700}
				anchor="middle"
				color="var(--lt-shape)"
				opacity={0.9 * (w.drag + w.gallery + w.flip)}
			/>
		{/if}

		<!-- î and ĵ where they land -->
		<Arrow from={O} to={P(iL)} color="var(--lt-i)" width={5} head={18} />
		<Arrow from={O} to={P(jL)} color="var(--lt-j)" width={5} head={18} />
		<T
			x={iLabel.x}
			y={iLabel.y}
			text="î"
			size={20}
			weight={700}
			anchor="middle"
			color="var(--lt-i)"
		/>
		<T
			x={jLabel.x}
			y={jLabel.y}
			text="ĵ"
			size={20}
			weight={700}
			anchor="middle"
			color="var(--lt-j)"
		/>
	</g>
	<rect
		x={EDGE}
		y={EDGE}
		width={600 - 2 * EDGE}
		height={600 - 2 * EDGE}
		rx="10"
		fill="none"
		stroke="var(--border)"
	/>

	<!-- the handles -->
	{#if handlesOn > 0.01}
		<g opacity={handlesOn}>
			{#if pulse > 0.01}
				{#each [P(iL), P(jL)] as p, k (k)}
					<circle
						cx={p.x}
						cy={p.y}
						r={18 + 10 * pulse}
						fill="none"
						stroke={k ? 'var(--lt-j)' : 'var(--lt-i)'}
						stroke-width="2"
						opacity={0.5 * pulse}
					/>
				{/each}
			{/if}
			<VectorHandle
				x={P(iL).x}
				y={P(iL).y}
				label="Where î lands"
				value={angleOf(col1(target))}
				valuetext="î lands on {pt(col1(target))}"
				color="var(--lt-i)"
				onmove={moveI}
				onkey={keyI}
				ondragstart={() => (dragging = true)}
				ondragend={() => (dragging = false)}
			/>
			<VectorHandle
				x={P(jL).x}
				y={P(jL).y}
				label="Where ĵ lands"
				value={angleOf(col2(target))}
				valuetext="ĵ lands on {pt(col2(target))}"
				color="var(--lt-j)"
				onmove={moveJ}
				onkey={keyJ}
				ondragstart={() => (dragging = true)}
				ondragend={() => (dragging = false)}
			/>
		</g>
	{/if}

	<!-- ================= the readout panel ================= -->
	<!-- drag -->
	{#if w.drag > 0.01}
		<g opacity={panel(w.drag)}>
			<T x={PX} y={64} text="the matrix" size={13} muted />
			{@render matrixBox(PX, 104, M, 22)}
			<T x={PX} y={196} text="î lands on {pt(iL)}" size={15} weight={600} color="var(--lt-i)" />
			<T x={PX} y={222} text="ĵ lands on {pt(jL)}" size={15} weight={600} color="var(--lt-j)" />
			<T x={PX} y={290} text="A linear transformation:" size={14} weight={600} />
			<T x={PX} y={316} text="• the origin stays put" size={13} />
			<T x={PX} y={338} text="• straight lines stay straight" size={13} />
			<T x={PX} y={360} text="• parallel, evenly spaced lines" size={13} />
			<T x={PX + 12} y={378} text="stay parallel and evenly spaced" size={13} />
			<T x={PX} y={450} text="Drag the tips of î and ĵ, or focus" size={13} muted />
			<T x={PX} y={470} text="one (Tab) and use the arrow keys." size={13} muted />
		</g>
	{/if}

	<!-- follow -->
	{#if w.follow > 0.01}
		<g opacity={panel(w.follow)}>
			<T x={PX} y={70} text="before:" size={13} muted />
			<T
				x={PX}
				y={98}
				text="v = ({n2(vx)}, {n2(vy)}) = {n2(vx)}·î + {n2(vy)}·ĵ"
				size={17}
				weight={700}
				color="var(--lt-v)"
			/>
			<T x={PX} y={160} text="after: the same recipe," size={13} muted />
			<T x={PX} y={178} text="with î and ĵ where they landed" size={13} muted />
			<T x={PX} y={214} text="{n2(vx)}·" size={16} weight={600} />
			<T x={PX + 34} y={214} text={pt(iL)} size={16} weight={600} color="var(--lt-i)" />
			<T x={PX} y={242} text="+ {n2(vy)}·" size={16} weight={600} />
			<T x={PX + 46} y={242} text={pt(jL)} size={16} weight={600} color="var(--lt-j)" />
			<T x={PX} y={276} text="= {pt(Mv)}" size={20} weight={700} color="var(--lt-v)" />
			<T x={PX} y={350} text="Four numbers pin the whole" size={14} weight={600} />
			<T x={PX} y={372} text="transformation down:" size={14} weight={600} />
			<T x={PX} y={398} text="where î lands  {pt(iL)}" size={14} color="var(--lt-i)" />
			<T x={PX} y={420} text="where ĵ lands  {pt(jL)}" size={14} color="var(--lt-j)" />
		</g>
	{/if}

	<!-- matrix -->
	{#if w.matrix > 0.01}
		<g opacity={panel(w.matrix)}>
			<T x={PX} y={64} text="the matrix times v" size={13} muted />
			{@render matrixBox(PX - 4, 112, M, 17)}
			{@render bracket(PX + 128, 112, [[n2(vx)], [n2(vy)]], ['var(--lt-v)'], 17, 50)}
			<T x={PX + 196} y={124} text="=" size={20} weight={600} anchor="middle" />
			{@render bracket(PX + 210, 112, [[n2(Mv.x)], [n2(Mv.y)]], ['var(--lt-v)'], 17, 62)}
			<T x={PX} y={214} text="= {n2(vx)} × (first column)" size={14} />
			<T x={PX} y={236} text="+ {n2(vy)} × (second column)" size={14} />
			<T
				x={PX}
				y={280}
				text="top:  {f(M.a)} × {f(vx)} + {f(M.b)} × {f(vy)} = {n2(Mv.x)}"
				size={14}
				weight={600}
			/>
			<T
				x={PX}
				y={306}
				text="bottom:  {f(M.c)} × {f(vx)} + {f(M.d)} × {f(vy)} = {n2(Mv.y)}"
				size={14}
				weight={600}
			/>
			<T
				x={PX}
				y={376}
				text="first column: where î lands"
				size={14}
				color="var(--lt-i)"
				weight={600}
			/>
			<T
				x={PX}
				y={400}
				text="second column: where ĵ lands"
				size={14}
				color="var(--lt-j)"
				weight={600}
			/>
		</g>
	{/if}

	<!-- gallery -->
	{#if w.gallery > 0.01}
		<g opacity={panel(w.gallery)}>
			<T x={PX} y={78} text={galleryName?.name ?? 'Your own matrix'} size={22} weight={700} />
			<T x={PX} y={104} text={galleryName?.about ?? 'dragged from the example'} size={13} muted />
			{@render matrixBox(PX, 166, M, 22)}
			<T x={PX} y={258} text="î lands on {pt(iL)}" size={15} weight={600} color="var(--lt-i)" />
			<T x={PX} y={284} text="ĵ lands on {pt(jL)}" size={15} weight={600} color="var(--lt-j)" />
			<T x={PX} y={350} text="Pick another example from the menu," size={13} muted />
			<T x={PX} y={370} text="or drag î and ĵ." size={13} muted />
		</g>
	{/if}

	<!-- area and flip -->
	{#if w.area + w.flip > 0.01}
		<g opacity={panel(w.area + w.flip)}>
			<T x={PX} y={64} text="the matrix" size={13} muted />
			{@render matrixBox(PX, 104, M, 20)}
			<T x={PX} y={196} text="det = ad − bc" size={18} weight={700} />
			<T x={PX} y={224} text="= {detText}" size={15} />
			<T x={PX} y={254} text="= {n2(dM)}" size={22} weight={700} color={areaColor} />
			<T x={PX} y={300} text="unit square: area 1 → {n2(Math.abs(dM))}" size={14} weight={600} />
			<T
				x={PX}
				y={326}
				text="F: area {n2(Math.abs(F0area))} → {n2(Math.abs(F0area * dM))}  (× {n2(Math.abs(dM))})"
				size={14}
				weight={600}
				color="var(--lt-shape)"
			/>
			<T
				x={PX}
				y={372}
				text={orientation}
				size={14}
				weight={600}
				color={dShown < 0 ? 'var(--lt-neg)' : undefined}
			/>
			{#if !showArea}
				<T x={PX} y={420} text="(turn on “Show areas” to see them)" size={12} muted />
			{/if}
		</g>
	{/if}

	<!-- eigen and special -->
	{#if w.eigen + w.special > 0.01}
		<g opacity={panel(w.eigen + w.special)}>
			{#if w.special > 0.5}
				<T x={PX} y={70} text={specialName?.name ?? 'Your own matrix'} size={20} weight={700} />
				<T x={PX} y={94} text={specialName?.about ?? 'dragged from the example'} size={13} muted />
			{:else}
				<T x={PX} y={104} text="the matrix" size={13} muted />
			{/if}
			{@render matrixBox(PX, 146, M, 20)}
			<T x={PX} y={240} text="M v = λ v" size={18} weight={700} />
			{#each eigenSummary as line, k (k)}
				<T x={PX} y={274 + 24 * k} text={line} size={15} weight={600} color="var(--lt-eigen)" />
			{/each}
			{#if w.eigen > 0.5}
				<T x={PX} y={380} text="the thin arrow and its image:" size={13} muted />
				<T
					x={PX}
					y={404}
					text={length(Mu) < 1e-6
						? 'its image is squashed to 0 (λ = 0)'
						: aligned > 0.5
							? 'on the same line: an eigenvector!'
							: `${num(offLine, 0)}° apart`}
					size={15}
					weight={600}
					color={aligned > 0.5 ? 'var(--lt-eigen)' : undefined}
				/>
			{/if}
			{#if !showEigen}
				<T x={PX} y={450} text="(turn on “Show eigenvectors” to draw them)" size={12} muted />
			{/if}
		</g>
	{/if}

	<!-- repeat -->
	{#if w.repeat > 0.01}
		<g opacity={panel(w.repeat)}>
			<T x={PX} y={64} text="apply the matrix again and again" size={13} muted />
			<T x={PX} y={96} text="vector" size={13} weight={600} />
			<T x={PX + 120} y={96} text="direction" size={13} weight={600} anchor="end" />
			<T x={PX + 290} y={96} text="length" size={13} weight={600} anchor="end" />
			{#each iterates as it, k (k)}
				<T
					x={PX}
					y={124 + 26 * k}
					text={powers[k]}
					size={15}
					weight={600}
					italic
					color={k === 0 ? 'var(--lt-v)' : undefined}
					opacity={k < shownCount ? 1 : 0.15}
				/>
				<T
					x={PX + 120}
					y={124 + 26 * k}
					text={length(it) > 1e-9 ? `${num(angleOf(it), 1)}°` : '—'}
					size={15}
					anchor="end"
					opacity={k < shownCount ? 1 : 0.15}
				/>
				<T
					x={PX + 290}
					y={124 + 26 * k}
					text={num(length(it), 1)}
					size={15}
					anchor="end"
					opacity={k < shownCount ? 1 : 0.15}
				/>
			{/each}
			<g opacity={shownCount >= 8 ? 1 : 0.15}>
				{#each verdict as line, k (k)}
					<T x={PX} y={356 + 24 * k} text={line} size={15} weight={600} color="var(--lt-eigen)" />
				{/each}
			</g>
			<T x={PX} y={470} text="PageRank finds the ranks of web pages" size={13} muted />
			<T x={PX} y={490} text="this way, with a matrix of links." size={13} muted />
		</g>
	{/if}

	<!-- compose -->
	{#if w.compose > 0.01}
		{@const firstNow = s1 > 0.01 && s2 < 0.01}
		{@const secondNow = s2 > 0.01}
		<g opacity={panel(w.compose)}>
			<T x={PX} y={60} text="1. first" size={13} muted opacity={firstNow ? 1 : 0.7} />
			<T
				x={PX}
				y={84}
				text={firstIs === 'rotate' ? 'rotate a quarter turn: R' : 'shear: S'}
				size={15}
				weight={700}
				opacity={firstNow || ct < 1 ? 1 : 0.6}
			/>
			{@render matrixBox(PX + 210, 80, firstIs === 'rotate' ? R : S, 15)}
			<T x={PX} y={148} text="2. then" size={13} muted />
			<T
				x={PX}
				y={172}
				text={firstIs === 'rotate' ? 'shear: S' : 'rotate a quarter turn: R'}
				size={15}
				weight={700}
				opacity={secondNow ? 1 : 0.6}
			/>
			{@render matrixBox(PX + 210, 168, firstIs === 'rotate' ? S : R, 15)}
			<T x={PX} y={254} text="together:" size={13} muted />
			<T x={PX} y={282} text={composeOrder === 'rs' ? 'SR =' : 'RS ='} size={20} weight={700} />
			{@render matrixBox(PX + 70, 278, product, 20)}
			<T
				x={PX}
				y={364}
				text="î ends on {pt(col1(product))}"
				size={14}
				weight={600}
				color="var(--lt-i)"
			/>
			<T
				x={PX}
				y={388}
				text="ĵ ends on {pt(col2(product))}"
				size={14}
				weight={600}
				color="var(--lt-j)"
			/>
			<T
				x={PX}
				y={436}
				text="the other order gives {composeOrder === 'rs' ? 'RS' : 'SR'} = ({n2(other.a)} {n2(
					other.b
				)}; {n2(other.c)} {n2(other.d)})"
				size={13}
				muted
			/>
			<T
				x={PX}
				y={462}
				text="det: {n2(det(S))} × {n2(det(R))} = {n2(det(product))}"
				size={13}
				muted
			/>
			<T
				x={PX}
				y={530}
				text={ct < 1
					? 'the square grid'
					: s2 < 0.01
						? s1 < 1
							? 'step 1…'
							: 'after step 1'
						: s2 < 1
							? 'step 2…'
							: 'after both steps'}
				size={14}
				weight={600}
			/>
		</g>
	{/if}

	<!-- all -->
	{#if w.all > 0.01}
		<g opacity={panel(w.all)}>
			<T x={PX} y={64} text="the matrix: where î and ĵ land" size={13} muted />
			{@render matrixBox(PX, 104, M, 22)}
			<T x={PX} y={200} text="det = {n2(dM)}" size={18} weight={700} color={areaColor} />
			<T x={PX} y={224} text="areas × {n2(Math.abs(dM))}; {orientation}" size={12} muted />
			<T x={PX} y={276} text="eigenvectors" size={13} muted />
			{#each eigenSummary as line, k (k)}
				<T x={PX} y={300 + 24 * k} text={line} size={15} weight={600} color="var(--lt-eigen)" />
			{/each}
			<T x={PX} y={420} text="A matrix is a transformation:" size={15} weight={700} />
			<T x={PX} y={444} text="its columns are where it sends" size={15} weight={700} />
			<T x={PX} y={468} text="the basis vectors." size={15} weight={700} />
		</g>
	{/if}
</g>
