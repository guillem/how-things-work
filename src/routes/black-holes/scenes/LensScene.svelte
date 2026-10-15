<script lang="ts">
	/**
	 * A black hole in front of a field of stars, as a camera 30 r_s (60 GM/c²)
	 * away sees it. For every pixel the camera looks at angle θ from the hole;
	 * that light passed the hole with impact parameter b = D sin θ / √(1 − 2/D)
	 * (`cameraImpact`, for a camera held at rest), was bent by α(b) (a table
	 * traced once with the model's tracer; the ~1% of the bend that falls
	 * beyond the camera is not removed) and so came from the sky at β = θ − α
	 * (`skyAngle`). Pixels with b inside the
	 * critical 2.6 r_s see nothing: the shadow. The sky is a seeded star field
	 * (stars on a jittered grid plus soft glowing clouds) at infinity, painted
	 * into a canvas and shown as an SVG `<image>`, as in waves-interference.
	 * The canvas is repainted only when the hole moves or the view changes.
	 *
	 * One bright star drifts behind the hole (a pure function of t), passing
	 * `params.pass` Einstein-ring radii from it; its two images (`images`) are
	 * drawn as arcs over the canvas: a round star of angular radius ρ at angle
	 * β from the hole has images spanning ±asin(ρ/β) round the hole, and a full
	 * ring when β < ρ.
	 *
	 * The hole is draggable (`params['hole:lens']`, "x,y" in stage units); the
	 * arrow keys move it sideways. `params.unlensed` shows the sky without it.
	 *
	 * Phases: lens — the wide view with the drifting star; shadow — zoomed in
	 * 3× on the shadow, with the horizon's own size for comparison.
	 */
	import { cycle, Handle, hash, Label, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		B_CRIT,
		alphaAt,
		cameraImpact,
		deflectionTable,
		einsteinAngle,
		images,
		shadowAngle,
		type DeflectionTable
	} from '../blackhole';
	import Card from './Card.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const PX0 = 16;
	const PY0 = 16;
	const PW = 624;
	const PH = 568;
	const PY1 = PY0 + PH;
	const PXC = PX0 + PW / 2;
	const PYC = PY0 + PH / 2;
	const CX = 660;
	const CW = 284;
	const CAN_W = 312; // canvas: half the panel's resolution
	const CAN_H = 284;
	const D = 60; // camera distance, GM/c² (30 r_s)

	const phase = $derived(String(step.hints?.phase ?? 'lens'));
	const unlensed = $derived(Boolean(params.unlensed));
	const pass = $derived(Number(params.pass ?? 0));

	// The bending table is traced once per page (≈ 400 rays).
	let table: DeflectionTable | null = null;
	const tab = (): DeflectionTable => (table ??= deflectionTable(200, 400));
	const thetaE = einsteinAngle(tab(), D);
	const thetaSh = shadowAngle(D);

	/** Stage pixels per radian of the camera's view. */
	const PXRAD = $derived(phase === 'shadow' ? 1400 : 470);

	// ---- the hole's place -------------------------------------------------------------
	const hole = $derived.by<Point>(() => {
		const raw = params['hole:lens'];
		if (typeof raw === 'string') {
			const [x, y] = raw.split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
		}
		return { x: PXC, y: PYC };
	});
	function moveHole(p: Point) {
		const x = Math.max(PX0 + 30, Math.min(PX0 + PW - 30, p.x));
		const y = Math.max(PY0 + 30, Math.min(PY0 + PH - 30, p.y));
		setParam('hole:lens', `${Math.round(x)},${Math.round(y)}`);
	}
	// In the shadow view the hole is always centred (zoomed in on it).
	const H = $derived(phase === 'shadow' ? { x: PXC, y: PYC } : hole);

	// ---- the sky ---------------------------------------------------------------------
	const CELL = 0.032; // radians per star cell
	interface Blob {
		x: number;
		y: number;
		r: number;
		c: [number, number, number];
	}
	const blobs: Blob[] = Array.from({ length: 9 }, (_, i) => ({
		x: (hash(i, 1) - 0.5) * 1.6,
		y: (hash(i, 2) - 0.5) * 1.4,
		r: 0.12 + 0.22 * hash(i, 3),
		c: (
			[
				[40, 70, 140],
				[110, 40, 120],
				[30, 100, 120],
				[130, 60, 40]
			] as [number, number, number][]
		)[Math.floor(hash(i, 4) * 4)]
	}));
	const tints: [number, number, number][] = [
		[170, 200, 255],
		[255, 255, 255],
		[255, 240, 200],
		[255, 200, 150]
	];
	const out = new Float64Array(3);
	/** Colour of the sky at sky angles (x, y) in radians, into `out` (0–255). */
	function sky(x: number, y: number) {
		let r = 6;
		let g = 8;
		let b = 16;
		for (const bl of blobs) {
			const d2 = ((x - bl.x) ** 2 + (y - bl.y) ** 2) / (bl.r * bl.r);
			if (d2 < 9) {
				const w = 0.45 * Math.exp(-d2);
				r += bl.c[0] * w;
				g += bl.c[1] * w;
				b += bl.c[2] * w;
			}
		}
		const ci = Math.floor(x / CELL);
		const cj = Math.floor(y / CELL);
		for (let i = ci - 1; i <= ci + 1; i++) {
			for (let j = cj - 1; j <= cj + 1; j++) {
				const seed = i * 7919 + j * 104729;
				if (hash(seed, 5) > 0.4) continue;
				const sx = (i + hash(seed, 6)) * CELL;
				const sy = (j + hash(seed, 7)) * CELL;
				const br = 0.15 + 0.85 * hash(seed, 8) ** 3;
				const sig = 0.0028 + 0.0035 * br;
				const d2 = (x - sx) ** 2 + (y - sy) ** 2;
				if (d2 > 16 * sig * sig) continue;
				const w = 255 * br * Math.exp(-d2 / (2 * sig * sig)) * 1.4;
				const tint = tints[Math.floor(hash(seed, 9) * 4)];
				r += (w * tint[0]) / 255;
				g += (w * tint[1]) / 255;
				b += (w * tint[2]) / 255;
			}
		}
		out[0] = Math.min(255, r);
		out[1] = Math.min(255, g);
		out[2] = Math.min(255, b);
	}

	// ---- painting ------------------------------------------------------------------------
	let cv: HTMLCanvasElement | null = null;
	const picture = $derived.by(() => {
		if (typeof document === 'undefined') return '';
		const T0 = tab();
		const pxrad = PXRAD;
		const hx = H.x;
		const hy = H.y;
		const plain = unlensed;
		cv ??= document.createElement('canvas');
		cv.width = CAN_W;
		cv.height = CAN_H;
		const ctx = cv.getContext('2d');
		if (!ctx) return '';
		const img = ctx.createImageData(CAN_W, CAN_H);
		const px = img.data;
		// The hole's own direction in sky angles (the view's centre is 0, 0).
		const Hx = (hx - PXC) / pxrad;
		const Hy = (hy - PYC) / pxrad;
		for (let j = 0; j < CAN_H; j++) {
			for (let i = 0; i < CAN_W; i++) {
				const X = PX0 + ((i + 0.5) * PW) / CAN_W;
				const Y = PY0 + ((j + 0.5) * PH) / CAN_H;
				const k = 4 * (j * CAN_W + i);
				let sxa: number;
				let sya: number;
				if (plain) {
					sxa = (X - PXC) / pxrad;
					sya = (Y - PYC) / pxrad;
				} else {
					const dx = (X - hx) / pxrad;
					const dy = (Y - hy) / pxrad;
					const th = Math.hypot(dx, dy);
					const b = cameraImpact(D, th);
					if (b <= B_CRIT * 1.00001) {
						px[k] = 0;
						px[k + 1] = 0;
						px[k + 2] = 0;
						px[k + 3] = 255;
						continue;
					}
					const beta = th - alphaAt(T0, b);
					const f = beta / th;
					sxa = Hx + dx * f;
					sya = Hy + dy * f;
				}
				sky(sxa, sya);
				px[k] = out[0];
				px[k + 1] = out[1];
				px[k + 2] = out[2];
				px[k + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		return cv.toDataURL();
	});

	// ---- the bright star drifting behind -------------------------------------------------
	const RHO = 0.016; // its angular radius, radians
	const DRIFT = 16; // seconds per pass
	const star = $derived.by(() => {
		if (phase !== 'lens') return null;
		const u = reduced ? 0.5 : cycle(t, DRIFT);
		const rx = (-1.9 + 3.8 * u) * thetaE;
		const ry = -pass * thetaE;
		const beta = Math.hypot(rx, ry);
		const dirx = beta > 1e-9 ? rx / beta : 1;
		const diry = beta > 1e-9 ? ry / beta : 0;
		const b = Math.max(beta, 1e-6);
		const im = images(tab(), D, b);
		// Radial stretch: |dθ/dβ| by a small step in β.
		const h = 1e-4;
		const im2 = images(tab(), D, b + h);
		const radialOuter = Math.abs(im2.outer - im.outer) / h;
		const radialInner = Math.abs(im2.inner - im.inner) / h;
		// Brightening of each image: (θ/β) · |dθ/dβ| (area of image ÷ area of star),
		// for a point star. A star of radius ρ right behind the hole is brightened
		// about as much as a point star at β = ρ/2 (weak-field point lens:
		// √(1 + 4θ_E²/ρ²) ≈ 2θ_E/ρ), so β is held at ρ/2 or more for this readout.
		const bm = Math.max(beta, RHO / 2);
		const imm = bm === b ? im : images(tab(), D, bm);
		const imm2 = bm === b ? im2 : images(tab(), D, bm + h);
		const magOuter = (imm.outer / bm) * (Math.abs(imm2.outer - imm.outer) / h);
		const magInner = (imm.inner / bm) * (Math.abs(imm2.inner - imm.inner) / h);
		const half = beta < RHO ? Math.PI : Math.asin(RHO / beta);
		return {
			beta,
			ang: Math.atan2(diry, dirx),
			im,
			half,
			wOuter: RHO * radialOuter,
			wInner: RHO * radialInner,
			mag: magOuter + magInner,
			trueX: H.x + rx * PXRAD,
			trueY: H.y + ry * PXRAD
		};
	});
	/** An arc round the hole at radius R (px), centred on angle a, half-width h (rad). */
	function arc(R: number, a: number, h: number) {
		if (h >= Math.PI - 1e-6) {
			return `M${H.x + R} ${H.y} A${R} ${R} 0 1 1 ${H.x - R} ${H.y} A${R} ${R} 0 1 1 ${H.x + R} ${H.y}`;
		}
		const p = (q: number) =>
			`${(H.x + R * Math.cos(q)).toFixed(1)} ${(H.y + R * Math.sin(q)).toFixed(1)}`;
		const large = 2 * h > Math.PI ? 1 : 0;
		return `M${p(a - h)} A${R} ${R} 0 ${large} 1 ${p(a + h)}`;
	}

	const ringR = $derived(thetaE * PXRAD);
	const shadowR = $derived(thetaSh * PXRAD);
	const horizonR = $derived(Math.asin((2 * Math.sqrt(1 - 2 / D)) / D) * PXRAD);

	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') moveHole({ x: PX0, y: hole.y });
		else if (k === 'end') moveHole({ x: PX0 + PW, y: hole.y });
		else moveHole({ x: hole.x + 4 * k, y: hole.y });
	}
	const f1 = (v: number) => v.toFixed(1);
</script>

{#snippet onSky(x: number, y: number, text: string, size = 12, anchor = 'middle', weight = 600)}
	<text
		{x}
		{y}
		text-anchor={anchor}
		font-weight={weight}
		font-size={size}
		style:fill="var(--bh-on-hole)"
		style:pointer-events="none">{text}</text
	>
{/snippet}

{#snippet row(y: number, label: string, value: string, color?: string)}
	<Label anchor="start" x={CX + 16} {y} text={label} size={12.5} muted />
	<Label x={CX + CW - 16} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
{/snippet}

<g>
	<defs>
		<clipPath id="lens-clip">
			<rect x={PX0} y={PY0} width={PW} height={PH} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PX0}
		y={PY0}
		width={PW}
		height={PH}
		rx="14"
		fill="var(--bh-sky)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#lens-clip)">
		{#if picture}
			<image href={picture} x={PX0} y={PY0} width={PW} height={PH} preserveAspectRatio="none" />
		{/if}

		{#if !unlensed}
			<!-- the Einstein ring and the shadow's edge -->
			<circle
				cx={H.x}
				cy={H.y}
				r={ringR}
				fill="none"
				stroke="var(--bh-on-hole)"
				stroke-width="1"
				stroke-dasharray="4 6"
				opacity="0.55"
			/>
			{#if phase === 'shadow'}
				<circle
					cx={H.x}
					cy={H.y}
					r={horizonR}
					fill="none"
					stroke="var(--bh-on-hole)"
					stroke-width="1.2"
					stroke-dasharray="3 4"
				/>
			{/if}
		{/if}

		<!-- the bright star's images (or the star itself, without the hole) -->
		{#if star}
			{#if unlensed}
				<circle cx={star.trueX} cy={star.trueY} r={RHO * PXRAD} fill="var(--bh-star)" />
			{:else}
				{#each [{ R: star.im.outer, w: star.wOuter, a: star.ang }, { R: star.im.inner, w: star.wInner, a: star.ang + Math.PI }] as img, i (i)}
					<path
						d={arc(img.R * PXRAD, img.a, star.half)}
						fill="none"
						stroke="var(--bh-star)"
						stroke-width={Math.max(1.5, Math.min(22, 2 * img.w * PXRAD))}
						stroke-linecap="round"
						opacity="0.35"
						style:filter="blur(3px)"
					/>
					<path
						d={arc(img.R * PXRAD, img.a, star.half)}
						fill="none"
						stroke="var(--bh-star)"
						stroke-width={Math.max(1.2, Math.min(16, 1.4 * img.w * PXRAD))}
						stroke-linecap="round"
					/>
				{/each}
			{/if}
		{/if}
	</g>

	<!-- labels on the sky -->
	{#if !unlensed}
		{#if phase === 'lens'}
			{@render onSky(H.x, Math.max(PY0 + 16, H.y - ringR - 8), 'Einstein ring', 12)}
		{:else}
			{@render onSky(H.x, H.y + shadowR + 18, 'edge of the shadow: 2.6 rₛ', 12.5)}
			{@render onSky(H.x, H.y + 4, 'horizon size', 11, 'middle', 500)}
		{/if}
	{/if}

	{#if phase === 'lens'}
		<Handle
			x={H.x}
			y={H.y}
			r={7}
			label="Black hole (drag it across the sky)"
			value={Math.round(H.x)}
			min={PX0}
			max={PX0 + PW}
			valuetext="black hole at {Math.round(H.x)}, {Math.round(H.y)}"
			color="var(--bh-sphere)"
			onmove={moveHole}
			{onkey}
		/>
	{/if}

	<!-- readouts -->
	{#if phase === 'lens'}
		<Card x={CX} y={PY0} w={CW} h={200} />
		<Label anchor="start" x={CX + 16} y={PY0 + 28} text="The bright star" size={15} weight={700} />
		{#if star}
			{@render row(PY0 + 60, 'Off the line to the hole', `${f1(star.beta / thetaE)} ring radii`)}
			{@render row(
				PY0 + 88,
				'Images seen',
				unlensed ? '1 (no hole)' : star.beta < RHO ? 'a ring' : '2'
			)}
			{#if !unlensed}
				{@render row(PY0 + 116, 'Outer image at', `${f1(star.im.outer / thetaE)} ring radii`)}
				{@render row(PY0 + 144, 'Inner image at', `${f1(star.im.inner / thetaE)} ring radii`)}
				{@render row(
					PY0 + 172,
					'Brighter by',
					unlensed ? '—' : `× ${star.mag < 10 ? star.mag.toFixed(1) : star.mag.toFixed(0)}`,
					'var(--bh-star)'
				)}
			{/if}
		{/if}
		<Card x={CX} y={PY0 + 216} w={CW} h={130} />
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 242}
			text="Drag the black hole"
			size={13.5}
			weight={700}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 264}
			text="Stars near it are pushed outwards and"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 284}
			text="stretched into arcs; each also shows"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 304}
			text="a second, fainter image inside the"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 324}
			text="dashed ring, on the other side."
			size={12.5}
		/>
		<Card x={CX} y={PY1 - 96} w={CW} h={96} />
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 70}
			text="Camera 30 rₛ from the hole; every"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 50}
			text="ray’s bend traced from the model. The"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 30}
			text="ring’s size depends on that distance."
			size={12}
			muted
		/>
	{:else}
		<Card x={CX} y={PY0} w={CW} h={186} />
		<Label anchor="start" x={CX + 16} y={PY0 + 28} text="The shadow" size={15} weight={700} />
		{@render row(PY0 + 60, 'Horizon radius', '1 rₛ')}
		{@render row(PY0 + 88, 'Shadow radius', `${f1(B_CRIT / 2)} rₛ`, 'var(--bh-sphere)')}
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 118}
			text="Every ray aimed inside 2.6 rₛ falls"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 138}
			text="in, so the dark disc is 2.6 times"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 158}
			text="wider than the horizon itself."
			size={12.5}
		/>
		<Card x={CX} y={PY0 + 202} w={CW} h={178} />
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 228}
			text="Event Horizon Telescope"
			size={13.5}
			weight={700}
		/>
		{@render row(PY0 + 254, 'M87* (2019)', '')}
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 274}
			text="6.2 billion suns; predicted 38 µas,"
			size={12}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 292}
			text="ring measured 42 ± 3 µas"
			size={12}
			weight={600}
		/>
		{@render row(PY0 + 318, 'Sgr A* (2022)', '')}
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 338}
			text="4.15 million suns; predicted 52 µas,"
			size={12}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY0 + 356}
			text="ring measured 51.8 ± 2.3 µas"
			size={12}
			weight={600}
		/>
		<Card x={CX} y={PY1 - 96} w={CW} h={96} />
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 70}
			text="µas: a millionth of an arcsecond."
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 50}
			text="52 µas is about the size of a doughnut"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={PY1 - 30}
			text="on the Moon, seen from the Earth."
			size={12}
			muted
		/>
	{/if}
</g>
