<script lang="ts">
	/**
	 * Beer–Lambert, photon by photon. X-ray photons fly from the tube (left)
	 * through a slab of params.material, params.thickness cm thick, at
	 * params.energy keV, to a detector (right). Each photon's free path is drawn
	 * from the exponential distribution with mean 1/μ (a hash of its number, so
	 * the picture is a pure function of t); if it is shorter than the slab the
	 * photon is removed there (absorbed or scattered), with a short flash.
	 *
	 * Below: the fraction getting through against thickness, e^(−μx), for every
	 * material at the chosen energy (μ from the NIST tables), the chosen one
	 * bold with the current thickness and its half-value layer marked.
	 */
	import { hash, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { halfValueLayer, mu, transmitted } from '../imaging';
	import type { XrayMaterial } from '../tissues';

	let { t, params, reduced }: StageProps = $props();

	const MATS: { id: XrayMaterial; name: string; fill: string }[] = [
		{ id: 'soft', name: 'soft tissue', fill: 'var(--mi-soft)' },
		{ id: 'fat', name: 'fat', fill: 'var(--mi-fat)' },
		{ id: 'bone', name: 'bone', fill: 'var(--mi-bone)' },
		{ id: 'lung', name: 'lung', fill: 'var(--mi-lung)' },
		{ id: 'water', name: 'water', fill: 'var(--mi-water)' }
	];
	const mat = $derived((MATS.find((m) => m.id === params.material) ?? MATS[0]).id);
	const matInfo = $derived(MATS.find((m) => m.id === mat) ?? MATS[0]);
	const x = $derived(Number(params.thickness ?? 6));
	const keV = $derived(Number(params.energy ?? 60));
	const m = $derived(mu(mat, keV));
	const frac = $derived(transmitted(m, x));
	const hvl = $derived(halfValueLayer(m));

	// ---- the beam ------------------------------------------------------------------------
	const TUBE_X = 70;
	const SLAB_X = 250;
	const PX = 22; // px per cm
	const DET_X = 730;
	const Y_TOP = 70;
	const LANES = 22;
	const LANE_H = 12;
	const SPEED = 260; // px/s
	const SPAN = DET_X - TUBE_X;
	const PER_LANE = 4;
	const slabW = $derived(x * PX);

	const photons = $derived.by(() => {
		const out: { id: number; x: number; y: number; o: number; stopped: boolean }[] = [];
		const tt = reduced ? 2.5 : t;
		for (let l = 0; l < LANES; l++) {
			const y = Y_TOP + 10 + l * LANE_H;
			for (let k = 0; k < PER_LANE; k++) {
				const pos = tt * SPEED + hash(l, 3) * SPAN + (k * SPAN) / PER_LANE;
				const cycle = Math.floor(pos / (SPAN + 60));
				const along = pos - cycle * (SPAN + 60);
				const id = l * 7919 + k * 104729 + cycle * 13;
				const u = Math.max(1e-9, hash(id, 11));
				const free = -Math.log(u) / m; // cm
				const stopAt = free < x ? SLAB_X + free * PX : Infinity;
				const px = TUBE_X + along;
				if (px <= stopAt) {
					if (px > DET_X) continue;
					out.push({ id, x: px, y, o: 1, stopped: false });
				} else {
					// fade out over 50 px of "time" after being removed
					const after = (px - stopAt) / 50;
					if (after < 1) out.push({ id, x: stopAt, y, o: 1 - after, stopped: true });
				}
			}
		}
		return out;
	});

	// ---- the chart -----------------------------------------------------------------------
	const GX = 80;
	const GY = 380;
	const GW = 420;
	const GH = 170;
	const gx = (cm: number) => GX + (cm / 20) * GW;
	const gy = (f: number) => GY + GH - f * GH;
	const curve = (id: XrayMaterial) => {
		const mm = mu(id, keV);
		return Array.from({ length: 81 }, (_, i) => {
			const c = (i / 80) * 20;
			return `${i ? 'L' : 'M'}${gx(c).toFixed(1)} ${gy(transmitted(mm, c)).toFixed(1)}`;
		}).join(' ');
	};
	const pct = (f: number) =>
		f >= 0.1
			? `${(f * 100).toFixed(0)}%`
			: f >= 0.001
				? `${(f * 100).toFixed(1)}%`
				: f >= 1e-9
					? `${(f * 100).toExponential(1)}%`
					: 'less than 1 in a billion';
</script>

<g>
	<!-- tube, slab and detector -->
	<rect
		x={TUBE_X - 46}
		y={Y_TOP - 6}
		width={40}
		height={LANES * LANE_H + 12}
		rx="6"
		fill="var(--mi-tube)"
	/>
	<Label x={TUBE_X - 26} y={Y_TOP - 16} text="X-ray tube" />
	{#if x > 0}
		<rect
			x={SLAB_X}
			y={Y_TOP - 10}
			width={slabW}
			height={LANES * LANE_H + 20}
			rx="4"
			fill={matInfo.fill}
			stroke={mat === 'bone' ? 'var(--mi-bone-edge)' : 'var(--stage-line)'}
		/>
	{/if}
	<Readout id="slab" order={1} label="Slab" value="{x} cm of {matInfo.name}">
		<Label x={SLAB_X + Math.max(slabW, 60) / 2} y={Y_TOP - 18} text="{x} cm of {matInfo.name}" />
	</Readout>
	<rect
		x={DET_X + 4}
		y={Y_TOP - 6}
		width={10}
		height={LANES * LANE_H + 12}
		fill="var(--mi-detector)"
	/>
	<Label x={DET_X + 9} y={Y_TOP - 16} text="detector" />

	{#each photons as p (p.id)}
		{#if p.stopped}
			<circle
				cx={p.x}
				cy={p.y}
				r={3 + 5 * (1 - p.o)}
				fill="none"
				stroke="var(--mi-xray)"
				stroke-width="1.2"
				opacity={p.o * 0.8}
			/>
		{:else}
			<circle cx={p.x} cy={p.y} r="3" fill="var(--mi-xray)" />
		{/if}
	{/each}

	<!-- readouts -->
	<Readout
		id="mu"
		order={2}
		label="Attenuation coefficient"
		value="μ = {m.toFixed(m < 0.1 ? 3 : 2)} per cm"
		note="at {keV} keV"
	>
		<text x={560} y={410} style:font-size="15px" font-weight="600"
			>μ = {m.toFixed(m < 0.1 ? 3 : 2)} per cm</text
		>
		<Label x={560} y={432} anchor="start" muted text="{matInfo.name} at {keV} keV (NIST)" />
	</Readout>
	<Readout id="hvl" order={3} label="Half-value layer" value="{hvl.toFixed(hvl < 1 ? 2 : 1)} cm">
		<Label
			x={560}
			y={464}
			anchor="start"
			text="half-value layer: {hvl.toFixed(hvl < 1 ? 2 : 1)} cm"
		/>
	</Readout>
	<Readout id="frac" order={4} label="Photons getting through" value={pct(frac)}>
		<text x={560} y={500} style:font-size="15px" font-weight="600"
			>getting through: {pct(frac)}</text
		>
		<Label x={560} y={522} anchor="start" muted text="I/I₀ = e^−μx = e^−{(m * x).toFixed(2)}" />
	</Readout>

	<!-- the chart -->
	<g>
		<line x1={GX} y1={GY + GH} x2={GX + GW} y2={GY + GH} stroke="var(--stage-line)" />
		<line x1={GX} y1={GY} x2={GX} y2={GY + GH} stroke="var(--stage-line)" />
		{#each [0, 0.5, 1] as f (f)}
			<Label x={GX - 6} y={gy(f) + 4} anchor="end" muted text="{f * 100}%" />
		{/each}
		{#each [0, 5, 10, 15, 20] as c (c)}
			<Label x={gx(c)} y={GY + GH + 18} muted text={String(c)} />
		{/each}
		<Label x={GX + GW} y={GY + GH + 36} anchor="end" muted text="thickness, cm" />
		{#each MATS as mm (mm.id)}
			<path
				d={curve(mm.id)}
				fill="none"
				stroke={mm.id === mat ? 'var(--mi-xray)' : 'var(--stage-ink-muted)'}
				stroke-width={mm.id === mat ? 2.5 : 1}
				opacity={mm.id === mat ? 1 : 0.6}
			/>
		{/each}
		{#if hvl <= 20}
			<line
				x1={gx(hvl)}
				y1={gy(0.5)}
				x2={gx(hvl)}
				y2={GY + GH}
				stroke="var(--mi-xray)"
				stroke-dasharray="3 3"
			/>
			<line
				x1={GX}
				y1={gy(0.5)}
				x2={gx(hvl)}
				y2={gy(0.5)}
				stroke="var(--mi-xray)"
				stroke-dasharray="3 3"
			/>
		{/if}
		<circle
			cx={gx(x)}
			cy={gy(frac)}
			r="5"
			fill="var(--mi-xray)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<Readout id="charthead">
			<Label
				x={GX}
				y={GY - 12}
				anchor="start"
				text="fraction getting through, at {keV} keV (grey: the other materials)"
			/>
		</Readout>
	</g>
</g>
