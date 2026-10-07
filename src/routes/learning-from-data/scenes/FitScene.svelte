<script lang="ts">
	/**
	 * Examples as draggable dots, and a least-squares polynomial fitted to them.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   points  — the examples appear one by one; no model yet
	 *   line    — the best straight line and its equation
	 *   error   — the gaps to the line, with squares on them (equal x and y
	 *             scales, so each square's area is that example's squared error)
	 *   degree  — the degree control; training error
	 *   overfit — same, plus the true curve (toggle) and the wild swings
	 *   test    — every third example held back (hollow); the model is fitted to
	 *             the solid ones; training error vs test error
	 *
	 * The data come from `makeData(21, 0.15, seed)` with seed = 1 + the number of
	 * "New examples" presses. Dragged examples are stored in `params.pts` as
	 * "seed|id:x,y;id:x,y…" (only the moved ones), so they survive step changes
	 * and are forgotten when the seed changes.
	 *
	 * The curve morphs when the degree changes: only the degree is tweened, and
	 * every frame the fits of the two neighbouring whole degrees are blended, so
	 * a drag still re-fits instantly.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { fitPolynomial, makeData, mse, truth, type Model } from '../fit';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry: equal scales on both axes (squares stay square) ---------------
	const U = 236; // stage units per data unit
	const XMIN = -1.05;
	const XMAX = 1.05;
	const YMAX = 1.1; // y runs from −YMAX to YMAX
	const X0 = 66;
	const Y0 = 22;
	const PX = (x: number) => X0 + (x - XMIN) * U;
	const PY = (y: number) => Y0 + (YMAX - y) * U;
	const LEFT = PX(XMIN);
	const RIGHT = PX(XMAX);
	const TOP = PY(YMAX);
	const BOTTOM = PY(-YMAX);
	const CENTER = (LEFT + RIGHT) / 2;
	const TICKS = [-1, -0.5, 0, 0.5, 1];
	const minus = (v: number | string) => String(v).replace('-', '−');

	// Right-hand panel.
	const PL = 604;
	const PR = 944;
	const BAR_W = PR - PL;
	const BAR_FULL = 0.2; // error that fills a bar

	// ---- phases ---------------------------------------------------------------------
	const phases = ['points', 'line', 'error', 'degree', 'overfit', 'test'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'points') as Phase);
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);
	const degreeTarget = $derived(has('degree') ? Math.round(Number(params.degree ?? 3)) : 1);
	const truthOn = $derived(phase === 'overfit' && has('truth') && params.truth === true);

	const ease = { duration: 700, easing: cubicInOut };
	const weights = Object.fromEntries(phases.map((p) => [p, new Tween(0, ease)])) as Record<
		Phase,
		Tween<number>
	>;
	const degTween = new Tween(1, { duration: 900, easing: cubicInOut });
	const truthTween = new Tween(0, ease);
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	$effect(() => {
		const d = degreeTarget;
		untrack(() => degTween.set(d, { duration: reduced ? 0 : 900 }));
	});
	$effect(() => {
		const on = truthOn ? 1 : 0;
		untrack(() => truthTween.set(on, { duration: reduced ? 0 : 600 }));
	});
	const w = $derived({
		points: weights.points.current,
		line: weights.line.current,
		error: weights.error.current,
		degree: weights.degree.current,
		overfit: weights.overfit.current,
		test: weights.test.current
	});
	// Panel blocks share lines, so they swap: the old one is gone halfway
	// through the cross-fade, the new one appears after.
	const show = (v: number) => smoothstep(0.5, 1, v);
	const modelW = $derived(1 - w.points);
	const testW = $derived(w.test);

	// ---- data -----------------------------------------------------------------------
	const seed = $derived(1 + Number(params.fresh ?? 0));
	const base = $derived(makeData(21, 0.15, seed));
	const moved = $derived.by(() => {
		const out: Record<number, Point> = {};
		const raw = typeof params.pts === 'string' ? params.pts : '';
		const [s, list] = raw.split('|');
		if (Number(s) !== seed || !list) return out;
		for (const item of list.split(';')) {
			const [id, xy] = item.split(':');
			const [x, y] = (xy ?? '').split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) out[Number(id)] = { x, y };
		}
		return out;
	});
	const points = $derived(base.map((p) => ({ ...p, ...(moved[p.id] ?? {}) })));
	const train = $derived(points.filter((p) => !p.test));
	const held = $derived(points.filter((p) => p.test));

	function setPoint(id: number, x: number, y: number) {
		const next = { ...moved, [id]: { x: clamp(x, -1, 1), y: clamp(y, -YMAX, YMAX) } };
		const list = Object.entries(next).map(([i, p]) => `${i}:${p.x.toFixed(3)},${p.y.toFixed(3)}`);
		setParam('pts', `${seed}|${list.join(';')}`);
	}

	// ---- interaction ----------------------------------------------------------------
	// The first move of a drag is the pointer-down position: remember where the
	// pointer sits on the dot, so the dot does not jump to the pointer.
	let grab: { dx: number; dy: number } | null = null;
	function onmove(id: number, p: Point) {
		const cur = points[id];
		if (!grab) grab = { dx: PX(cur.x) - p.x, dy: PY(cur.y) - p.y };
		const sx = p.x + grab.dx;
		const sy = p.y + grab.dy;
		setPoint(id, XMIN + (sx - X0) / U, YMAX - (sy - Y0) / U);
	}
	function onkey(id: number, k: number | 'start' | 'end') {
		const cur = points[id];
		if (k === 'start') return setPoint(id, cur.x, -YMAX);
		if (k === 'end') return setPoint(id, cur.x, YMAX);
		setPoint(id, cur.x, cur.y + (Math.abs(k) >= 10 ? 0.2 : 0.05) * Math.sign(k));
	}

	// ---- models -------------------------------------------------------------------------
	// Fits for the readouts, at the target degree.
	const allFit = $derived(fitPolynomial(points, degreeTarget));
	const trainFit = $derived(fitPolynomial(train, degreeTarget));
	const lineFit = $derived(fitPolynomial(points, 1));
	const trainErr = $derived(phase === 'test' ? mse(trainFit, train) : mse(allFit, points));
	const testErr = $derived(mse(trainFit, held));
	const lineErr = $derived(mse(lineFit, points));

	// The drawn curve: blend of the two whole degrees around the tweened one, and
	// of the all-points and training-only fits by the test weight.
	const drawn = $derived.by(() => {
		const d = clamp(degTween.current, 0, 12);
		const lo = Math.floor(d + 1e-6);
		const hi = Math.min(12, lo + 1);
		const f = clamp(d - lo);
		const pick = (pts: typeof points): Model[] =>
			f < 1e-3 ? [fitPolynomial(pts, lo)] : [fitPolynomial(pts, lo), fitPolynomial(pts, hi)];
		const a = testW < 0.999 ? pick(points) : [];
		const b = testW > 0.001 ? pick(train) : [];
		const mix = (ms: Model[], x: number) =>
			ms.length === 1 ? ms[0].predict(x) : (1 - f) * ms[0].predict(x) + f * ms[1].predict(x);
		return (x: number) =>
			(a.length ? (1 - testW) * mix(a, x) : 0) + (b.length ? testW * mix(b, x) : 0);
	});

	const N = 180;
	const samples = $derived.by(() => {
		const out: Point[] = [];
		for (let i = 0; i <= N; i++) {
			const x = XMIN + ((XMAX - XMIN) * i) / N;
			out.push({ x, y: drawn(x) });
		}
		return out;
	});
	const pathOf = (pts: Point[]) =>
		pts
			.map((p, i) => `${i ? 'L' : 'M'}${PX(p.x).toFixed(1)} ${PY(clamp(p.y, -3, 3)).toFixed(1)}`)
			.join(' ');
	const curvePath = $derived(pathOf(samples));
	const truthPath = pathOf(
		Array.from({ length: 121 }, (_, i) => {
			const x = XMIN + ((XMAX - XMIN) * i) / 120;
			return { x, y: truth(x) };
		})
	);

	// Where the curve leaves the chart: one marker per run off the top or bottom
	// that goes clearly past the edge (neighbouring ones merged), at most four.
	const offChart = $derived.by(() => {
		const runs: { x: number; up: boolean; len: number }[] = [];
		let start = -1;
		let peak = 0;
		for (let i = 0; i <= N + 1; i++) {
			const y = i <= N ? samples[i].y : 0;
			const out = Math.abs(y) > YMAX;
			const same = start >= 0 && Math.sign(y) === Math.sign(samples[start].y);
			if (start >= 0 && (!out || !same)) {
				const mid = samples[Math.round((start + i - 1) / 2)];
				if (peak > YMAX + 0.12)
					runs.push({ x: PX(mid.x), up: samples[start].y > 0, len: i - start });
				start = -1;
			}
			if (out && start < 0) {
				start = i;
				peak = 0;
			}
			if (start >= 0) peak = Math.max(peak, Math.abs(y));
		}
		const merged: typeof runs = [];
		for (const r of runs) {
			const last = merged.at(-1);
			if (last && last.up === r.up && r.x - last.x < 34) {
				if (r.len > last.len) merged[merged.length - 1] = r;
			} else merged.push(r);
		}
		return merged
			.sort((a, b) => b.len - a.len)
			.slice(0, 4)
			.map((r) => ({ ...r, x: clamp(r.x, LEFT + 8, RIGHT - 8) }));
	});

	// The wildest swing (overfit phase): where the curve overshoots most beyond
	// the dots on either side of it (or, past the outermost dots, beyond that
	// dot's height). With 21 examples this is usually past the end dots.
	const swing = $derived.by(() => {
		if (phase !== 'overfit' || degreeTarget < 8) return null;
		const sorted = [...points].sort((a, b) => a.x - b.x);
		const first = sorted[0];
		const last = sorted[sorted.length - 1];
		const spans = [
			{ x0: XMIN, x1: first.x, lo: first.y, hi: first.y, kind: 'first' },
			...sorted.slice(1).map((q, i) => ({
				x0: sorted[i].x,
				x1: q.x,
				lo: Math.min(sorted[i].y, q.y),
				hi: Math.max(sorted[i].y, q.y),
				kind: 'between'
			})),
			{ x0: last.x, x1: XMAX, lo: last.y, hi: last.y, kind: 'last' }
		];
		let best = { v: 0, x: 0, y: 0, up: true, kind: '', x0: 0, x1: 0 };
		for (const sp of spans) {
			for (let k = 1; k < 16; k++) {
				const x = sp.x0 + ((sp.x1 - sp.x0) * k) / 16;
				const y = clamp(allFit.predict(x), -3, 3);
				const v = Math.max(sp.lo - y, y - sp.hi);
				if (v > best.v) best = { v, x, y, up: y > sp.hi, kind: sp.kind, x0: sp.x0, x1: sp.x1 };
			}
		}
		if (best.v < 0.3) return null;
		const text =
			best.kind === 'between'
				? 'wild swing between the dots'
				: `wild swing past the ${best.kind} dot`;
		// Label beside the curve somewhere along the swing: candidate spots along
		// the span, on either side and a little above or below; the spot with the
		// fewest dots and curve samples under the text, nearest the tip, wins.
		const width = text.length * 6.6;
		const curve = Array.from({ length: 121 }, (_, i) => {
			const x = XMIN + ((XMAX - XMIN) * i) / 120;
			return { x: PX(x), y: PY(clamp(allFit.predict(x), -3, 3)) };
		});
		if (truthOn)
			for (let i = 0; i <= 60; i++) {
				const x = XMIN + ((XMAX - XMIN) * i) / 60;
				curve.push({ x: PX(x), y: PY(truth(x)) });
			}
		const dots = points.map((d) => ({ x: PX(d.x), y: PY(d.y) }));
		const tip = { x: PX(best.x), y: PY(clamp(best.y, -YMAX, YMAX)) };
		let place = { x: 0, y: 0, anchor: 'start', score: Infinity };
		for (let k = 0; k <= 12; k++) {
			const x = best.x0 + ((best.x1 - best.x0) * k) / 12;
			const ax = PX(x);
			const ay = PY(clamp(allFit.predict(x), -0.85 * YMAX, 0.85 * YMAX));
			for (const dy of [0, -18, 18, -36, 36]) {
				for (const toRight of [true, false]) {
					const x0 = toRight ? ax + 12 : ax - 12 - width;
					const x1 = x0 + width;
					const y1 = ay + 4 + dy;
					const y0 = y1 - 12;
					if (x0 < LEFT + 6 || x1 > RIGHT - 6 || y0 < TOP + 18 || y1 > BOTTOM - 18) continue;
					const inside = (q: Point, pad: number) =>
						q.x > x0 - pad && q.x < x1 + pad && q.y > y0 - pad && q.y < y1 + pad;
					const score =
						20 * dots.filter((q) => inside(q, 10)).length +
						2 * curve.filter((q) => inside(q, 4)).length +
						Math.hypot(ax - tip.x, ay - tip.y) / 60 +
						Math.abs(dy) / 30;
					if (score < place.score)
						place = toRight
							? { x: x0, y: y1, anchor: 'start', score }
							: { x: x1, y: y1, anchor: 'end', score };
				}
			}
		}
		if (!Number.isFinite(place.score)) return null;
		return { text, x: place.x, y: place.y, anchor: place.anchor };
	});

	// ---- residuals ------------------------------------------------------------------------
	const residuals = $derived(
		w.error > 0.01
			? points.map((p) => {
					const m = drawn(p.x);
					const side = Math.abs(p.y - m) * U;
					const toLeft = PX(p.x) + side > RIGHT;
					return {
						id: p.id,
						x: PX(p.x),
						y1: PY(p.y),
						y2: PY(m),
						side,
						sx: toLeft ? PX(p.x) - side : PX(p.x),
						sy: Math.min(PY(p.y), PY(m))
					};
				})
			: []
	);
	const gaps = $derived(
		testW > 0.01 ? held.map((p) => ({ id: p.id, x: PX(p.x), y1: PY(p.y), y2: PY(drawn(p.x)) })) : []
	);

	// ---- text ---------------------------------------------------------------------------------
	const fmt = (v: number) =>
		v >= 10 ? v.toFixed(1) : v >= 0.01 ? v.toFixed(3) : v >= 0.0001 ? v.toFixed(4) : '< 0.0001';
	const two = (v: number) => minus((Math.abs(v) < 0.005 ? 0 : v).toFixed(2));
	const equation = $derived.by(() => {
		const [b, a] = lineFit.coefficients;
		const bb = Math.abs(b) < 0.005 ? 0 : b;
		return `y = ${two(a)} x ${bb < 0 ? '−' : '+'} ${Math.abs(bb).toFixed(2)}`;
	});
	const bends = (d: number) =>
		d === 0
			? 'a flat line'
			: d === 1
				? 'a straight line'
				: d === 2
					? 'one bend'
					: `up to ${d - 1} bends`;
	const overfitNote = $derived(
		degreeTarget >= 8
			? [
					'Through nearly every dot,',
					swing && !swing.text.includes('between')
						? 'but wild past the end dots.'
						: 'but wild between them.'
				]
			: degreeTarget <= 3
				? ['Too stiff to follow the pattern', '(underfitting). Push it to the top.']
				: ['Push the flexibility to the top', 'and watch the curve between the dots.']
	);
	const barLen = (v: number) => BAR_W * clamp(v / BAR_FULL);

	// Inviting pulse on one dot at the start of the line step.
	const pulse = $derived(
		reduced || phase !== 'line' ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5))
	);
	// Staggered appearance on the first step (finished by 1.7 s).
	const appear = (i: number) =>
		phase === 'points' && !reduced ? smoothstep(0.1 + i * 0.06, 0.4 + i * 0.06, t) : 1;

	// Legend rows slide together as rows fade in and out.
	const legend = $derived.by(() => {
		const rows = [
			{ key: 'dot', w: 1 - testW, text: 'example (drag it)' },
			{ key: 'train', w: testW, text: 'training example: used to fit' },
			{ key: 'test', w: testW, text: 'test example: held back' },
			{ key: 'model', w: modelW, text: 'model (fitted curve)' },
			{ key: 'square', w: w.error, text: 'squared error: gap × gap' },
			{ key: 'truth', w: truthTween.current, text: 'true curve: the hidden rule' },
			{ key: 'off', w: offChart.length ? modelW : 0, text: 'the curve goes off the chart' }
		];
		let y = 470;
		return rows.map((r) => {
			const row = { ...r, y };
			y += 22 * r.w;
			return row;
		});
	});
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
		rotate?: number;
		tabular?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		transform={opts.rotate === undefined ? undefined : `rotate(${opts.rotate} ${x} ${y})`}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet bar(y: number, v: number, color: string)}
	<rect x={PL} {y} width={BAR_W} height="8" rx="4" fill="var(--stage-line)" opacity="0.35" />
	<rect x={PL} {y} width={Math.max(4, barLen(v))} height="8" rx="4" fill={color} />
	{#if v > BAR_FULL}
		<path
			d="M{PR - 22} {y - 3} l5 7 l-5 7 M{PR - 15} {y - 3} l5 7 l-5 7"
			fill="none"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/if}
{/snippet}

<g>
	<defs>
		<clipPath id="fit-plot-clip">
			<rect x={LEFT} y={TOP} width={RIGHT - LEFT} height={BOTTOM - TOP} />
		</clipPath>
	</defs>

	<!-- axes and grid -->
	<g style:pointer-events="none">
		{#each TICKS as v (v)}
			<line
				x1={LEFT}
				x2={RIGHT}
				y1={PY(v)}
				y2={PY(v)}
				stroke={v === 0 ? 'var(--stage-line)' : 'var(--stage-grid)'}
				stroke-width={v === 0 ? 0.75 : 1}
			/>
			<line
				x1={PX(v)}
				x2={PX(v)}
				y1={TOP}
				y2={BOTTOM}
				stroke={v === 0 ? 'var(--stage-line)' : 'var(--stage-grid)'}
				stroke-width={v === 0 ? 0.75 : 1}
			/>
			{@render txt(LEFT - 8, PY(v) + 4, minus(v), 11, { anchor: 'end', muted: true })}
			{@render txt(PX(v), BOTTOM + 17, minus(v), 11, { anchor: 'middle', muted: true })}
		{/each}
		<rect
			x={LEFT}
			y={TOP}
			width={RIGHT - LEFT}
			height={BOTTOM - TOP}
			fill="none"
			stroke="var(--stage-line)"
		/>
		{@render txt(CENTER, BOTTOM + 37, 'input x', 13, { anchor: 'middle', muted: true })}
		{@render txt(30, (TOP + BOTTOM) / 2, 'output y', 13, {
			anchor: 'middle',
			muted: true,
			rotate: -90
		})}
	</g>

	<g clip-path="url(#fit-plot-clip)" style:pointer-events="none">
		<!-- squared errors (error phase) -->
		{#if w.error > 0.01}
			<g opacity={w.error}>
				{#each residuals as r (r.id)}
					<rect
						x={r.sx}
						y={r.sy}
						width={r.side}
						height={r.side}
						fill="var(--fit-model)"
						fill-opacity="0.1"
						stroke="var(--fit-model)"
						stroke-opacity="0.45"
						stroke-width="1"
					/>
					<line
						x1={r.x}
						x2={r.x}
						y1={r.y1}
						y2={r.y2}
						stroke="var(--fit-model)"
						stroke-width="1.5"
					/>
				{/each}
			</g>
		{/if}

		<!-- gaps to the held-back examples (test phase) -->
		{#if testW > 0.01}
			<g opacity={0.7 * testW}>
				{#each gaps as g (g.id)}
					<line
						x1={g.x}
						x2={g.x}
						y1={g.y1}
						y2={g.y2}
						stroke="var(--fit-test)"
						stroke-width="1.5"
						stroke-dasharray="3 3"
					/>
				{/each}
			</g>
		{/if}

		<!-- the true curve (overfit phase, toggle) -->
		{#if truthTween.current > 0.01}
			<path
				d={truthPath}
				fill="none"
				stroke="var(--fit-truth)"
				stroke-width="2.5"
				stroke-dasharray="7 5"
				stroke-linecap="round"
				opacity={truthTween.current}
			/>
		{/if}

		<!-- the model -->
		{#if modelW > 0.01}
			<path
				d={curvePath}
				fill="none"
				stroke="var(--fit-model)"
				stroke-width="2.75"
				stroke-linejoin="round"
				stroke-linecap="round"
				opacity={modelW}
			/>
		{/if}
	</g>

	<!-- where the curve leaves the chart -->
	{#if modelW > 0.01 && offChart.length}
		<g opacity={modelW} style:pointer-events="none">
			{#each offChart as r, i (i)}
				<path
					d={r.up
						? `M${r.x - 6} ${TOP + 11} L${r.x} ${TOP + 3} L${r.x + 6} ${TOP + 11} Z`
						: `M${r.x - 6} ${BOTTOM - 11} L${r.x} ${BOTTOM - 3} L${r.x + 6} ${BOTTOM - 11} Z`}
					fill="var(--fit-model)"
				/>
			{/each}
		</g>
	{/if}

	<!-- the wildest swing (overfit phase) -->
	{#if swing}
		<g opacity={w.overfit} style:pointer-events="none">
			{@render txt(swing.x, swing.y, swing.text, 12, {
				anchor: swing.anchor,
				color: 'var(--fit-model)',
				weight: 600
			})}
		</g>
	{/if}

	<!-- the examples -->
	{#each points as p (p.id)}
		{@const o = appear(p.id)}
		{@const hollow = p.test ? testW : 0}
		{#if o > 0.001}
			<g opacity={o}>
				{#if p.id === 15 && pulse > 0.01}
					<circle
						cx={PX(p.x)}
						cy={PY(p.y)}
						r={12 + 5 * pulse}
						fill="none"
						stroke="var(--fit-train)"
						stroke-width="1.5"
						opacity={0.7 * pulse}
						style:pointer-events="none"
					/>
				{/if}
				<Handle
					x={PX(p.x)}
					y={PY(p.y)}
					r={6}
					label="Example {p.id + 1}"
					value={Number(p.y.toFixed(2))}
					min={-YMAX}
					max={YMAX}
					valuetext="input {two(p.x)}, output {two(p.y)}{p.test && testW > 0.5
						? ', test example'
						: ''}"
					color={hollow > 0.5 ? 'var(--fit-test)' : 'var(--fit-train)'}
					ondragstart={() => (grab = null)}
					ondragend={() => (grab = null)}
					onmove={(q) => onmove(p.id, q)}
					onkey={(k) => onkey(p.id, k)}
				/>
				{#if hollow > 0.01}
					<circle
						cx={PX(p.x)}
						cy={PY(p.y)}
						r="5.5"
						fill="var(--stage-bg)"
						stroke="var(--fit-test)"
						stroke-width="2.25"
						opacity={hollow}
						style:pointer-events="none"
					/>
				{/if}
			</g>
		{/if}
	{/each}

	<!-- ---------------------------------------------------------------- panel -->
	<g style:pointer-events="none">
		<!-- points -->
		{#if show(w.points) > 0.01}
			<g opacity={show(w.points)}>
				{@render txt(PL, 70, `${points.length} examples`, 24, { weight: 600 })}
				{@render txt(PL, 102, 'Each dot is one example: an input x', 13)}
				{@render txt(PL, 120, 'and the output y measured for it.', 13)}
				{@render txt(PL, 152, 'generated: a hidden rule plus random noise', 12, {
					muted: true
				})}
			</g>
		{/if}

		<!-- line and error -->
		{#if show(w.line + w.error) > 0.01}
			<g opacity={show(w.line + w.error)}>
				{@render txt(PL, 58, 'the best straight line', 13, { muted: true })}
				{@render txt(PL, 92, equation, 24, {
					weight: 600,
					color: 'var(--fit-model)',
					tabular: true
				})}
				{@render txt(
					PL,
					116,
					`slope a = ${two(lineFit.coefficients[1])}, height b = ${two(lineFit.coefficients[0])}`,
					12,
					{ muted: true, tabular: true }
				)}
			</g>
		{/if}
		{#if show(w.line) > 0.01}
			<g opacity={show(w.line)}>
				{@render txt(PL, 156, 'Drag any dot: the line re-fits at once.', 13)}
			</g>
		{/if}
		{#if show(w.error) > 0.01}
			<g opacity={show(w.error)}>
				{@render txt(PL, 166, 'mean squared error', 13)}
				{@render txt(PR, 166, fmt(lineErr), 20, { anchor: 'end', weight: 600, tabular: true })}
				{@render bar(176, lineErr, 'var(--fit-model)')}
				{@render txt(PL, 206, `the average area of the ${points.length} squares:`, 12, {
					muted: true
				})}
				{@render txt(PL, 222, 'each square’s side is one gap', 12, { muted: true })}
			</g>
		{/if}

		<!-- degree, overfit, test -->
		{#if show(w.degree + w.overfit + w.test) > 0.01}
			<g opacity={show(w.degree + w.overfit + w.test)}>
				{@render txt(PL, 58, 'flexibility', 13, { muted: true })}
				{@render txt(PL, 86, `degree ${degreeTarget}: ${bends(degreeTarget)}`, 18, {
					weight: 600,
					color: 'var(--fit-model)'
				})}
				{@render txt(PL, 126, 'training error', 13)}
				{@render txt(PR, 126, fmt(trainErr), 20, { anchor: 'end', weight: 600, tabular: true })}
				{@render bar(136, trainErr, 'var(--fit-train)')}
			</g>
		{/if}
		{#if show(w.degree + w.overfit) > 0.01}
			<g opacity={show(w.degree + w.overfit)}>
				{@render txt(PL, 164, `on the ${points.length} examples it was fitted to`, 12, {
					muted: true
				})}
			</g>
		{/if}
		{#if show(w.overfit) > 0.01}
			<g opacity={show(w.overfit)}>
				{@render txt(PL, 210, overfitNote[0], 13)}
				{@render txt(PL, 228, overfitNote[1], 13)}
			</g>
		{/if}
		{#if show(w.test) > 0.01}
			<g opacity={show(w.test)}>
				{@render txt(PL, 164, `on the ${train.length} solid dots it was fitted to`, 12, {
					muted: true
				})}
				{@render txt(PL, 206, 'test error', 13)}
				{@render txt(PR, 206, fmt(testErr), 20, { anchor: 'end', weight: 600, tabular: true })}
				{@render bar(216, testErr, 'var(--fit-test)')}
				{@render txt(PL, 244, `on the ${held.length} hollow dots it never saw`, 12, {
					muted: true
				})}
			</g>
		{/if}

		<!-- legend -->
		{#each legend as row (row.key)}
			{#if row.w > 0.01}
				<g opacity={smoothstep(0.3, 1, row.w)}>
					{#if row.key === 'dot' || row.key === 'train'}
						<circle cx={PL + 12} cy={row.y - 4} r="5.5" fill="var(--fit-train)" />
					{:else if row.key === 'test'}
						<circle
							cx={PL + 12}
							cy={row.y - 4}
							r="4.5"
							fill="var(--stage-bg)"
							stroke="var(--fit-test)"
							stroke-width="2.25"
						/>
					{:else if row.key === 'model'}
						<line
							x1={PL}
							x2={PL + 24}
							y1={row.y - 4}
							y2={row.y - 4}
							stroke="var(--fit-model)"
							stroke-width="2.75"
							stroke-linecap="round"
						/>
					{:else if row.key === 'square'}
						<rect
							x={PL + 4}
							y={row.y - 12}
							width="16"
							height="16"
							fill="var(--fit-model)"
							fill-opacity="0.1"
							stroke="var(--fit-model)"
							stroke-opacity="0.6"
						/>
						<line
							x1={PL + 4}
							x2={PL + 4}
							y1={row.y - 12}
							y2={row.y + 4}
							stroke="var(--fit-model)"
							stroke-width="1.5"
						/>
					{:else if row.key === 'off'}
						<path
							d="M{PL + 6} {row.y - 1} L{PL + 12} {row.y - 9} L{PL + 18} {row.y - 1} Z"
							fill="var(--fit-model)"
						/>
					{:else}
						<line
							x1={PL}
							x2={PL + 24}
							y1={row.y - 4}
							y2={row.y - 4}
							stroke="var(--fit-truth)"
							stroke-width="2.5"
							stroke-dasharray="7 5"
						/>
					{/if}
					{@render txt(PL + 34, row.y, row.text, 12, { muted: true })}
				</g>
			{/if}
		{/each}
	</g>
</g>
