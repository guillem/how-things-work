<script lang="ts">
	/**
	 * Aperture synthesis in four panels, left to right. step.hints.mode:
	 *   dish  — one filled dish of params.diameter: the dish, its uv disc, its Airy beam, the image
	 *   pair  — two dishes (params.pair, draggable); hints.hours = 0 for a snapshot, otherwise
	 *           params.hours, which params.play sweeps from 0 to 12 h
	 *   array — the array (params.dishes, from params.layout, draggable), uv, beam, dirty image
	 *   build — the same, plus a click on the map adds a dish; params.add / params.remove
	 *   dirty — uv, beam, the dirty image and the true sky
	 *   clean — the dirty image, the residual after ITERATIONS[params.cleanStep] CLEAN iterations
	 *           (params.cleanPlay runs them), the restored image and the true sky
	 *   size  — the 12-dish VLA Y scaled by params[hints.sizeParam], on hints.sky: map, uv, dirty, sky
	 *   area  — the array beside a filled dish as wide as it: map, uv, beam, dirty image
	 * Tracks use params.hours (6) and params.dec (+40°) wherever the step has no control for them.
	 */
	import { untrack } from 'svelte';
	import { Label, VectorHandle, toSvg, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ARCMIN,
		ARCSEC,
		DISH,
		DU,
		LAMBDA,
		N,
		PIX,
		cleanBeam,
		cleanRun,
		cleanStart,
		convolve,
		dirtyBeam,
		dirtyImage,
		dishSampling,
		gaussianImage,
		grid,
		hourAngles,
		pairs,
		peak,
		pixel,
		restore,
		total,
		tracks,
		type Clean,
		type Dish
	} from '../model';
	import {
		DISC_CENTRE,
		DOUBLE_SEPARATION,
		MAP_RADIUS,
		MIN_SPACING,
		PAIR,
		SKY_NAMES,
		layout,
		parse,
		scaled,
		serialize,
		sky,
		skyVisibilities,
		spacings,
		type Layout,
		type SkyKind
	} from '../sky';
	import { ITERATIONS, duration, paint, uvGrey } from './shared';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'array'));
	const tt = $derived(reduced ? 2.5 : t);

	// ---- layout --------------------------------------------------------------------------
	const P = 216;
	const XS = [18, 254, 490, 726];
	const Y0 = 112;
	const MAP_HALF = 700; // metres from the centre to the map's edge
	const mk = P / (2 * MAP_HALF);
	const UV_HALF = (N / 2) * DU; // wavelengths from the centre to the uv panel's edge

	type Panel = 'map' | 'uv' | 'beam' | 'dirty' | 'truth' | 'residual' | 'restored';
	const PANELS: Record<string, Panel[]> = {
		dish: ['map', 'uv', 'beam', 'dirty'],
		pair: ['map', 'uv', 'beam', 'dirty'],
		array: ['map', 'uv', 'beam', 'dirty'],
		build: ['map', 'uv', 'beam', 'dirty'],
		dirty: ['uv', 'beam', 'dirty', 'truth'],
		clean: ['dirty', 'residual', 'restored', 'truth'],
		size: ['map', 'uv', 'dirty', 'truth'],
		area: ['map', 'uv', 'beam', 'dirty']
	};
	const panels = $derived(PANELS[mode] ?? PANELS.array);
	const xOf = (p: Panel) => XS[panels.indexOf(p)];

	// ---- the array ---------------------------------------------------------------------
	const layoutName = $derived(String(params.layout ?? 'vla12') as Layout);
	const pairDishes = $derived(parse(params.pair, PAIR));
	const mainDishes = $derived(parse(params.dishes, layout(layoutName)));
	const sizeParam = $derived(String(step.hints?.sizeParam ?? 'shrink'));
	const sizeF = $derived(Number(params[sizeParam] ?? (sizeParam === 'spread' ? 1.25 : 0.3)));
	const dishes = $derived.by((): Dish[] => {
		if (mode === 'dish') return [];
		if (mode === 'pair') return pairDishes;
		if (mode === 'size') return scaled(layout('vla12'), sizeF);
		return mainDishes;
	});
	const editable = $derived(['pair', 'array', 'build', 'area'].includes(mode));
	const dishParam = $derived(mode === 'pair' ? 'pair' : 'dishes');

	// "Start from": only a new choice after this scene appeared replaces the array
	let seenLayout = untrack(() => String(params.layout ?? 'vla12'));
	$effect(() => {
		const name = layoutName;
		untrack(() => {
			if (name !== seenLayout) setParam('dishes', serialize(layout(name)));
			seenLayout = name;
		});
	});
	// add / remove: react to new presses only
	let seenAdd = untrack(() => Number(params.add ?? 0));
	let seenRemove = untrack(() => Number(params.remove ?? 0));
	$effect(() => {
		const a = Number(params.add ?? 0);
		const r = Number(params.remove ?? 0);
		untrack(() => {
			if (a > seenAdd) {
				const spot = freeSpot(mainDishes);
				if (spot) setParam('dishes', serialize([...mainDishes, spot]));
			}
			if (r > seenRemove && mainDishes.length > 2)
				setParam('dishes', serialize(mainDishes.slice(0, -1)));
			seenAdd = a;
			seenRemove = r;
		});
	});
	const MAX_DISHES = 30;
	/** The first free spot along a golden-angle spiral from the centre, at least 60 m from any dish. */
	function freeSpot(ds: readonly Dish[]): Dish | null {
		if (ds.length >= MAX_DISHES) return null;
		for (let i = 1; i < 2000; i++) {
			const r = 18 * Math.sqrt(i);
			if (r > MAP_RADIUS) break;
			const a = i * 2.39996;
			const e = Math.round(r * Math.sin(a));
			const n = Math.round(r * Math.cos(a));
			if (ds.every((d) => Math.hypot(d.e - e, d.n - n) >= 60)) return { e, n };
		}
		return null;
	}
	function fits(ds: readonly Dish[], i: number, e: number, n: number): boolean {
		return ds.every((d, j) => j === i || Math.hypot(d.e - e, d.n - n) >= MIN_SPACING);
	}
	function clampToMap(e: number, n: number): [number, number] {
		const r = Math.hypot(e, n);
		const f = r > MAP_RADIUS ? MAP_RADIUS / r : 1;
		return [Math.round(e * f), Math.round(n * f)];
	}
	function moveDish(i: number, e: number, n: number) {
		const ds = dishes.slice();
		const [ce, cn] = clampToMap(e, n);
		if (!fits(ds, i, ce, cn)) return;
		ds[i] = { e: ce, n: cn };
		setParam(dishParam, serialize(ds));
	}
	function onMapDown(ev: PointerEvent) {
		if (mode !== 'build') return;
		const svg = (ev.currentTarget as Element).closest('svg');
		if (!svg) return;
		const p = toSvg(ev, svg);
		const x0 = xOf('map');
		const e = (p.x - (x0 + P / 2)) / mk;
		const n = -(p.y - (Y0 + P / 2)) / mk;
		if (Math.hypot(e, n) > MAP_RADIUS || mainDishes.length >= MAX_DISHES) return;
		const [ce, cn] = clampToMap(e, n);
		if (!fits(mainDishes, -1, ce, cn)) return;
		setParam('dishes', serialize([...mainDishes, { e: ce, n: cn }]));
	}

	// ---- the observation -------------------------------------------------------------------
	const decDeg = $derived(Number(params.dec ?? 40));
	const decRad = $derived((decDeg * Math.PI) / 180);
	const playing = $derived(mode === 'pair' && step.hints?.hours !== 0 && params.play === true);
	/** While the Earth turns: one hour a second, held for two seconds at 12 h; quarter hours. */
	const played = $derived(playing ? Math.floor(Math.min(12, tt % 14) * 4) / 4 : null);
	const playedShown = $derived(played === null ? null : Math.round(played * 2) / 2);
	$effect(() => {
		const v = playedShown;
		if (v !== null) untrack(() => setParam('hours', v));
	});
	const hours = $derived(
		mode === 'pair' && step.hints?.hours === 0 ? 0 : (played ?? Number(params.hours ?? 6))
	);
	const H = $derived(hourAngles(hours, decRad));
	const diameter = $derived(Number(params.diameter ?? 25));

	const ts = $derived(mode === 'dish' ? [] : tracks(dishes, decRad, H));
	const S = $derived(mode === 'dish' ? dishSampling(diameter) : grid(ts));
	const beam = $derived(dirtyBeam(S));
	const cb = $derived(cleanBeam(S));

	// ---- the sky ---------------------------------------------------------------------------
	const skyKind = $derived(String(step.hints?.sky ?? params.sky ?? 'galaxy') as SkyKind);
	const truth = $derived(sky(skyKind));
	const dirty = $derived(dirtyImage(skyVisibilities(skyKind), S));
	const dirtyPeak = $derived(Math.abs(peak(dirty).value));

	// ---- CLEAN -------------------------------------------------------------------------------
	const cleanPlaying = $derived(mode === 'clean' && params.cleanPlay === true);
	const kPlayed = $derived(
		cleanPlaying ? Math.min(3000, Math.max(0, Math.round(10 ** (tt / 3)) - 1)) : null
	);
	const kIndexShown = $derived(
		kPlayed === null ? null : ITERATIONS.findLastIndex((v) => v <= kPlayed)
	);
	$effect(() => {
		const v = kIndexShown;
		if (v !== null) untrack(() => setParam('cleanStep', v));
	});
	const kWanted = $derived(kPlayed ?? ITERATIONS[Math.round(Number(params.cleanStep ?? 0))] ?? 0);
	let cache: { key: string; c: Clean } | null = null;
	const cleanKey = $derived(`${serialize(dishes)}|${hours}|${decDeg}|${skyKind}`);
	const cleaned = $derived.by(() => {
		if (mode !== 'clean') return null;
		if (!cache || cache.key !== cleanKey || cache.c.iterations > kWanted)
			cache = { key: cleanKey, c: cleanStart(dirty) };
		cleanRun(cache.c, beam, kWanted, 0.1);
		const c = cache.c;
		return {
			c,
			iterations: c.iterations,
			residualPeak: Math.abs(peak(c.residual).value),
			flux: total(c.model),
			restored: restore(c, cb),
			last: c.where.length ? c.where[c.where.length - 1] : -1
		};
	});

	// ---- what the readouts quote -------------------------------------------------------------
	const sp = $derived(spacings(dishes));
	const beamMajor = $derived(cb.major / ARCSEC);
	const beamMinor = $derived(cb.minor / ARCSEC);
	const largest = $derived(S.uvMin > 0 ? 1 / S.uvMin / ARCMIN : Infinity);
	const pixArc = PIX / ARCMIN;
	const discCentre = pixel(Math.round(DISC_CENTRE.x / pixArc), Math.round(DISC_CENTRE.y / pixArc));
	const discKept = $derived.by(() => {
		if (mode !== 'size' || skyKind !== 'disc') return null;
		const ideal = convolve(truth, gaussianImage(cb));
		return dirty[discCentre] / ideal[discCentre];
	});
	const area = $derived(dishes.length * Math.PI * (DISH / 2) ** 2);
	const bigArea = $derived(Math.PI * (sp.max / 2) ** 2);

	// ---- pictures ------------------------------------------------------------------------------
	const beamUrl = $derived(panels.includes('beam') ? paint(beam, 1, 0.25) : '');
	const dirtyUrl = $derived(paint(dirty, dirtyPeak || 1));
	const truthUrl = $derived(panels.includes('truth') ? paint(truth, peak(truth).value, 0.004) : '');
	const residualUrl = $derived(cleaned ? paint(cleaned.c.residual, dirtyPeak || 1) : '');
	const restoredUrl = $derived(cleaned ? paint(cleaned.restored, dirtyPeak || 1) : '');
	const dishUvUrl = $derived(
		mode === 'dish' ? uvGrey(S.w, dark ? [255, 169, 77] : [232, 89, 12]) : ''
	);
	const urls = $derived<Record<Panel, string>>({
		map: '',
		uv: dishUvUrl,
		beam: beamUrl,
		dirty: dirtyUrl,
		truth: truthUrl,
		residual: residualUrl,
		restored: restoredUrl
	});

	// ---- uv tracks as one path per colour --------------------------------------------------------
	const uvk = P / 2 / UV_HALF;
	const uvPaths = $derived.by(() => {
		if (mode === 'dish') return { main: '', mirror: '' };
		const x0 = xOf('uv') + P / 2;
		const y0 = Y0 + P / 2;
		let main = '';
		let mirror = '';
		const f = (v: number) => v.toFixed(1);
		for (const tr of ts) {
			const n = tr.u.length;
			if (n === 0) continue;
			if (n === 1) {
				main += `M${f(x0 + tr.u[0] * uvk)} ${f(y0 - tr.v[0] * uvk)}h0.01`;
				mirror += `M${f(x0 - tr.u[0] * uvk)} ${f(y0 + tr.v[0] * uvk)}h0.01`;
				continue;
			}
			for (let i = 0; i < n; i++) {
				main += `${i ? 'L' : 'M'}${f(x0 + tr.u[i] * uvk)} ${f(y0 - tr.v[i] * uvk)}`;
				mirror += `${i ? 'L' : 'M'}${f(x0 - tr.u[i] * uvk)} ${f(y0 + tr.v[i] * uvk)}`;
			}
		}
		return { main, mirror };
	});
	const snapshot = $derived(H.length <= 1);

	// ---- titles ----------------------------------------------------------------------------------
	const TITLES: Record<Panel, string> = {
		map: 'the dishes',
		uv: 'what they sample: the uv plane',
		beam: 'the dirty beam',
		dirty: 'the dirty image',
		truth: 'the true sky',
		residual: 'the residual',
		restored: 'the restored image'
	};
	const title = (p: Panel) =>
		mode === 'dish'
			? ((
					{ map: 'one dish', uv: 'its uv plane', beam: 'its beam', dirty: 'what it sees' } as const
				)[p as 'map'] ?? TITLES[p])
			: p === 'uv'
				? 'the uv plane'
				: TITLES[p];

	const fmtAngle = (arcsec: number) =>
		arcsec >= 90 ? `${(arcsec / 60).toFixed(1)}′` : `${Math.round(arcsec)}″`;
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	const decText = $derived(`${decDeg > 0 ? '+' : decDeg < 0 ? '−' : ''}${Math.abs(decDeg)}°`);
	const trackText = $derived(
		H.length === 0
			? `never above 8° at δ = ${decText}`
			: hours === 0
				? `a snapshot at transit · δ = ${decText}`
				: `${hours} h · δ = ${decText}${H.length < Math.round(hours * 12) + 1 ? ' (part below 8°)' : ''}`
	);
	const resolved = $derived(cb.major < DOUBLE_SEPARATION * 1.0);

	// pixels → screen (east left, north up)
	const scr = (x0: number, index: number) => {
		const y = Math.floor(index / N) - N / 2;
		const x = (index % N) - N / 2;
		return { x: x0 + ((N / 2 - x) / N) * P, y: Y0 + ((N / 2 - y) / N) * P };
	};
</script>

<g>
	<!-- panels -->
	{#each panels as p, i (p)}
		{@const x = XS[i]}
		<Label anchor="start" {x} y={Y0 - 12} text={title(p)} size={14} weight={600} />
		{#if p === 'map'}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<rect
				{x}
				y={Y0}
				width={P}
				height={P}
				rx="4"
				fill="var(--as-ground)"
				stroke="var(--as-ground-edge)"
				onpointerdown={onMapDown}
				style:cursor={mode === 'build' ? 'crosshair' : 'default'}
				data-testid="map"
			/>
			<circle
				cx={x + P / 2}
				cy={Y0 + P / 2}
				r={MAP_RADIUS * mk}
				fill="none"
				stroke="var(--as-ground-edge)"
				stroke-dasharray="3 4"
				pointer-events="none"
			/>
			<!-- scale bar and north -->
			<line
				x1={x + 10}
				y1={Y0 + P - 12}
				x2={x + 10 + 200 * mk}
				y2={Y0 + P - 12}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<Readout id="scalebar">
				<Label x={x + 10 + 100 * mk} y={Y0 + P - 18} text="200 m" anchor="middle" size={11} />
				<Label x={x + P - 12} y={Y0 + 18} text="N ↑" anchor="end" size={11} muted />
			</Readout>
			{#if mode === 'dish'}
				<circle
					cx={x + P / 2}
					cy={Y0 + P / 2}
					r={Math.max(2, (diameter / 2) * mk)}
					fill="var(--as-dish)"
					fill-opacity="0.35"
					stroke="var(--as-dish)"
					stroke-width="1.5"
				/>
			{:else}
				{#if mode === 'area' && dishes.length > 1}
					<circle
						cx={x + P / 2}
						cy={Y0 + P / 2}
						r={(sp.max / 2) * mk}
						fill="none"
						stroke="var(--as-track)"
						stroke-width="1.5"
						stroke-dasharray="6 4"
					/>
				{/if}
				{#each dishes as d, j (j)}
					<circle
						cx={x + P / 2 + d.e * mk}
						cy={Y0 + P / 2 - d.n * mk}
						r="4.5"
						fill="var(--as-dish)"
						stroke="var(--stage-bg)"
						stroke-width="1"
						pointer-events="none"
					/>
					{#if editable}
						<VectorHandle
							x={x + P / 2 + d.e * mk}
							y={Y0 + P / 2 - d.n * mk}
							r={6}
							color="var(--as-dish)"
							label="Dish {j + 1}"
							value={Math.round((Math.atan2(d.e, d.n) * 180) / Math.PI)}
							valuetext="{Math.round(d.e)} m east, {Math.round(d.n)} m north"
							onmove={(pt: Point) =>
								moveDish(j, (pt.x - x - P / 2) / mk, -(pt.y - Y0 - P / 2) / mk)}
							onkey={(dx, dy) => moveDish(j, d.e + 10 * dx, d.n + 10 * dy)}
						/>
					{/if}
				{/each}
			{/if}
		{:else if p === 'uv'}
			<rect {x} y={Y0} width={P} height={P} rx="4" fill="var(--surface)" stroke="var(--border)" />
			<line x1={x + P / 2} y1={Y0 + 6} x2={x + P / 2} y2={Y0 + P - 6} stroke="var(--stage-grid)" />
			<line x1={x + 6} y1={Y0 + P / 2} x2={x + P - 6} y2={Y0 + P / 2} stroke="var(--stage-grid)" />
			{#if mode === 'dish'}
				<image
					href={urls.uv}
					{x}
					y={Y0}
					width={P}
					height={P}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<circle
					cx={x + P / 2}
					cy={Y0 + P / 2}
					r={Math.min(P / 2, (diameter / LAMBDA) * uvk)}
					fill="none"
					stroke="var(--as-track)"
					stroke-width="1"
				/>
			{:else}
				{#if mode === 'area' && sp.max > 0}
					<circle
						cx={x + P / 2}
						cy={Y0 + P / 2}
						r={Math.min(P / 2 - 1, (sp.max / LAMBDA) * uvk)}
						fill="none"
						stroke="var(--as-track)"
						stroke-width="1.5"
						stroke-dasharray="6 4"
					/>
				{/if}
				<path
					d={uvPaths.mirror}
					fill="none"
					stroke="var(--as-mirror)"
					stroke-width={snapshot ? 6 : 1.4}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path
					d={uvPaths.main}
					fill="none"
					stroke="var(--as-track)"
					stroke-width={snapshot ? 6 : 1.4}
					stroke-linecap="round"
					stroke-linejoin="round"
					data-testid="uv-tracks"
				/>
			{/if}
			<Readout id="uv-axes">
				<Label x={x + P - 8} y={Y0 + P / 2 - 6} text="u" anchor="end" size={11} muted italic />
				<Label x={x + P / 2 + 6} y={Y0 + 16} text="v" size={11} muted italic />
			</Readout>
		{:else}
			<rect x={x - 1} y={Y0 - 1} width={P + 2} height={P + 2} rx="3" fill="#000" />
			<image
				href={urls[p]}
				{x}
				y={Y0}
				width={P}
				height={P}
				preserveAspectRatio="none"
				data-testid="img-{p}"
			/>
			{#if p !== 'beam'}
				<Readout id="compass-{p}">
					<Label
						x={x + P - 6}
						y={Y0 + 14}
						text="N ↑  E ←"
						anchor="end"
						size={10}
						color="#ced4da"
						halo={false}
					/>
				</Readout>
			{/if}
		{/if}
	{/each}

	<!-- CLEAN: the latest component, on the residual -->
	{#if cleaned && cleaned.last >= 0}
		{@const at = scr(xOf('residual'), cleaned.last)}
		<circle cx={at.x} cy={at.y} r="7" fill="none" stroke="#4dabf7" stroke-width="1.5" />
	{/if}

	<!-- captions under the panels -->
	{#if panels.includes('map')}
		{@const x = xOf('map')}
		{#if mode === 'dish'}
			<Readout id="dish" order={1} label="Dish" value="{diameter} m across">
				<Label
					anchor="start"
					{x}
					y={Y0 + P + 22}
					text="{fmtInt(diameter)} m across"
					size={13}
					tabular
				/>
			</Readout>
		{:else}
			<Readout
				id="dishes"
				order={1}
				label="Array"
				value="{dishes.length} dishes · {fmtInt(pairs(dishes.length))} pairs"
			>
				<Label
					anchor="start"
					{x}
					y={Y0 + P + 22}
					text="{dishes.length} dishes · {fmtInt(pairs(dishes.length))} pairs"
					size={13}
					tabular
				/>
			</Readout>
			<Readout id="spacing">
				<Label
					anchor="start"
					{x}
					y={Y0 + P + 40}
					text="spacings {fmtInt(sp.min)}–{fmtInt(sp.max)} m"
					size={11}
					muted
					tabular
				/>
			</Readout>
		{/if}
	{/if}
	{#if panels.includes('uv')}
		{@const x = xOf('uv')}
		{#if mode === 'dish'}
			<Readout id="uvdisc">
				<Label
					anchor="start"
					{x}
					y={Y0 + P + 22}
					text="filled out to D/λ = {fmtInt(diameter / LAMBDA)} λ"
					size={13}
					tabular
				/>
			</Readout>
		{:else}
			<Readout id="track" order={2} label="Track" value={trackText}>
				<Label anchor="start" {x} y={Y0 + P + 22} text={trackText} size={13} tabular />
			</Readout>
			<Readout id="cells">
				<Label
					anchor="start"
					{x}
					y={Y0 + P + 40}
					text="{fmtInt(S.cells)} of {fmtInt(N * N)} cells sampled{S.outside
						? ` · ${fmtInt(S.outside)} samples off the grid`
						: ''}"
					size={11}
					muted
					tabular
				/>
			</Readout>
		{/if}
	{/if}
	{#if panels.includes('beam')}
		{@const x = xOf('beam')}
		<Readout
			id="beam"
			order={3}
			label="Resolution"
			value={S.cells > 2 ? `${fmtAngle(beamMajor)} × ${fmtAngle(beamMinor)}` : 'stripes only'}
		>
			<Label
				anchor="start"
				{x}
				y={Y0 + P + 22}
				text={S.cells === 0
					? 'nothing sampled'
					: S.cells <= 2
						? `stripes ${(1 / (S.uvMax || 1) / ARCMIN).toFixed(1)}′ apart`
						: `central peak ${fmtAngle(beamMajor)} × ${fmtAngle(beamMinor)}`}
				size={13}
				tabular
			/>
		</Readout>
	{/if}
	{#if mode === 'dish'}
		<Readout
			id="rayleigh"
			order={2}
			label="Blur, 1.22 λ/D"
			value={fmtAngle((1.22 * LAMBDA) / diameter / ARCSEC)}
		>
			<Label
				anchor="start"
				x={xOf('dirty')}
				y={Y0 + P + 22}
				text="blur 1.22 λ/D = {fmtAngle((1.22 * LAMBDA) / diameter / ARCSEC)}"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="dish-area"
			order={4}
			label="Collecting area"
			value="{fmtInt(Math.PI * (diameter / 2) ** 2)} m²"
		>
			<Label
				anchor="start"
				x={XS[0]}
				y={Y0 + P + 64}
				text="collecting area π D²/4 = {fmtInt(Math.PI * (diameter / 2) ** 2)} m² · sky: {SKY_NAMES[
					skyKind
				]}"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{/if}

	{#if mode === 'array' || mode === 'build' || mode === 'pair'}
		<Readout id="samples" order={4} label="Samples" value="{fmtInt(S.samples)} (and their mirrors)">
			<Label
				anchor="start"
				x={xOf('dirty')}
				y={Y0 + P + 22}
				text="{fmtInt(S.samples)} samples, and their mirrors"
				size={13}
				tabular
			/>
		</Readout>
		{#if mode !== 'pair' && S.cells > 2}
			<Readout id="sharp" order={5} label="As sharp as a dish" value="{fmtInt(sp.max)} m across">
				<Label
					anchor="start"
					x={XS[0]}
					y={Y0 + P + 70}
					text="as sharp as one dish {fmtInt(
						sp.max
					)} m across, the longest baseline (λ/B = {fmtAngle(LAMBDA / sp.max / ARCSEC)})"
					size={14}
					weight={600}
					tabular
				/>
			</Readout>
		{/if}
		{#if mode === 'build'}
			<Readout id="hint">
				<Label
					anchor="start"
					x={XS[0]}
					y={Y0 + P + 94}
					text="click the map to add a dish (up to {MAX_DISHES}) · drag a dish to move it"
					size={12}
					muted
				/>
			</Readout>
		{/if}
	{/if}

	{#if mode === 'dirty'}
		<Readout
			id="noflux"
			order={4}
			label="Total flux in the dirty image"
			value="{total(dirty).toFixed(3)} (true sky {total(truth).toFixed(1)} Jy)"
		>
			<Label
				anchor="start"
				x={xOf('dirty')}
				y={Y0 + P + 22}
				text="sum of all pixels: {Math.abs(total(dirty)) < 5e-4
					? '0.000'
					: total(dirty).toFixed(3)}"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="truthflux">
			<Label
				anchor="start"
				x={xOf('truth')}
				y={Y0 + P + 22}
				text="{SKY_NAMES[skyKind]} · {total(truth).toFixed(1)} Jy in all"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="bowl"
			order={5}
			label="Deepest negative"
			value="{Math.min(...dirty).toFixed(2)} Jy/beam"
		>
			<Label
				anchor="start"
				x={XS[0]}
				y={Y0 + P + 70}
				text="the zero spacing is never measured: the dirty image adds up to zero, and dips to {Math.min(
					...dirty
				).toFixed(2)} Jy/beam (blue)"
				size={13}
				tabular
			/>
		</Readout>
	{/if}

	{#if mode === 'clean' && cleaned}
		<Readout id="iter" order={1} label="Iterations" value={fmtInt(cleaned.iterations)}>
			<Label
				anchor="start"
				x={xOf('residual')}
				y={Y0 + P + 22}
				text="{fmtInt(cleaned.iterations)} iterations · gain 0.1"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="left"
			order={2}
			label="Brightest residual"
			value="{cleaned.residualPeak.toFixed(3)} Jy/beam"
		>
			<Label
				anchor="start"
				x={xOf('residual')}
				y={Y0 + P + 40}
				text="brightest left: {cleaned.residualPeak.toFixed(3)} Jy/beam"
				size={11}
				muted
				tabular
			/>
		</Readout>
		<Readout
			id="flux"
			order={3}
			label="Flux in components"
			value="{cleaned.flux.toFixed(2)} of {total(truth).toFixed(2)} Jy"
		>
			<Label
				anchor="start"
				x={xOf('restored')}
				y={Y0 + P + 22}
				text="components hold {cleaned.flux.toFixed(2)} of {total(truth).toFixed(2)} Jy"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="cbeam">
			<Label
				anchor="start"
				x={xOf('restored')}
				y={Y0 + P + 40}
				text="clean beam {fmtAngle(beamMajor)} × {fmtAngle(beamMinor)}"
				size={11}
				muted
				tabular
			/>
		</Readout>
		<Readout id="dirtypeak">
			<Label
				anchor="start"
				x={xOf('dirty')}
				y={Y0 + P + 22}
				text="peak {dirtyPeak.toFixed(2)} Jy/beam"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="truthname">
			<Label anchor="start" x={xOf('truth')} y={Y0 + P + 22} text={SKY_NAMES[skyKind]} size={13} />
		</Readout>
	{/if}

	{#if mode === 'size'}
		<Readout id="size" order={2} label="Size" value="× {sizeF.toFixed(2)}">
			<Label
				anchor="start"
				x={xOf('uv')}
				y={Y0 + P + 22}
				text="array × {sizeF.toFixed(2)} · {trackText}"
				size={13}
				tabular
			/>
		</Readout>
		{#if skyKind === 'double'}
			<Readout
				id="res"
				order={3}
				label="Beam vs the double’s 1.5′"
				value="{fmtAngle(beamMajor)}: {resolved ? 'two points' : 'one blob'}"
			>
				<Label
					anchor="start"
					x={XS[0]}
					y={Y0 + P + 70}
					text="longest baseline {fmtInt(sp.max)} m → beam {fmtAngle(
						beamMajor
					)}; the double’s points are 1.5′ apart: {resolved ? 'resolved, two points' : 'one blob'}"
					size={14}
					weight={600}
					tabular
				/>
			</Readout>
		{:else if discKept !== null}
			<Readout
				id="las"
				order={3}
				label="Largest scale λ/b_min"
				value="{largest.toFixed(1)}′ (disc 6′)"
			>
				<Label
					anchor="start"
					x={XS[0]}
					y={Y0 + P + 70}
					text="shortest baseline {fmtInt(
						sp.min
					)} m → nothing much larger than λ/b = {largest.toFixed(1)}′ is seen; the disc is 6′"
					size={14}
					weight={600}
					tabular
				/>
			</Readout>
			<Readout
				id="kept"
				order={4}
				label="Disc’s centre kept"
				value="{Math.round(Math.max(0, discKept) * 100)}%"
			>
				<Label
					anchor="start"
					x={XS[0]}
					y={Y0 + P + 94}
					text="brightness at the disc’s centre: {Math.round(
						discKept * 100
					)}% of the true sky at this resolution"
					size={13}
					tabular
				/>
			</Readout>
		{/if}
	{/if}

	{#if mode === 'area' && dishes.length > 1}
		<Readout id="area-array" order={3} label="Collecting area" value="{fmtInt(area)} m²">
			<Label
				anchor="start"
				x={XS[0]}
				y={Y0 + P + 70}
				text="{dishes.length} dishes of 25 m: {fmtInt(area)} m² · one dish {fmtInt(
					sp.max
				)} m across (dashed): {fmtInt(bigArea)} m²"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="area-ratio"
			order={4}
			label="Share of the big dish"
			value="{((100 * area) / bigArea).toFixed(1)}%"
		>
			<Label
				anchor="start"
				x={XS[0]}
				y={Y0 + P + 94}
				text="same resolution, {((100 * area) / bigArea).toFixed(
					1
				)}% of the area: what the big dish sees in a minute takes the array {duration(
					(bigArea / area) ** 2
				)}"
				size={14}
				weight={600}
				tabular
			/>
		</Readout>
	{/if}
</g>
