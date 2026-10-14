<script lang="ts">
	/**
	 * Powers of ten, to scale: the view is 10^(4 − zoom) m across, from a 4 km
	 * LIGO arm down to the change in its length that GW150914 caused, ΔL = h·L =
	 * 4 × 10⁻¹⁸ m, next to a proton. Every object is drawn at its true size for the
	 * current view (circles centred on the stage), and labelled while it is
	 * between ~20 px and the width of the view.
	 *
	 * On entering the step, and on `params.dive`, the view zooms in smoothly from
	 * 4 km (18 s); moving `params.zoom` takes over. The start time of a dive is
	 * remembered in a frame-to-frame memo inside a $derived (the scene guide's
	 * sanctioned exception, as in oscillations-resonance/SpringScene). Reduced
	 * motion: the slider's view (by default all the way in).
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GW150914, LIGO_ARM, PROTON_RADIUS, armDifference } from '../gw';
	import { length } from '../steps';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const ZMAX = 18.4; // a proton fills the view
	const DIVE = 18; // s
	const slider = $derived(Number(params.zoom ?? ZMAX));
	const dive = $derived(Number(params.dive ?? 0));

	// ---- which zoom to show ------------------------------------------------------------------
	let memo = { dive: -1, zoom: NaN, start: 0, auto: true };
	const z = $derived.by(() => {
		if (reduced) return slider;
		if (dive !== memo.dive)
			memo = { dive, zoom: slider, start: memo.dive === -1 ? 0 : t, auto: true };
		else if (slider !== memo.zoom) memo = { ...memo, zoom: slider, auto: false };
		if (t < memo.start) memo = { ...memo, start: 0 };
		return memo.auto ? ZMAX * smoothstep(0.5, DIVE, t - memo.start) : slider;
	});

	// ---- the view ----------------------------------------------------------------------------
	const PX0 = 16;
	const PY0 = 16;
	const PX1 = 944;
	const PY1 = 468;
	const CX = (PX0 + PX1) / 2;
	const CY = (PY0 + PY1) / 2;
	const VIEW = 880; // px across the view
	const width = $derived(10 ** (4 - z)); // m
	const k = $derived(VIEW / width); // px per m
	const insideProton = $derived(PROTON_RADIUS * k >= 3000);

	const dl = armDifference(GW150914.peakStrain);
	const objects = [
		{ id: 'person', name: 'a person', size: 1.8 },
		{ id: 'hair', name: 'a human hair, ~0.1 mm thick', size: 1e-4 },
		{ id: 'cell', name: 'a red blood cell', size: 7.5e-6 },
		{ id: 'virus', name: 'a virus', size: 1e-7 },
		{ id: 'atom', name: 'an atom, ~0.1 nm', size: 1e-10 },
		{ id: 'nucleus', name: 'a gold nucleus', size: 1.4e-14 },
		{ id: 'proton', name: 'a proton', size: 2 * PROTON_RADIUS }
	];
	const shown = $derived(
		objects
			.map((o) => ({ ...o, r: (o.size * k) / 2 }))
			.filter((o) => o.r > 1 && o.r < 3000)
			.map((o) => ({ ...o, labelled: o.r > 6 && o.r < 700 }))
	);
	const armPx = $derived(LIGO_ARM * k);
	const dlPx = $derived(dl * k);
	const inView = $derived.by(() => {
		const l = shown.filter((o) => o.labelled).map((o) => o.name.split(',')[0]);
		if (armPx > 40 && armPx < 1e6) l.unshift('the 4 km arm');
		if (dlPx > 3) l.push('ΔL');
		return l.length ? l.join(', ') : '—';
	});
	const ratio = Math.round((2 * PROTON_RADIUS) / dl);
</script>

<g>
	<defs>
		<clipPath id="scale-clip">
			<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#scale-clip)">
		<!-- the arm: a bar 4 km long, through the centre -->
		{#if armPx > 4 && armPx < 1e6}
			<rect
				x={CX - armPx / 2}
				y={CY - Math.min(6, Math.max(2, armPx / 200))}
				width={armPx}
				height={2 * Math.min(6, Math.max(2, armPx / 200))}
				fill="var(--gw-laser)"
				opacity="0.35"
			/>
		{/if}
		{#each shown as o (o.id)}
			<circle
				cx={CX}
				cy={CY}
				r={o.r}
				fill={o.id === 'proton' ? 'var(--gw-proton)' : 'none'}
				fill-opacity={o.id === 'proton' ? 0.35 : 0}
				stroke={o.id === 'proton' ? 'var(--gw-proton)' : 'var(--stage-ink)'}
				stroke-width="1.5"
				opacity={o.id === 'proton' ? 1 : 0.6}
			/>
		{/each}
		{#if insideProton}
			<rect
				x={PX0}
				y={PY0}
				width={PX1 - PX0}
				height={PY1 - PY0}
				fill="var(--gw-proton)"
				opacity="0.18"
			/>
		{/if}
		<!-- ΔL: a bar of its true length -->
		{#if dlPx > 0.3}
			<rect x={CX - dlPx / 2} y={CY - 3} width={Math.max(1, dlPx)} height="6" fill="var(--gw-dl)" />
		{/if}
	</g>
	<Readout id="scale-labels">
		{#if armPx > 40 && armPx < 2000}
			<T
				x={CX}
				y={CY - 16}
				text="LIGO arm, 4 km"
				anchor="middle"
				size={12.5}
				weight={600}
				color="var(--gw-laser)"
			/>
		{/if}
		{#each shown.filter((o) => o.labelled) as o (o.id)}
			<T
				x={CX}
				y={Math.max(PY0 + 22, CY - o.r - 8)}
				text={o.name}
				anchor="middle"
				size={12.5}
				weight={600}
				color={o.id === 'proton' ? 'var(--gw-proton)' : undefined}
			/>
		{/each}
		{#if insideProton}
			<T
				x={PX0 + 24}
				y={PY0 + 30}
				text="inside a proton: its edge is far off screen"
				size={12.5}
				weight={600}
				color="var(--gw-proton)"
			/>
		{/if}
		{#if dlPx <= 3 && dlPx > 0.3}
			<line
				x1={CX + 40}
				y1={CY + 40}
				x2={CX + 4}
				y2={CY + 4}
				stroke="var(--gw-dl)"
				stroke-width="1.5"
			/>
			<T
				x={CX + 44}
				y={CY + 54}
				text="ΔL: this dot ({dlPx.toFixed(1)} px)"
				size={13}
				weight={700}
				color="var(--gw-dl)"
			/>
		{/if}
		{#if dlPx > 3}
			<T
				x={CX}
				y={CY + 22}
				text="ΔL = {length(dl)}"
				anchor="middle"
				size={13}
				weight={700}
				color="var(--gw-dl)"
			/>
		{/if}
		<!-- view width -->
		<line x1={PX0 + 40} x2={PX1 - 40} y1={PY1 - 24} y2={PY1 - 24} stroke="var(--stage-line)" />
		<line x1={PX0 + 40} x2={PX0 + 40} y1={PY1 - 30} y2={PY1 - 18} stroke="var(--stage-line)" />
		<line x1={PX1 - 40} x2={PX1 - 40} y1={PY1 - 30} y2={PY1 - 18} stroke="var(--stage-line)" />
		<T x={CX} y={PY1 - 30} text="{length(width)} across" anchor="middle" size={12} muted />
	</Readout>

	<!-- readouts -->
	<Card x={PX0} y={484} w={PX1 - PX0} h={100} />
	<Row
		id="view"
		order={1}
		x={PX0 + 20}
		y={514}
		w={420}
		label="Width of the view"
		value={length(width)}
	/>
	<Row id="inview" order={2} x={PX0 + 20} y={540} w={420} label="In view" value={inView} />
	<Row
		id="dl"
		order={3}
		x={PX0 + 480}
		y={514}
		w={428}
		label="ΔL = h·L (h = 10⁻²¹, L = 4 km)"
		value={length(dl)}
		color="var(--gw-dl)"
	/>
	<Row
		id="proton"
		order={4}
		x={PX0 + 480}
		y={540}
		w={428}
		label="A proton is"
		value="{ratio} times wider"
		color="var(--gw-proton)"
	/>
	<Readout id="scale-note">
		<T
			x={PX0 + 20}
			y={570}
			text="Everything at its true size for this view; zoom with the slider, or ▶ dive in again."
			size={12}
			muted
		/>
	</Readout>
</g>
