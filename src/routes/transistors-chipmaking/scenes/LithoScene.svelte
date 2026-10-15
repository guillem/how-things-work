<script lang="ts">
	/**
	 * How small light can print. The reader picks a scanner (`params.tool`) and the line
	 * size as Rayleigh's k₁ (`params.k1`), so the half-pitch is k₁·λ/NA.
	 * - Top left, the lens's pupil (a circle of radius NA): the two source poles of the
	 *   dipole illumination and, for each pole's centre, the diffraction orders of the mask
	 *   at σ_c ± m·λ/(p·NA). Orders inside the circle are caught (filled), the rest miss.
	 * - Bottom, three periods of the mask (chrome bars), the aerial image computed by
	 *   `aerialImage` (Abbe's method over the whole poles; ideal in-focus lens), and the
	 *   resist left after developing, which falls steeply from full to none around the
	 *   image's mean intensity (the dose is set so that lines and gaps print equal). A
	 *   faint image leaves a half-developed blur; a flat one, a uniform half-height film.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DIPOLE, aerialImage, halfPitch, k1 as k1Of, toolById } from '../model';

	let { params, t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);
	const tool = $derived(toolById(String(params.tool ?? 'arfi')));
	const kTarget = $derived(clamp(Number(params.k1 ?? 0.4), 0.2, 0.6));
	const K = Tween.of(() => kTarget, { duration: 300, easing: cubicInOut });
	const k = $derived(reduced ? kTarget : K.current);
	const hp = $derived(halfPitch(k, tool));
	const image = $derived(aerialImage(hp, tool, 96)); // N samples per pitch
	const f = $derived(tool.lambda / (2 * hp * tool.na)); // order spacing in the pupil, units of NA

	// ---- pupil ----
	const PCX = 230;
	const PCY = 200;
	const PR = 92;
	const orders = $derived(
		[1, -1].flatMap((sign) =>
			[-3, -2, -1, 0, 1, 2, 3].map((m) => {
				const u = sign * DIPOLE.center + m * f;
				return { key: `${sign}:${m}`, sign, m, u, inside: Math.abs(u) <= 1 };
			})
		)
	);
	const caught = $derived(orders.filter((o) => o.inside && o.sign === 1).length);

	// ---- image ----
	const X0 = 80;
	const X1 = 880;
	const PERIODS = 3;
	const MASK_Y = 378;
	const IY0 = 406;
	const IY1 = 496;
	const RY = 534; // resist base line
	const RH = 30;
	const N = 96;
	const xAt = (period: number, s: number) => X0 + ((period + s) / PERIODS) * (X1 - X0);
	/** Intensity at fraction `s` of a pitch, where 0 is the centre of a clear (glass) line. */
	const samples = $derived(
		Array.from({ length: PERIODS * N + 1 }, (_, j) => {
			const period = Math.floor(j / N);
			const i = j % N;
			// Each pitch starts with its chrome line (s 0–0.5); the glass centre is at s = 0.75.
			const idx = (i + Math.round(N * 0.25)) % N;
			return { x: xAt(Math.min(period, PERIODS), i / N), I: image.I[idx] };
		})
	);
	const IMAX_PLOT = 1.1;
	const iy = (I: number) => lerp(IY1, IY0, I / IMAX_PLOT);
	const imgPath = $derived(
		samples.map((p, j) => `${j ? 'L' : 'M'}${p.x.toFixed(1)} ${iy(p.I).toFixed(1)}`).join('')
	);
	const mean = $derived((image.max + image.min) / 2);
	/** Resist left after developing (positive resist: dissolves where the light was strong). */
	const resistPath = $derived(
		samples
			.map((p, j) => {
				const left = 1 / (1 + Math.exp((p.I - mean) / 0.025));
				return `${j ? 'L' : 'M'}${p.x.toFixed(1)} ${(RY - RH * left).toFixed(1)}`;
			})
			.join('') + `L${X1} ${RY} L${X0} ${RY} Z`
	);
	// Chrome lines: each pitch starts with a chrome line half a pitch wide.
	const chrome = Array.from({ length: PERIODS }, (_, i) => i);

	const contrastPct = $derived(Math.round(image.contrast * 100));
	const verdict = $derived(
		image.contrast > 0.6
			? 'a sharp image: lines and gaps print'
			: image.contrast > 0.15
				? 'a faint image: the pattern blurs'
				: 'no usable image: the pattern is lost'
	);
	const specK1 = $derived(k1Of(tool.spec, tool));
	const nm = (v: number) => (v >= 20 ? `${Math.round(v)} nm` : `${v.toFixed(1)} nm`);
	const glow = $derived(0.75 + 0.25 * Math.sin(time * 3));
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
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- ===== pupil ===== -->
	<Readout id="pupil-title">
		{@render txt(PCX, 66, 'What the lens catches', 14, { weight: 700 })}
		{@render txt(PCX, 84, 'beams from the mask, inside its aperture (circle)', 12, { muted: true })}
	</Readout>
	<circle
		cx={PCX}
		cy={PCY}
		r={PR}
		fill="var(--tc-glass)"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	{#each [1, -1] as sign (sign)}
		<circle
			cx={PCX + sign * DIPOLE.center * PR}
			cy={PCY}
			r={DIPOLE.radius * PR}
			fill="var(--tc-uv)"
			opacity={0.25 * glow}
		/>
	{/each}
	{#each orders as o (o.key)}
		{@const x = PCX + o.u * PR}
		{@const y = PCY + (o.sign === 1 ? -14 : 14)}
		{#if x > 30 && x < 450}
			<circle
				cx={x}
				cy={y}
				r="6"
				fill={o.inside ? (o.sign === 1 ? 'var(--tc-uv)' : 'var(--tc-ion)') : 'var(--stage-bg)'}
				stroke={o.sign === 1 ? 'var(--tc-uv)' : 'var(--tc-ion)'}
				stroke-width="2"
				opacity={o.inside ? 1 : 0.55}
			/>
			{#if o.m === 0}
				<text
					{x}
					y={y + (o.sign === 1 ? -11 : 21)}
					text-anchor="middle"
					font-size="10"
					class="muted">0</text
				>
			{/if}
		{/if}
	{/each}
	<Readout id="caught">
		{@render txt(PCX, PCY + PR + 26, `beams caught from each light spot: ${caught}`, 13, {
			weight: 700,
			color: caught >= 2 ? 'var(--tc-on)' : 'var(--circ-high)'
		})}
		{@render txt(
			PCX,
			PCY + PR + 44,
			caught >= 2
				? 'two or more beams interfere into an image'
				: image.contrast > 0.02
					? 'only the outer edge of each spot still gets two in'
					: 'one beam alone carries no pattern',
			12,
			{ muted: true }
		)}
	</Readout>

	<!-- ===== numbers ===== -->
	<Readout id="tool" order={1} label="Scanner" value="{tool.light}, NA {tool.na}">
		{@render txt(520, 66, `${tool.name}`, 15, { anchor: 'start', weight: 700 })}
		{@render txt(520, 86, `${tool.light}, numerical aperture ${tool.na}`, 12, {
			anchor: 'start',
			muted: true
		})}
	</Readout>
	<Readout
		id="hp"
		order={2}
		label="Half-pitch"
		value="{k.toFixed(3)} × {tool.lambda} nm / {tool.na} = {nm(hp)}"
	>
		{@render txt(520, 126, `half-pitch = k₁ · λ / NA`, 13, { anchor: 'start', weight: 600 })}
		{@render txt(520, 150, `= ${k.toFixed(3)} × ${tool.lambda} nm / ${tool.na} = ${nm(hp)}`, 16, {
			anchor: 'start',
			weight: 700
		})}
	</Readout>
	<Readout id="contrast" order={3} label="Image contrast" value="{contrastPct} %: {verdict}">
		{@render txt(520, 190, `image contrast ${contrastPct} %`, 14, { anchor: 'start', weight: 700 })}
		{@render txt(520, 210, verdict, 13, {
			anchor: 'start',
			weight: 600,
			color: image.contrast > 0.6 ? 'var(--tc-on)' : 'var(--circ-high)'
		})}
	</Readout>
	<Readout
		id="spec"
		order={5}
		label="Quoted resolution"
		value="{tool.spec} nm (k₁ = {specK1.toFixed(2)})"
	>
		{@render txt(520, 250, `quoted resolution of this scanner: ${tool.spec} nm`, 12, {
			anchor: 'start',
			muted: true
		})}
		{@render txt(520, 268, `(k₁ = ${specK1.toFixed(2)}: real resists and lenses need margin)`, 12, {
			anchor: 'start',
			muted: true
		})}
	</Readout>

	<!-- ===== mask, image, resist ===== -->
	<Readout id="mask-label">
		{@render txt(X0, MASK_Y - 10, 'mask: chrome lines and glass gaps of equal width', 12, {
			anchor: 'start',
			weight: 600
		})}
	</Readout>
	<rect
		x={X0}
		y={MASK_Y}
		width={X1 - X0}
		height="12"
		fill="var(--tc-glass)"
		stroke="var(--border)"
	/>
	{#each chrome as i (i)}
		<rect
			x={xAt(i, 0)}
			y={MASK_Y}
			width={(X1 - X0) / PERIODS / 2}
			height="12"
			fill="var(--tc-chrome)"
		/>
	{/each}
	<line x1={X0} x2={X1} y1={IY1} y2={IY1} stroke="var(--stage-line)" />
	<line
		x1={X0}
		x2={X1}
		y1={iy(mean)}
		y2={iy(mean)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<path d="{imgPath}L{X1} {IY1}L{X0} {IY1}Z" fill="var(--tc-uv)" opacity="0.18" />
	<path d={imgPath} fill="none" stroke="var(--tc-uv)" stroke-width="2.5" />
	<Readout id="image-label">
		{@render txt(X1, IY0 - 6, 'light on the wafer', 12, {
			anchor: 'end',
			weight: 600,
			color: 'var(--tc-uv)'
		})}
	</Readout>
	<path d={resistPath} fill="var(--tc-resist)" />
	<line x1={X0} x2={X1} y1={RY} y2={RY} stroke="var(--tc-poly-edge)" stroke-width="2" />
	<Readout id="resist-label">
		{@render txt(X0, RY + 22, 'resist left after developing', 12, { anchor: 'start', weight: 600 })}
		{@render txt(X1, RY + 22, `one pitch = ${nm(2 * hp)}`, 12, { anchor: 'end', muted: true })}
	</Readout>
</g>
