<script lang="ts">
	/**
	 * The k-means plot: the penguins (bill length across, flipper length up, both drawn in their
	 * own spread so that on-screen distance is the distance k-means uses), two rings, or the
	 * reader's own points. `step.hints.phase` picks what is shown: the bare points, the starting
	 * centres, one assignment, one move, or whole runs that play round by round.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, scale, toSvg } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		agreement,
		assign,
		distinctCount,
		formatPoints,
		ownDefault,
		parsePoints,
		penguins,
		rings,
		run,
		SCALE,
		species,
		SPECIES,
		spread,
		startCentres,
		type KState,
		type Pt
	} from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'raw'));
	const data = $derived(String(step.hints?.data ?? 'penguins'));

	// ---- frame: one spread = U scene units on both axes ------------------------------------
	const U = 96;
	const XMIN = -2.6;
	const XMAX = 3.2;
	const YMIN = -2.4;
	const YMAX = 2.5;
	const X0 = 74;
	const Y0 = 40;
	const X1 = X0 + (XMAX - XMIN) * U;
	const Y1 = Y0 + (YMAX - YMIN) * U;
	const PX = (x: number) => X0 + (x - XMIN) * U;
	const PY = (y: number) => Y0 + (YMAX - y) * U;
	const sx = scale(
		[SCALE.bill.mean + XMIN * SCALE.bill.sd, SCALE.bill.mean + XMAX * SCALE.bill.sd],
		[X0, X1]
	);
	const sy = scale(
		[SCALE.flipper.mean + YMIN * SCALE.flipper.sd, SCALE.flipper.mean + YMAX * SCALE.flipper.sd],
		[Y1, Y0]
	);
	const PANEL = X1 + 28;

	// ---- data and the run ---------------------------------------------------------------------
	const ringData = rings();
	const own = $derived(params.pts === undefined ? ownDefault() : parsePoints(params.pts));
	const points: Pt[] = $derived(data === 'rings' ? ringData : data === 'own' ? own : penguins);

	const k = $derived(
		data === 'rings'
			? 2
			: data === 'own'
				? Number(params.ownk ?? 2)
				: phase === 'run' || phase === 'species' || phase === 'k'
					? Number(params.k ?? 3)
					: 3
	);
	const seed = $derived(
		1 +
			Number(
				(data === 'rings' ? params.ringstart : data === 'own' ? params.ownstart : params.start) ?? 0
			)
	);
	const states: KState[] = $derived(
		distinctCount(points) >= k ? run(points, startCentres(points, k, seed)) : []
	);
	const rounds = $derived(Math.max(0, states.length - 1));

	// Runs replay from the start whenever their input changes (k, the start, the points).
	let t0 = $state(0);
	$effect(() => {
		void states;
		void step.id;
		t0 = untrack(() => t);
	});
	const animated = $derived(phase === 'run' || phase === 'rings' || phase === 'own');
	/** Seconds per round: half for the colours to settle, half for the centres to glide. */
	const ROUND = 1;
	// A new step restarts its clock: then t is below t0 until the effect above catches up.
	const local = $derived(t >= t0 ? t - t0 : t);
	const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

	/** The state shown: an index into `states` and how far the centres have glided to the next. */
	const view = $derived.by(() => {
		if (!states.length) return { i: 0, glide: 0 };
		if (phase === 'start' || phase === 'assign') return { i: 0, glide: 0 };
		if (phase === 'move') {
			if (states.length < 2) return { i: 0, glide: 0 };
			return { i: 0, glide: reduced ? 1 : ease((local - 0.8) / 1.2) };
		}
		if (!animated || reduced) return { i: states.length - 1, glide: 0 };
		const r = local / ROUND;
		const i = Math.min(Math.floor(r), states.length - 1);
		const glide = i < states.length - 1 ? ease((r - i - 0.5) / 0.5) : 0;
		return { i, glide };
	});
	const shownLabels = $derived(states[view.i]?.labels ?? []);
	const shownCentres: Pt[] = $derived.by(() => {
		const a = states[view.i]?.centres ?? [];
		const next =
			phase === 'move' && states[1] ? states[1].centres : (states[view.i + 1]?.centres ?? a);
		return a.map((c, j) => ({
			x: c.x + (next[j].x - c.x) * view.glide,
			y: c.y + (next[j].y - c.y) * view.glide
		}));
	});
	const done = $derived(view.i === states.length - 1 && states.length > 0);
	const changed = $derived(
		view.i > 0
			? states[view.i].labels.filter((l, n) => l !== states[view.i - 1].labels[n]).length
			: 0
	);

	// What colours the points: nothing before the first assignment, then the shown labels.
	const coloured = $derived(phase !== 'raw' && phase !== 'start');
	const assignFade = $derived(phase === 'assign' && !reduced ? ease((local - 0.4) / 1) : 1);
	const showCentres = $derived(phase !== 'raw' && states.length > 0);
	const centrePop = $derived(phase === 'start' && !reduced ? ease(local / 0.6) : 1);

	// After the move, the points now nearer another centre than the one whose colour they wear.
	const stale = $derived(
		phase === 'move' && states[1] && view.glide >= 1
			? assign(points, states[1].centres).map((l, n) => l !== states[0].labels[n])
			: []
	);
	const staleCount = $derived(stale.filter(Boolean).length);

	const colour = (j: number) => `var(--km-${(j % 6) + 1})`;
	const showSpecies = $derived(
		data === 'penguins' && (phase === 'species' || phase === 'k') && params.species === true
	);
	const fit = $derived(
		data === 'penguins' && states.length ? agreement(shownLabels, species, k) : 0
	);
	const total = $derived(states.length ? spread(points, states[states.length - 1]) : 0);

	// ---- the regions where each centre is the nearest ------------------------------------------
	type Poly = Pt[];
	/** Keeps the part of a polygon on the side of the halfway line nearer to a than to b. */
	function clip(poly: Poly, a: Pt, b: Pt): Poly {
		const nx = b.x - a.x;
		const ny = b.y - a.y;
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		const side = (p: Pt) => (p.x - mx) * nx + (p.y - my) * ny;
		const out: Poly = [];
		poly.forEach((p, i) => {
			const q = poly[(i + 1) % poly.length];
			const sp = side(p);
			const sq = side(q);
			if (sp <= 0) out.push(p);
			if (sp * sq < 0) {
				const u = sp / (sp - sq);
				out.push({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
			}
		});
		return out;
	}
	const regions = $derived.by(() => {
		if (!coloured || !shownCentres.length) return [];
		const frame: Poly = [
			{ x: XMIN, y: YMIN },
			{ x: XMAX, y: YMIN },
			{ x: XMAX, y: YMAX },
			{ x: XMIN, y: YMAX }
		];
		return shownCentres.map((c, j) =>
			shownCentres.reduce(
				(poly, o, m) => (m === j || poly.length < 3 ? poly : clip(poly, c, o)),
				frame
			)
		);
	});
	const polyPath = (poly: Poly) =>
		poly.length < 3
			? ''
			: 'M' + poly.map((p) => `${PX(p.x).toFixed(1)} ${PY(p.y).toFixed(1)}`).join(' L') + ' Z';

	// ---- the reader's own points --------------------------------------------------------------
	let lastClear = untrack(() => Number(params.clear ?? 0));
	$effect(() => {
		const c = Number(params.clear ?? 0);
		if (c !== lastClear) {
			lastClear = c;
			untrack(() => setParam('pts', '-'));
		}
	});
	function addPoint(p: Pt) {
		const x = Math.min(XMAX - 0.05, Math.max(XMIN + 0.05, p.x));
		const y = Math.min(YMAX - 0.05, Math.max(YMIN + 0.05, p.y));
		setParam('pts', formatPoints([...own, { x, y }]));
	}
	function onplot(e: PointerEvent) {
		const s = toSvg(e, e.currentTarget as Element);
		addPoint({ x: XMIN + (s.x - X0) / U, y: YMAX - (s.y - Y0) / U });
	}
	function onplotkey(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		// A point near a random one of the existing points (or the middle), so keyboard readers
		// can grow the clouds too.
		const n = own.length;
		const base = n ? own[Math.floor(((n * 0.618) % 1) * n)] : { x: 0, y: 0 };
		const a = n * 2.399;
		addPoint({ x: base.x + 0.3 * Math.cos(a), y: base.y + 0.3 * Math.sin(a) });
	}

	// ---- shapes -------------------------------------------------------------------------------
	const R = 4.2;
	function shape(s: number, x: number, y: number) {
		if (s === 1) {
			const h = R * 1.35;
			return `M${x} ${y - h}L${x + h * 0.95} ${y + h * 0.7}L${x - h * 0.95} ${y + h * 0.7}Z`;
		}
		const h = R * 0.9;
		return `M${x - h} ${y - h}h${2 * h}v${2 * h}h${-2 * h}Z`;
	}
	const crossPath = (x: number, y: number, r: number) =>
		`M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`;

	const roundText = $derived(
		!states.length
			? 'Too few distinct points for this many centres'
			: done
				? `Nothing moved: done after ${rounds} round${rounds === 1 ? '' : 's'}`
				: `Round ${view.i} of ${rounds}`
	);
	const ringSplit = $derived(
		data === 'rings' && states.length
			? [0, 1].map((ring) => {
					const idx = ringData.map((p, n) => (p.ring === ring ? n : -1)).filter((n) => n >= 0);
					const first = idx.filter((n) => shownLabels[n] === 0).length;
					return { first, second: idx.length - first };
				})
			: []
	);
</script>

<g class="km">
	<!-- frame -->
	{#if data === 'penguins'}
		<Axes {sx} {sy} xLabel="bill length (mm)" yLabel="flipper length (mm)" />
	{:else}
		<rect
			x={X0}
			y={Y0}
			width={X1 - X0}
			height={Y1 - Y0}
			fill="none"
			stroke="var(--border-strong)"
		/>
	{/if}

	<!-- the regions of the centres -->
	{#each regions as poly, j (j)}
		<path d={polyPath(poly)} fill={colour(j)} opacity={0.1 * assignFade} />
	{/each}

	<!-- the points -->
	<g>
		{#each points as p, n (n)}
			{@const x = PX(p.x)}
			{@const y = PY(p.y)}
			{@const fill = coloured && shownLabels.length ? colour(shownLabels[n]) : 'var(--text-muted)'}
			{@const s = showSpecies ? species[n] : 0}
			{#if s === 0}
				<circle
					cx={x}
					cy={y}
					r={R}
					{fill}
					fill-opacity={coloured ? 0.35 + 0.5 * assignFade : 0.55}
					stroke={fill}
					stroke-width="1"
				/>
			{:else}
				<path d={shape(s, x, y)} {fill} fill-opacity={0.85} stroke={fill} stroke-width="1" />
			{/if}
			{#if stale[n]}
				<circle cx={x} cy={y} r={R + 3.5} fill="none" stroke="var(--text)" stroke-width="1.4" />
			{/if}
		{/each}
	</g>

	<!-- the move: where each centre came from -->
	{#if phase === 'move' && states[1]}
		{#each states[0].centres as c, j (j)}
			<line
				x1={PX(c.x)}
				y1={PY(c.y)}
				x2={PX(shownCentres[j].x)}
				y2={PY(shownCentres[j].y)}
				stroke={colour(j)}
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<circle cx={PX(c.x)} cy={PY(c.y)} r="5" fill="none" stroke={colour(j)} stroke-width="1.5" />
		{/each}
	{/if}

	<!-- the centres -->
	{#if showCentres}
		{#each shownCentres as c, j (j)}
			{@const x = PX(c.x)}
			{@const y = PY(c.y)}
			<g opacity={centrePop}>
				<path
					d={crossPath(x, y, 10 * centrePop)}
					stroke="var(--stage-bg)"
					stroke-width="8"
					stroke-linecap="round"
				/>
				<path
					d={crossPath(x, y, 10 * centrePop)}
					stroke={colour(j)}
					stroke-width="4"
					stroke-linecap="round"
				/>
			</g>
		{/each}
	{/if}

	<!-- click or tap to add points -->
	{#if data === 'own'}
		<rect
			class="km-plot"
			x={X0}
			y={Y0}
			width={X1 - X0}
			height={Y1 - Y0}
			fill="transparent"
			role="button"
			tabindex="0"
			aria-label="Add a point: click or tap where it goes, or press Enter to add one near the others"
			onpointerdown={onplot}
			onkeydown={onplotkey}
		/>
	{/if}

	<!-- readouts -->
	<g class="km-panel">
		{#if phase === 'raw'}
			<Readout id="km-count" order={1} label="Penguins" value="342, species hidden">
				<Label x={PANEL} y={70} text="342 penguins" size={16} weight={600} anchor="start" />
				<Label x={PANEL} y={94} text="species hidden" muted anchor="start" />
			</Readout>
		{:else if phase === 'start'}
			<Readout id="km-k" order={1} label="Centres" value="k = 3, on random penguins">
				<Label x={PANEL} y={70} text="k = 3 centres" size={16} weight={600} anchor="start" />
				<Label x={PANEL} y={94} text="started on 3 random penguins" muted anchor="start" />
			</Readout>
		{:else if phase === 'assign'}
			<Readout
				id="km-assign"
				order={1}
				label="Assign"
				value="each point takes its nearest centre’s colour"
			>
				<Label x={PANEL} y={70} text="Assign" size={16} weight={600} anchor="start" />
				<Label x={PANEL} y={94} text="each point → nearest centre" muted anchor="start" />
			</Readout>
		{:else if phase === 'move'}
			<Readout
				id="km-move"
				order={1}
				label="Move"
				value={view.glide >= 1
					? `${staleCount} penguins now nearer another centre`
					: 'centres to the middle of their colour'}
			>
				<Label x={PANEL} y={70} text="Move" size={16} weight={600} anchor="start" />
				<Label x={PANEL} y={94} text="each centre → middle of its colour" muted anchor="start" />
				{#if view.glide >= 1}
					<circle
						cx={PANEL + 6}
						cy={127}
						r={R + 3.5}
						fill="none"
						stroke="var(--text)"
						stroke-width="1.4"
					/>
					<Label
						x={PANEL + 20}
						y={131}
						text="{staleCount} now nearer another centre"
						anchor="start"
					/>
				{/if}
			</Readout>
		{:else}
			<Readout id="km-round" order={1} label="Run" value={roundText}>
				<Label x={PANEL} y={70} text="k = {k}" size={16} weight={600} anchor="start" />
				<Label x={PANEL} y={94} text={roundText} muted={!done} anchor="start" tabular />
				{#if view.i > 0 && !done}
					<Label
						x={PANEL}
						y={116}
						text="{changed} changed colour last round"
						muted
						anchor="start"
						tabular
					/>
				{/if}
			</Readout>
			{#if data === 'penguins' && (phase === 'species' || phase === 'k') && done}
				<Readout
					id="km-match"
					order={2}
					label="Match with species"
					value="{Math.round(fit * 100)} in 100 named right"
				>
					<Label
						x={PANEL}
						y={150}
						text="{Math.round(fit * 100)} in 100 named right"
						weight={600}
						anchor="start"
						tabular
					/>
					<Label x={PANEL} y={172} text="(each group named after" muted size={12} anchor="start" />
					<Label x={PANEL} y={188} text="its most common species)" muted size={12} anchor="start" />
				</Readout>
			{/if}
			{#if phase === 'k' && done}
				<Readout id="km-total" order={3} label="Total squared distance" value={total.toFixed(0)}>
					<Label
						x={PANEL}
						y={222}
						text="total squared distance {total.toFixed(0)}"
						anchor="start"
						tabular
					/>
				</Readout>
			{/if}
			{#if data === 'rings' && done}
				<Readout
					id="km-rings"
					order={2}
					label="Split"
					value="inner ring {ringSplit[0].first} / {ringSplit[0].second}, outer ring {ringSplit[1]
						.first} / {ringSplit[1].second}"
				>
					<Label
						x={PANEL}
						y={150}
						text="inner ring split {ringSplit[0].first} / {ringSplit[0].second}"
						anchor="start"
						tabular
					/>
					<Label
						x={PANEL}
						y={172}
						text="outer ring split {ringSplit[1].first} / {ringSplit[1].second}"
						anchor="start"
						tabular
					/>
					<Label x={PANEL} y={196} text="both rings cut in two" muted anchor="start" />
				</Readout>
			{/if}
			{#if data === 'own'}
				<Readout id="km-own" order={2} label="Points" value={String(points.length)}>
					<Label x={PANEL} y={150} text="{points.length} points" anchor="start" tabular />
					<Label x={PANEL} y={172} text="click or tap to add" muted anchor="start" />
				</Readout>
			{/if}
		{/if}

		{#if showSpecies}
			<Readout id="km-legend" order={4} label="Shapes" value="● Adélie, ▲ Chinstrap, ■ Gentoo">
				{#each SPECIES as name, s (name)}
					<path
						d={s === 0
							? `M${PANEL + 6} ${260 + s * 24}m-${R} 0a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 -${2 * R} 0`
							: shape(s, PANEL + 6, 260 + s * 24)}
						fill="var(--text-muted)"
					/>
					<Label x={PANEL + 20} y={264 + s * 24} text={name} anchor="start" />
				{/each}
			</Readout>
		{/if}
	</g>
</g>

<style>
	.km-plot {
		cursor: crosshair;
		outline: none;
	}
	.km-plot:focus-visible {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
