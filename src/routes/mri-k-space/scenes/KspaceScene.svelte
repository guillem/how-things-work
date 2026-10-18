<script lang="ts">
	/**
	 * k-space (left, logarithmic grey scale) beside the image computed from it (right, the
	 * magnitude of its inverse 2-D Fourier transform). step.hints.mode:
	 *   intro    — the full scan
	 *   fill     — the first params.lines lines, in params.order; params.fillPlay records 8 a second
	 *   point    — one sample (params.kx, params.ky; a handle on k-space) and its wave, or the scan
	 *              with that sample corrupted (params.spike)
	 *   centre   — only the centre (params.rc); edges — only the rest (params.re)
	 *   contrast — the centre (params.rx) of one weighting (params.centreFrom), the edges of the other
	 *   skip     — one line in params.every
	 *   fov      — a field of view of params.fovY cm up–down, as many lines as keep the pixels
	 * Images are drawn on black in both themes, as on a radiologist's screen.
	 */
	import { untrack } from 'svelte';
	import { Handle, Label, toSvg } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { greyImage } from '../../medical-imaging/scenes/raster';
	import {
		acquire,
		centreOnly,
		edgesOnly,
		everyNthLine,
		firstLines,
		lineOrder,
		magnitude,
		pixelAt,
		reconstruct,
		singleSample,
		swapCentre,
		type KSpace
	} from '../model';
	import { LANDMARKS, WEIGHTINGS, head, type Weighting } from '../phantom';
	import { FOV, K_FLOOR, N, WHITE, logMagnitude, scan } from './shared';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'intro'));
	const tt = $derived(reduced ? 2.5 : t);

	// ---- layout ------------------------------------------------------------------------
	const S = 380;
	const KX = 50;
	const KY = 96;
	const IX = 530;
	const IY = 96;
	const cell = S / N;

	// ---- the scans ---------------------------------------------------------------------
	const t2 = scan('t2');
	const kTop = Math.log1p(Math.hypot(t2.re[(N / 2) * N + N / 2], 0) / K_FLOOR);

	// fill
	const playing = $derived(mode === 'fill' && params.fillPlay === true);
	const played = $derived(playing ? Math.min(N, Math.floor((tt % 20) * 8)) : null);
	$effect(() => {
		const v = played;
		if (v !== null) untrack(() => setParam('lines', v));
	});
	const lines = $derived(played ?? Math.round(Number(params.lines ?? 40)));
	const order = $derived(params.order === 'centre' ? 'centre' : 'linear');
	const currentRow = $derived(lines > 0 ? lineOrder(N, order)[lines - 1] : -1);

	// point
	const pkx = $derived(Math.round(Number(params.kx ?? 6)));
	const pky = $derived(Math.round(Number(params.ky ?? 3)));
	const spike = $derived(params.spike === true);

	// edits
	const rc = $derived(Number(params.rc ?? 0.1));
	const re = $derived(Number(params.re ?? 0.1));
	const rx = $derived(Number(params.rx ?? 0.1));
	const centreFrom = $derived(params.centreFrom === 't1' ? 't1' : 't2');
	const other = $derived(centreFrom === 't1' ? 't2' : 't1');
	const every = $derived(Math.max(1, Math.round(Number(params.every ?? 2))));
	const fovY = $derived(Number(params.fovY ?? 16));
	const nyFov = $derived(Math.round((N * fovY) / FOV));

	/** The k-space this step shows. */
	const k = $derived.by((): KSpace => {
		switch (mode) {
			case 'fill':
				return firstLines(t2, lines, order);
			case 'point':
				if (!spike) return t2;
				return withSpike(t2, pky, pkx);
			case 'centre':
				return centreOnly(t2, rc);
			case 'edges':
				return edgesOnly(t2, re);
			case 'contrast':
				return swapCentre(scan(centreFrom), scan(other), rx);
			case 'skip':
				return everyNthLine(t2, every);
			case 'fov':
				return acquire(head('t2'), N, nyFov, FOV, fovY);
			default:
				return t2;
		}
	});

	function withSpike(k0: KSpace, m: number, n: number): KSpace {
		const reArr = Float64Array.from(k0.re);
		const imArr = Float64Array.from(k0.im);
		const i = (m + N / 2) * N + n + N / 2;
		reArr[i] = k0.re[(N / 2) * N + N / 2];
		imArr[i] = 0;
		return { ...k0, re: reArr, im: imArr };
	}

	const kUrl = $derived(greyImage(logMagnitude(k, K_FLOOR), k.nx, k.ny, 0, kTop));

	/** The image: magnitude, or for a single sample the real part of its wave. */
	const image = $derived.by(() => {
		if (mode === 'point' && !spike) {
			const w = reconstruct(singleSample(t2, pky, pkx));
			const a = 1 / (FOV * FOV);
			return { img: w, values: w.re, lo: -a, hi: a };
		}
		const img = reconstruct(k);
		const m = magnitude(img);
		let hi = WHITE;
		if (mode === 'edges') {
			hi = 0;
			for (const v of m) hi = Math.max(hi, v);
			hi *= 0.8;
		}
		return { img, values: m, lo: 0, hi };
	});
	const imUrl = $derived(
		greyImage(image.values, image.img.nx, image.img.ny, image.lo, image.hi || 1)
	);
	const brighten = $derived(mode === 'edges' ? WHITE / image.hi : 1);

	// fluid brightness, for the contrast step
	const fluid = $derived.by(() => {
		if (mode !== 'contrast') return null;
		const v = LANDMARKS.ventricle;
		const at = (kk: KSpace) => {
			const img = reconstruct(kk);
			return pixelAt(img, magnitude(img), v.x, v.y);
		};
		return { mixed: at(k), t1: fluidOf('t1'), t2: fluidOf('t2') };
		function fluidOf(w: Weighting) {
			return at(scan(w));
		}
	});

	// ---- geometry of the panels ---------------------------------------------------------
	const imH = $derived(mode === 'fov' ? (S * fovY) / FOV : S);
	const imY = $derived(IY + (S - imH) / 2);
	const rowY = (r: number) => KY + (r + 0.5) * cell;
	const circleR = $derived(
		mode === 'centre' ? rc : mode === 'edges' ? re : mode === 'contrast' ? rx : 0
	);
	const kCx = KX + S / 2;
	const kCy = KY + S / 2;

	// point handle
	const ptX = $derived(KX + (pkx + N / 2 + 0.5) * cell);
	const ptY = $derived(KY + (pky + N / 2 + 0.5) * cell);
	const clampK = (v: number) => Math.max(-24, Math.min(24, Math.round(v)));
	function movePoint(p: { x: number; y: number }) {
		setParam('kx', clampK((p.x - KX) / cell - N / 2 - 0.5));
		setParam('ky', clampK((p.y - KY) / cell - N / 2 - 0.5));
	}
	function onKspaceDown(e: PointerEvent) {
		if (mode !== 'point') return;
		const svg = (e.currentTarget as Element).closest('svg');
		if (svg) movePoint(toSvg(e, svg));
	}

	const scanTime = (n: number) => {
		const s = (n * WEIGHTINGS.t2.tr) / 1000;
		const m = Math.floor(s / 60);
		return m > 0 ? `${m} min ${Math.round(s - 60 * m)} s` : `${Math.round(s)} s`;
	};
	const kTitles: Record<string, string> = {
		intro: 'k-space: what the coil records',
		fill: 'k-space, as recorded so far',
		centre: 'k-space: only the centre kept',
		edges: 'k-space: the centre removed',
		contrast: 'k-space: two scans combined',
		skip: 'k-space: lines skipped',
		fov: 'k-space: fewer lines, further apart'
	};
	const kTitle = $derived(
		mode === 'point'
			? spike
				? 'k-space with one bad sample'
				: 'k-space: one sample kept'
			: (kTitles[mode] ?? kTitles.intro)
	);
	const iTitle = $derived(
		mode === 'point' && !spike
			? 'its wave (real part)'
			: mode === 'intro'
				? 'the image: its inverse 2-D Fourier transform'
				: 'the image computed from it'
	);
</script>

<g>
	<!-- titles -->
	<Label anchor="start" x={KX} y={KY - 16} text={kTitle} size={15} weight={600} />
	<Label anchor="start" x={IX} y={IY - 16} text={iTitle} size={15} weight={600} />

	<!-- k-space -->
	<rect x={KX - 1} y={KY - 1} width={S + 2} height={S + 2} rx="3" fill="#000" />
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<image
		href={kUrl}
		x={KX}
		y={KY}
		width={S}
		height={S}
		preserveAspectRatio="none"
		style:image-rendering="pixelated"
		opacity={mode === 'point' && !spike ? 0.35 : 1}
		onpointerdown={onKspaceDown}
		data-testid="kspace"
	/>
	<line x1={kCx} y1={KY + 4} x2={kCx} y2={KY + S - 4} stroke="#fff" stroke-opacity="0.12" />
	<line x1={KX + 4} y1={kCy} x2={KX + S - 4} y2={kCy} stroke="#fff" stroke-opacity="0.12" />
	<Label x={KX + S - 6} y={KY + S + 18} text="kₓ →" anchor="end" size={12} muted />
	<Label x={KX - 8} y={KY + 14} text="ky" anchor="end" size={12} muted />
	<Label x={KX - 8} y={KY + 28} text="↓" anchor="end" size={12} muted />

	{#if circleR > 0}
		<ellipse
			cx={kCx}
			cy={kCy}
			rx={(circleR * S) / 2}
			ry={(circleR * S) / 2}
			fill="none"
			stroke="var(--mk-mask)"
			stroke-width="2"
			stroke-dasharray={mode === 'edges' ? '5 4' : 'none'}
		/>
	{/if}
	{#if mode === 'contrast'}
		<Label
			x={kCx}
			y={kCy - (rx * S) / 2 - 8}
			text="centre: {WEIGHTINGS[centreFrom].name}"
			anchor="middle"
			size={12}
			color="var(--mk-mask-text)"
			pill
		/>
		<Label
			anchor="start"
			x={KX + 10}
			y={KY + S - 12}
			text="edges: {WEIGHTINGS[other].name}"
			size={12}
			pill
		/>
	{/if}
	{#if mode === 'fill' && currentRow >= 0 && lines < N}
		<line
			x1={KX}
			y1={rowY(currentRow)}
			x2={KX + S}
			y2={rowY(currentRow)}
			stroke="var(--mk-line)"
			stroke-width="2.5"
		/>
		<polygon
			points="{KX - 12},{rowY(currentRow) - 6} {KX - 2},{rowY(currentRow)} {KX - 12},{rowY(
				currentRow
			) + 6}"
			fill="var(--mk-line)"
		/>
	{/if}
	{#if mode === 'point'}
		<Handle
			x={ptX}
			y={ptY}
			r={7}
			color="var(--mk-line)"
			label="Point in k-space"
			value={pkx}
			min={-24}
			max={24}
			valuetext="{pkx} turns left to right, {pky} top to bottom"
			onmove={movePoint}
			onkey={(s) => {
				if (typeof s === 'number') setParam('kx', clampK(pkx + s));
			}}
		/>
	{/if}

	<!-- arrow between the panels -->
	<line
		x1={KX + S + 14}
		y1={KY + S / 2}
		x2={IX - 16}
		y2={KY + S / 2}
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="ft">
		<Label x={(KX + S + IX) / 2} y={KY + S / 2 - 12} text="FT⁻¹" anchor="middle" size={13} />
	</Readout>

	<!-- image -->
	<rect x={IX - 1} y={IY - 1} width={S + 2} height={S + 2} rx="3" fill="#000" />
	<image
		href={imUrl}
		x={IX}
		y={imY}
		width={S}
		height={imH}
		preserveAspectRatio="none"
		data-testid="image"
	/>
	{#if mode === 'fov'}
		<rect
			x={IX}
			y={imY}
			width={S}
			height={imH}
			fill="none"
			stroke="var(--mk-line)"
			stroke-width="1.5"
		/>
		<!-- dimension lines: the field of view, and the full 24 cm -->
		<line
			x1={IX + S + 10}
			y1={imY}
			x2={IX + S + 10}
			y2={imY + imH}
			stroke="var(--mk-line)"
			stroke-width="2"
		/>
		<Label x={IX + S + 22} y={imY + imH / 2} text="{fovY} cm" size={12} rotate={-90} />
		<line
			x1={IX + S + 34}
			y1={IY}
			x2={IX + S + 34}
			y2={IY + S}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<Label x={IX + S + 46} y={IY + S / 2} text="24 cm" size={11} muted rotate={-90} />
	{/if}

	<!-- readouts -->
	{#if mode === 'intro'}
		<Readout id="grid" order={1} label="Samples" value="128 × 128 over 24 cm">
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="128 × 128 samples · field of view 24 cm"
				size={13}
			/>
		</Readout>
		<Readout id="scan" order={2} label="Scan" value="T2-weighted, 1.5 T">
			<Label
				anchor="start"
				x={IX}
				y={512}
				text="T2-weighted spin echo · TR 4000 ms · TE 100 ms · 1.5 T"
				size={13}
			/>
		</Readout>
	{:else if mode === 'fill'}
		<Readout id="lines" order={1} label="Lines recorded" value="{lines} of {N}">
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="{lines} of {N} lines recorded"
				size={15}
				weight={600}
				tabular
			/>
		</Readout>
		<Readout id="time" order={2} label="Scan time so far" value={scanTime(lines)}>
			<Label
				anchor="start"
				x={KX}
				y={536}
				text="scan time so far: {scanTime(lines)} (one line every 4 s)"
				size={13}
				muted
				tabular
			/>
		</Readout>
	{:else if mode === 'point'}
		<Readout
			id="pt"
			order={1}
			label="Sample"
			value="{pkx} turns left–right, {pky} turns top–bottom"
		>
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="sample: {pkx} turns left to right, {pky} top to bottom"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="wave"
			order={2}
			label="In the image"
			value={spike ? 'stripes over the whole head' : 'a wave over every pixel'}
		>
			<Label
				anchor="start"
				x={IX}
				y={512}
				text={spike
					? 'one bad sample: stripes over the whole image'
					: 'every pixel has the same magnitude'}
				size={13}
			/>
		</Readout>
	{:else if mode === 'centre' || mode === 'edges'}
		<Readout
			id="kept"
			order={1}
			label={mode === 'centre' ? 'Kept' : 'Removed'}
			value="the centre, {Math.round(circleR * 100)}% of the way out"
		>
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="{mode === 'centre' ? 'kept' : 'removed'}: the centre, {Math.round(
					circleR * 100
				)}% of the way to the edge"
				size={13}
			/>
		</Readout>
		{#if mode === 'edges'}
			<Readout id="bright" order={2} label="Image" value="brightened ×{brighten.toFixed(1)}">
				<Label
					anchor="start"
					x={IX}
					y={512}
					text="brightened ×{brighten.toFixed(1)}"
					size={13}
					muted
				/>
			</Readout>
		{/if}
	{:else if mode === 'contrast' && fluid}
		<Readout id="fluid" order={1} label="Fluid in this image" value={fluid.mixed.toFixed(2)}>
			<Label
				anchor="start"
				x={IX}
				y={512}
				text="fluid (ventricle): {fluid.mixed.toFixed(2)}"
				size={15}
				weight={600}
				tabular
			/>
		</Readout>
		<Readout
			id="fluid-ref"
			order={2}
			label="In the full scans"
			value="T2 {fluid.t2.toFixed(2)} · T1 {fluid.t1.toFixed(2)}"
		>
			<Label
				anchor="start"
				x={IX}
				y={536}
				text="in the full T2 scan {fluid.t2.toFixed(2)} · in the T1 scan {fluid.t1.toFixed(2)}"
				size={12}
				muted
				tabular
			/>
		</Readout>
	{:else if mode === 'skip'}
		<Readout id="rec" order={1} label="Lines recorded" value="{Math.ceil(N / every)} of {N}">
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="{Math.ceil(N / every)} of {N} lines · {scanTime(Math.ceil(N / every))}"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="copies"
			order={2}
			label="Image"
			value={every === 1 ? 'one head' : `${every} copies, ${(FOV / every).toFixed(0)} cm apart`}
		>
			<Label
				anchor="start"
				x={IX}
				y={512}
				text={every === 1
					? 'one head'
					: `${every} copies, ${(FOV / every).toFixed(0)} cm apart, each 1/${every} as bright`}
				size={13}
			/>
		</Readout>
	{:else if mode === 'fov'}
		<Readout id="lines" order={1} label="Lines" value="{nyFov} · {scanTime(nyFov)}">
			<Label
				anchor="start"
				x={KX}
				y={512}
				text="{nyFov} lines · {scanTime(nyFov)} · pixels still 1.9 mm"
				size={13}
				tabular
			/>
		</Readout>
		<Readout
			id="wrap"
			order={2}
			label="Head"
			value={fovY >= 19.5 ? 'fits' : `wraps by ${(19 - fovY).toFixed(0)} cm`}
		>
			<Label
				anchor="start"
				x={IX}
				y={512}
				text={fovY >= 19.5
					? 'the 19 cm head fits'
					: `the 19 cm head sticks out by ${(19 - fovY).toFixed(0)} cm and wraps round`}
				size={13}
			/>
		</Readout>
	{/if}
</g>
