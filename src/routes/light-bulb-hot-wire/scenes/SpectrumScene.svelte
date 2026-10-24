<script lang="ts">
	/**
	 * Everything the glowing wire sends out, colour by colour, from the model: the wire's glow
	 * across the rainbow and on past red into the infrared, on one scale for every dimmer setting
	 * (a dashed copy shows the bulb at full). The rainbow part is painted in its colours, the
	 * infrared part in a dull red; readouts give the share of each. A knob on the stage moves the
	 * dimmer.
	 */
	import {
		Axes,
		Handle,
		Label,
		clamp,
		scale,
		wavelengthToColor,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FULL, bulb, celsius, infraredShare, wireSpectrum } from '../model';
	import { percent } from '../steps';

	let { params, setParam }: StageProps = $props();

	const dimmer = $derived(clamp(Number(params.glow ?? 1)));
	const m = $derived(bulb(dimmer));

	const NM0 = 300;
	const NM1 = 3000;
	const sx = scale([NM0, NM1], [110, 900]);
	const PEAK = Math.max(
		...Array.from({ length: 271 }, (_, i) => wireSpectrum(NM0 + i * 10, FULL.kelvin))
	);
	const sy = scale([0, 1.08], [470, 110]);
	const y0 = sy(0);

	const curve = (kelvin: number, on: boolean) =>
		Array.from({ length: 271 }, (_, i) => {
			const nm = NM0 + i * 10;
			const v = on ? wireSpectrum(nm, kelvin) / PEAK : 0;
			return `${i === 0 ? 'M' : 'L'}${sx(nm).toFixed(1)} ${sy(v).toFixed(1)}`;
		}).join(' ');
	const fullCurve = curve(FULL.kelvin, true);
	const on = $derived(dimmer > 0);
	const line = $derived(curve(m.kelvin, on));
	/** The rainbow under the curve, in 10 nm slices. */
	const slices = $derived(
		Array.from({ length: 40 }, (_, i) => {
			const a = 380 + i * 10;
			const b = a + 10;
			const va = on ? wireSpectrum(a, m.kelvin) / PEAK : 0;
			const vb = on ? wireSpectrum(b, m.kelvin) / PEAK : 0;
			return {
				i,
				d: `M${sx(a)} ${y0} L${sx(a)} ${sy(va)} L${sx(b)} ${sy(vb)} L${sx(b)} ${y0} Z`,
				fill: wavelengthToColor(a + 5)
			};
		})
	);
	const irArea = $derived(
		`M${sx(780)} ${y0} ` +
			Array.from({ length: 223 }, (_, i) => {
				const nm = 780 + i * 10;
				const v = on ? wireSpectrum(nm, m.kelvin) / PEAK : 0;
				return `L${sx(nm).toFixed(1)} ${sy(v).toFixed(1)}`;
			}).join(' ') +
			` L${sx(NM1)} ${y0} Z`
	);
	const ir = $derived(on ? infraredShare(m.kelvin) : 0);
	const vis = $derived(on ? 1 - ir : 0);
	/** A share for the reader: whole per cent, or "under 1%". */
	const pc = (v: number) => (v <= 0 ? '0%' : v < 0.01 ? 'under 1%' : `${Math.round(v * 100)}%`);

	const TX0 = 560;
	const TX1 = 880;
	const TY = 556;
	const knobX = $derived(TX0 + (TX1 - TX0) * dimmer);
	const setDimmer = (v: number) => setParam('glow', Math.round(clamp(v) * 100) / 100);
	const headline = $derived(
		on
			? `Dimmer ${percent(dimmer)}: the wire at ${celsius(m.kelvin).toLocaleString('en-US')} °C`
			: 'Dimmer: off'
	);
	const cardW = $derived(headline.length * 9.6);
</script>

<g class="lbh-spectrum">
	<Axes {sx} {sy} yLabel="how much it sends out" xTicks={[]} yTicks={[0]} yFormat={() => ''} />
	<path d={irArea} fill="var(--lbh-ir)" opacity="0.35" />
	{#each slices as s (s.i)}
		<path d={s.d} fill={s.fill} />
	{/each}
	{#if dimmer < 1}
		<path
			d={fullCurve}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 5"
		/>
		<Readout id="lbh-full">
			<Label x={sx(1250)} y={sy(1) - 10} text="at full" anchor="start" size={13} muted />
		</Readout>
	{/if}
	<path d={line} fill="none" stroke="var(--stage-ink)" stroke-width="2.5" />

	<!-- what the parts are -->
	<line
		x1={sx(380)}
		y1={y0 + 8}
		x2={sx(780)}
		y2={y0 + 8}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<line x1={sx(800)} y1={y0 + 8} x2={sx(NM1)} y2={y0 + 8} stroke="var(--lbh-ir)" stroke-width="2" />
	<Readout id="lbh-visible" order={2} label="Light you can see" value={pc(vis)}>
		<Label x={sx(580)} y={y0 + 30} text="colours you see" anchor="middle" size={14} weight={600} />
		<Label x={sx(580)} y={y0 + 50} text={pc(vis)} anchor="middle" size={18} weight={700} tabular />
	</Readout>
	<Readout id="lbh-ir" order={3} label="Invisible infrared" value={pc(ir)} color="var(--lbh-ir)">
		<Label
			x={sx(1900)}
			y={y0 + 30}
			text="infrared: invisible, felt as warmth"
			anchor="middle"
			size={14}
			weight={600}
			color="var(--lbh-ir-ink)"
		/>
		<Label
			x={sx(1900)}
			y={y0 + 50}
			text={pc(ir)}
			anchor="middle"
			size={18}
			weight={700}
			tabular
			color="var(--lbh-ir-ink)"
		/>
	</Readout>
	<Readout id="lbh-ends">
		<Label x={sx(380)} y={y0 + 70} text="violet" anchor="start" size={12} muted />
		<Label x={sx(780)} y={y0 + 70} text="red" anchor="end" size={12} muted />
	</Readout>

	<!-- the dimmer knob -->
	<line
		x1={TX0}
		y1={TY}
		x2={TX1}
		y2={TY}
		stroke="var(--lbh-track)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<line
		x1={TX0}
		y1={TY}
		x2={knobX}
		y2={TY}
		stroke="var(--lbh-light)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<Readout id="lbh-track">
		<Label x={TX0 - 14} y={TY + 5} text="dimmer" anchor="end" size={14} weight={600} />
	</Readout>
	<Handle
		x={knobX}
		y={TY}
		r={12}
		label="Dimmer"
		value={dimmer}
		min={0}
		max={1}
		valuetext={percent(dimmer)}
		color="var(--lbh-knob)"
		onmove={(q: Point) => setDimmer((q.x - TX0) / (TX1 - TX0))}
		onkey={(s) => setDimmer(s === 'start' ? 0 : s === 'end' ? 1 : dimmer + s / 100)}
	/>

	<Readout id="lbh-spec-card">
		<rect
			x={944 - cardW - 14}
			y="14"
			width={cardW + 28}
			height="44"
			rx="10"
			fill="var(--surface)"
			opacity="0.9"
		/>
	</Readout>
	<Readout id="lbh-spec-head" order={1} label="Now" value={headline}>
		<Label x={944} y={42} text={headline} anchor="end" size={18} weight={700} />
	</Readout>
</g>
