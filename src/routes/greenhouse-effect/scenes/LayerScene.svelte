<script lang="ts">
	/**
	 * The one-layer greenhouse model, drawn to scale (0.2 scene units per W/m²):
	 * sunlight through the layer to the ground; the ground's infrared, of which
	 * a share ε is absorbed by the layer and the rest escapes through the
	 * "window"; the layer's emission, half up and half down. The slider sets ε;
	 * the flows and temperatures are the model's balance (`layerFlows`).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, Photon } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { band } from '../../carbon-cycle/scenes/geometry';
	import { layerFlows, toCelsius } from '../climate';
	import { irPhoton, sunPhoton } from './ir';

	let { t, params, reduced }: StageProps = $props();

	const target = $derived(Number(params.absorb ?? 77) / 100);
	const eps = Tween.of(() => target, { duration: 600, easing: cubicInOut });
	const e = $derived(reduced ? target : eps.current);
	const f = $derived(layerFlows(e));

	const K = 0.2;
	const GROUND = 470;
	const L_TOP = 200;
	const L_BOT = 270;
	const SPACE = 34;

	const sun = band(
		[
			{ x: 100, y: SPACE - 8 },
			{ x: 100, y: GROUND - 2 }
		],
		240 * K
	);
	const geo = $derived.by(() => {
		const w = f.surface * K;
		const ww = Math.max(0.5, f.window * K);
		const wa = f.absorbed * K;
		const x0 = 190;
		const win = band(
			[
				{ x: x0 + ww / 2, y: GROUND - 2 },
				{ x: x0 + ww / 2, y: SPACE }
			],
			ww
		);
		const abs =
			wa > 0.5
				? band(
						[
							{ x: x0 + ww + wa / 2, y: GROUND - 2 },
							{ x: x0 + ww + wa / 2, y: (L_TOP + L_BOT) / 2 + 6 }
						],
						wa
					)
				: null;
		const wu = f.up * K;
		const up =
			wu > 0.5
				? band(
						[
							{ x: 420, y: L_TOP + 4 },
							{ x: 420, y: SPACE }
						],
						wu
					)
				: null;
		const down =
			wu > 0.5
				? band(
						[
							{ x: 530, y: L_BOT - 4 },
							{ x: 530, y: GROUND - 2 }
						],
						wu
					)
				: null;
		return { w, ww, wa, wu, x0, win, abs, up, down };
	});

	const tt = $derived(reduced ? 2.5 : t);
	const sunP = $derived(
		Array.from({ length: 7 }, (_, i) => ({
			...sunPhoton(i, 7, tt, SPACE, GROUND - 6),
			x: 92 + (i % 3) * 8
		}))
	);
	const IR_N = 12;
	const irP = $derived(
		Array.from({ length: IR_N }, (_, i) =>
			irPhoton(i, IR_N, tt, {
				x0: 200,
				x1: 500,
				ground: GROUND - 6,
				top: SPACE,
				airTop: L_TOP + 8,
				airBottom: L_BOT - 8,
				absorb: target,
				salt: 3
			})
		)
	);
	const c = (k: number) =>
		`${toCelsius(k) < -0.5 ? '−' : ''}${Math.abs(toCelsius(k)).toFixed(0)} °C`;
	const w0 = (v: number) => v.toFixed(0);
</script>

<g>
	<rect x="16" y="16" width="590" height={GROUND - 16} rx="10" fill="var(--gh-space)" />
	<rect
		x="16"
		y={L_TOP}
		width="590"
		height={L_BOT - L_TOP}
		fill="var(--gh-air)"
		stroke="var(--gh-air-edge)"
		opacity={0.35 + 0.65 * e}
	/>
	<rect x="16" y={GROUND} width="590" height="100" rx="4" fill="var(--gh-ground)" />
	<Readout id="names">
		<Label x={157} y={L_TOP + 30} text="air layer" size={12} weight={600} />
		{#if e > 0.02}
			<Label x={157} y={L_TOP + 46} text="{f.ta.toFixed(0)} K" size={11} muted />
		{/if}
		<Label x={596} y={40} text="space" anchor="end" size={12} muted />
		<Label x={596} y={GROUND + 24} text="ground" anchor="end" size={12} weight={600} />
	</Readout>

	<!-- sunlight -->
	<path d={sun.d} fill="var(--gh-sun)" fill-opacity="0.55" />
	{#each sunP as p (p.key)}
		<Photon x={p.x} y={p.y} angle={90} length={26} opacity={p.opacity * 0.9} />
	{/each}
	<Readout id="sun">
		<Label x={130} y={56} text="240" anchor="start" size={12} weight={700} />
		<Label x={130} y={72} text="sunlight" anchor="start" size={12} weight={700} />
	</Readout>

	<!-- infrared -->
	{#if f.window >= 1}<path d={geo.win.d} fill="var(--gh-ir)" fill-opacity="0.55" />{/if}
	{#if geo.abs}<path d={geo.abs.d} fill="var(--gh-ir)" fill-opacity="0.35" />{/if}
	{#if geo.up}<path d={geo.up.d} fill="var(--gh-ir)" fill-opacity="0.55" />{/if}
	{#if geo.down}<path d={geo.down.d} fill="var(--gh-ir)" fill-opacity="0.35" />{/if}
	{#each irP as p (p.key)}
		{#if p.flash}
			<circle
				cx={p.flash.x}
				cy={p.flash.y}
				r="7"
				fill="var(--gh-ir)"
				opacity={p.flash.opacity * 0.6}
			/>
		{/if}
		<Photon
			x={p.x}
			y={p.y}
			angle={p.angle}
			length={24}
			amplitude={3}
			color="var(--gh-ir)"
			opacity={p.opacity}
		/>
	{/each}
	<Readout id="surf" order={2} label="Infrared from the ground" value="{w0(f.surface)} W/m²">
		<Label
			x={geo.x0 + geo.w / 2}
			y={GROUND - 12}
			text="{w0(f.surface)} from the ground"
			size={12}
			weight={700}
			color="var(--gh-ir)"
		/>
	</Readout>
	<Readout id="win">
		<Label x={geo.x0 + geo.ww + 8} y={130} text="{w0(f.window)} through" anchor="start" size={12} />
	</Readout>
	{#if geo.up}
		<Readout id="up" order={4} label="From the layer: up / down" value="{w0(f.up)} each">
			<Label x={420 + geo.wu / 2 + 6} y={110} text="{w0(f.up)} up" anchor="start" size={12} />
			<Label
				x={530 - geo.wu / 2 - 6}
				y={GROUND - 60}
				text="{w0(f.down)} down"
				anchor="end"
				size={12}
			/>
		</Readout>
	{/if}

	<!-- panel -->
	<Readout id="ts" order={0} label="Surface" value="{f.ts.toFixed(0)} K = {c(f.ts)}">
		<Label x={636} y={56} text="Surface temperature" anchor="start" size={13} weight={600} />
		<Label
			x={636}
			y={90}
			text="{f.ts.toFixed(0)} K = {c(f.ts)}"
			anchor="start"
			size={24}
			weight={700}
			color="var(--gh-warm)"
		/>
	</Readout>
	<Readout id="absorb-note">
		<Label
			x={636}
			y={116}
			text="the air absorbs {Math.round(e * 100)}% of the ground's infrared"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	<Readout
		id="top"
		order={5}
		label="Leaving to space"
		value="{w0(f.window)} + {w0(f.up)} = {w0(f.out)} W/m², balancing 240 in"
	>
		<Label x={636} y={176} text="Leaving to space:" anchor="start" size={13} weight={700} />
		<Label
			x={636}
			y={198}
			text="{w0(f.window)} through + {w0(f.up)} from the layer"
			anchor="start"
			size={12}
		/>
		<Label
			x={636}
			y={216}
			text="= {w0(f.out)} W/m², balancing the 240 in"
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>
	<Readout id="ground-sum">
		<Label x={636} y={262} text="Reaching the ground:" anchor="start" size={13} weight={700} />
		<Label
			x={636}
			y={284}
			text="240 sunlight + {w0(f.down)} from the layer"
			anchor="start"
			size={12}
		/>
		<Label
			x={636}
			y={302}
			text="= {w0(f.surface)} W/m², what it gives off"
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>
	<!-- the temperature scale -->
	{#each [{ k: 255, n: 'no greenhouse gases: −18 °C' }, { k: 288, n: 'Earth today: 15 °C' }, { k: 303, n: 'absorbs everything: 30 °C' }] as m (m.k)}
		{@const y = 540 - (m.k - 245) * 3}
		<Readout id="mark-{m.k}">
			<line x1={650} x2={662} y1={y} y2={y} stroke="var(--stage-line)" />
			<Label x={670} y={y + 4} text={m.n} anchor="start" size={11} muted />
		</Readout>
	{/each}
	<rect
		x={652}
		y={540 - (f.ts - 245) * 3}
		width="8"
		height={(f.ts - 245) * 3}
		rx="3"
		fill="var(--gh-warm)"
		opacity="0.8"
	/>
	<line x1={656} x2={656} y1={540 - 60 * 3} y2={540} stroke="var(--stage-line)" />
</g>
