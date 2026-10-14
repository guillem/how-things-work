<script lang="ts">
	/**
	 * Three distances to a source seen today at redshift z (`params.zFar`, log₁₀ z), all from
	 * `distances(z)`: how far it was when the light left (then), how far the light travelled
	 * (c × travel time) and how far it is now (comoving). Top: the three against z on a log
	 * axis, with real objects marked; bottom: the same three as bars, with a pulse of light
	 * running along the light-travel bar (6 s loop; parked at the end under reduced motion).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { AGE, GYR_S, HORIZON, HUBBLE_DISTANCE, distances, recession } from '../cosmology';
	import { glyText, gyrText, timeText, zText } from '../format';
	const speedText = (v: number) =>
		`${v >= 10 ? v.toFixed(0) : v.toFixed(v < 0.1 ? 3 : 2)} × light speed`;
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { t, params, reduced }: StageProps = $props();

	const lz = $derived(Number(params.zFar ?? Math.log10(14.18)));
	const z = $derived(10 ** lz);
	const d = $derived(distances(z));
	const vNow = $derived(recession(d.comoving, 1));
	const vThen = $derived(recession(d.then, 1 / (1 + z)));

	// ---- the plot -----------------------------------------------------------------------
	const P = { x: 76, y: 66, w: 520, h: 276 };
	const LZ0 = -2;
	const LZ1 = Math.log10(1089.92);
	const DMAX = 50;
	const px = (l: number) => P.x + ((l - LZ0) / (LZ1 - LZ0)) * P.w;
	const py = (v: number) => P.y + P.h - (v / DMAX) * P.h;
	const SAMPLES = Array.from({ length: 121 }, (_, k) => {
		const l = LZ0 + ((LZ1 - LZ0) * k) / 120;
		return { l, ...distances(10 ** l) };
	});
	const line = (f: (s: (typeof SAMPLES)[number]) => number) =>
		SAMPLES.map((s, k) => `${k ? 'L' : 'M'}${px(s.l).toFixed(1)} ${py(f(s)).toFixed(1)}`).join(' ');
	const SERIES = [
		{ id: 'now', label: 'where it is now', color: 'var(--bb-red)', d: line((s) => s.comoving) },
		{
			id: 'travel',
			label: 'how far the light travelled',
			color: 'var(--bb-arrow)',
			d: line((s) => s.lightTravel)
		},
		{
			id: 'then',
			label: 'where it was when the light left',
			color: 'var(--bb-curve)',
			d: line((s) => s.then)
		}
	];
	const OBJECTS = [
		{ id: 'coma', name: 'Coma cluster', z: 0.0231 },
		{ id: '3c273', name: 'quasar 3C 273', z: 0.158 },
		{ id: 'gnz11', name: 'GN-z11', z: 10.6 },
		{ id: 'jades', name: 'JADES-GS-z14-0', z: 14.18 },
		{ id: 'cmb', name: 'CMB', z: 1089.92 }
	];
	const zName = $derived(OBJECTS.find((o) => Math.abs(Math.log10(o.z) - lz) < 0.02)?.name);
	const zTicks = [0.01, 0.1, 1, 10, 100, 1000];

	// ---- the bars -----------------------------------------------------------------------
	const BX = 40;
	const BW = 860;
	const bx = (v: number) => BX + (v / DMAX) * BW;
	const BARS = $derived([
		{
			id: 'then',
			y: 440,
			v: d.then,
			color: 'var(--bb-curve)',
			label: `When the light left: ${glyText(d.then)}`
		},
		{
			id: 'travel',
			y: 492,
			v: d.lightTravel,
			color: 'var(--bb-arrow)',
			label: `Light travelled for ${gyrText(d.lightTravel)}: ${glyText(d.lightTravel)}`
		},
		{
			id: 'now',
			y: 544,
			v: d.comoving,
			color: 'var(--bb-red)',
			label: `Now: ${glyText(d.comoving)}`
		}
	]);
	const pulse = $derived(reduced ? 1 : Math.min(1, (t % 6) / 5));
</script>

<g>
	<Card x={16} y={16} w={600} h={370} />
	<T x={36} y={40} text="Distance against redshift" size={15} weight={700} />
	{#each [0, 10, 20, 30, 40, 50] as v (v)}
		<line x1={P.x} x2={P.x + P.w} y1={py(v)} y2={py(v)} stroke="var(--stage-grid)" />
		<T x={P.x - 6} y={py(v) + 4} text={String(v)} size={11} anchor="end" muted />
	{/each}
	{#each zTicks as zt (zt)}
		<T
			x={px(Math.log10(zt))}
			y={P.y + P.h + 16}
			text={String(zt)}
			size={11}
			anchor="middle"
			muted
		/>
	{/each}
	<line x1={P.x} x2={P.x + P.w} y1={P.y + P.h} y2={P.y + P.h} stroke="var(--stage-line)" />
	<line x1={P.x} x2={P.x} y1={P.y} y2={P.y + P.h} stroke="var(--stage-line)" />
	<T x={P.x - 6} y={P.y - 10} text="billion light years" size={11} muted />
	<T x={P.x + P.w} y={P.y + P.h + 32} text="redshift z (log scale)" size={11} anchor="end" muted />
	<!-- the horizon and the age -->
	<line
		x1={P.x}
		x2={P.x + P.w}
		y1={py(HORIZON)}
		y2={py(HORIZON)}
		stroke="var(--bb-red)"
		stroke-dasharray="4 4"
		opacity="0.6"
	/>
	<T
		x={P.x + 8}
		y={py(HORIZON) - 6}
		text="edge of the observable universe, {HORIZON.toFixed(1)}"
		size={10.5}
		muted
	/>
	<line
		x1={P.x}
		x2={P.x + P.w}
		y1={py(AGE)}
		y2={py(AGE)}
		stroke="var(--bb-arrow)"
		stroke-dasharray="4 4"
		opacity="0.6"
	/>
	<T x={P.x + 8} y={py(AGE) + 14} text="13.8: the age of the universe × c" size={10.5} muted />
	{#each SERIES as s (s.id)}
		<path d={s.d} fill="none" stroke={s.color} stroke-width="2.4" />
	{/each}
	{#each OBJECTS as o (o.id)}
		<line
			x1={px(Math.log10(o.z))}
			x2={px(Math.log10(o.z))}
			y1={P.y + P.h - 6}
			y2={P.y + P.h}
			stroke="var(--stage-ink)"
		/>
	{/each}
	<!-- the chosen redshift -->
	<line
		x1={px(lz)}
		x2={px(lz)}
		y1={P.y}
		y2={P.y + P.h}
		stroke="var(--bb-view)"
		stroke-width="1.5"
		opacity="0.7"
	/>
	<circle cx={px(lz)} cy={py(d.comoving)} r="5" fill="var(--bb-red)" />
	<circle cx={px(lz)} cy={py(d.lightTravel)} r="5" fill="var(--bb-arrow)" />
	<circle cx={px(lz)} cy={py(d.then)} r="5" fill="var(--bb-curve)" />

	<!-- readouts -->
	<Card x={632} y={16} w={312} h={370} />
	<Readout id="z" order={1} label="Redshift" value={zName ? `${zText(z)} (${zName})` : zText(z)}>
		<T x={652} y={44} text="z = {zText(z)}" size={16} weight={700} />
	</Readout>
	{#each OBJECTS as o (o.id)}
		{#if Math.abs(Math.log10(o.z) - lz) < 0.02}
			<Readout id="obj">
				<T x={924} y={44} text={o.name} size={13} weight={650} anchor="end" />
			</Readout>
		{/if}
	{/each}
	<Readout id="sent" order={3} label="Light set off" value="{gyrText(AGE - d.emitted)} ago">
		<T x={652} y={76} text="Light set off" size={12.5} muted />
		<T x={924} y={76} text="{gyrText(AGE - d.emitted)} ago" size={13.5} weight={700} anchor="end" />
		<T x={652} y={98} text="when the universe was" size={12.5} muted />
		<T x={924} y={98} text={timeText(d.emitted * GYR_S)} size={13.5} weight={700} anchor="end" />
	</Readout>
	{#each SERIES as s, i (s.id)}
		{@const v = s.id === 'now' ? d.comoving : s.id === 'travel' ? d.lightTravel : d.then}
		<Readout id="d-{s.id}" order={4 + i} label={s.label} value={glyText(v)} color={s.color}>
			<rect x={652} y={124 + i * 46} width="12" height="12" rx="2" fill={s.color} />
			<T x={672} y={135 + i * 46} text={s.label} size={12.5} />
			<T
				x={924}
				y={157 + i * 46}
				text={glyText(v)}
				size={13.5}
				weight={700}
				anchor="end"
				color={s.color}
			/>
		</Readout>
	{/each}
	<Readout id="speed">
		<T x={652} y={286} text="Receding now" size={12.5} muted />
		<T x={924} y={286} text={speedText(vNow)} size={13.5} weight={700} anchor="end" />
		<T x={652} y={310} text="when the light left" size={12.5} muted />
		<T x={924} y={310} text={speedText(vThen)} size={13.5} weight={700} anchor="end" />
	</Readout>
	<Readout id="speed-note">
		<T x={652} y={342} text="Distances grow faster than light beyond" size={11.5} muted />
		<T
			x={652}
			y={360}
			text="{HUBBLE_DISTANCE.toFixed(1)} billion light years: space stretches;"
			size={11.5}
			muted
		/>
		<T x={652} y={378} text="nothing outruns light through space." size={11.5} muted />
	</Readout>

	<!-- the bars -->
	<Card x={16} y={400} w={928} h={184} />
	<line
		x1={bx(HORIZON)}
		x2={bx(HORIZON)}
		y1={414}
		y2={572}
		stroke="var(--bb-red)"
		stroke-dasharray="4 4"
		opacity="0.6"
	/>
	{#each BARS as b (b.id)}
		<rect x={BX} y={b.y} width={BW} height="12" rx="4" fill="var(--stage-grid)" opacity="0.6" />
		<rect x={BX} y={b.y} width={Math.max(2, bx(b.v) - BX)} height="12" rx="4" fill={b.color} />
		<Readout id="bar-{b.id}">
			<T x={BX} y={b.y - 6} text={b.label} size={12} weight={600} />
		</Readout>
	{/each}
	<circle cx={BX} cy={498} r="6" fill="var(--bb-view)" />
	<circle
		cx={bx(d.lightTravel * pulse)}
		cy={498}
		r="4"
		fill="var(--surface)"
		stroke="var(--bb-arrow)"
		stroke-width="2"
		opacity={reduced ? 0 : 1}
	/>
	<T x={bx(HORIZON) - 6} y={428} text="observable universe" size={10.5} anchor="end" muted />
	<T x={BX} y={578} text="us" size={10.5} muted />
</g>
