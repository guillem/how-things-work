<script lang="ts">
	/**
	 * A garden path on a winter morning with a patch of ice (500 g) on it and a thermometer. Salt
	 * sprinkled on the ice melts as much of it as the model says for the day's temperature: the
	 * ice shrinks, a puddle of salty water spreads round it, and the grains dissolve. Below the
	 * eutectic the grains just lie on the ice.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Label, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SPOON, iceMeltedBy } from '../model';
	import { degrees, grams } from '../format';
	import Thermometer from './Thermometer.svelte';

	let { step, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'road'));
	const ICE = 500;
	const spoons = $derived(phase === 'road' ? Math.round(Number(params.spoons ?? 0)) : 2);
	const temp = $derived(phase === 'weather' ? Number(params.weather ?? -5) : -5);
	const target = $derived(iceMeltedBy(spoons * SPOON, temp, ICE));
	const tween = Tween.of(() => target, { duration: 2400, easing: cubicOut });
	const melted = $derived(reduced ? target : tween.current);
	/** How far the grains have dissolved: they go as the ice melts round them. */
	const dissolved = $derived(target > 0 ? Math.min(1, melted / target) : 0);
	const left = $derived(1 - melted / ICE);

	// ---- the path, in perspective ------------------------------------------------------------
	const HORIZON = 210;
	const CX = 540;
	const CY = 420;
	/** The ice patch's outline: a lumpy ellipse, scaled by `k`. */
	function blob(k: number, rx: number, ry: number, seed: number): string {
		const n = 36;
		let d = '';
		for (let i = 0; i <= n; i++) {
			const a = (i / n) * Math.PI * 2;
			const wob = 1 + 0.06 * Math.sin(3 * a + seed) + 0.04 * Math.sin(5 * a + 2 * seed);
			const x = CX + Math.cos(a) * rx * k * wob;
			const y = CY + Math.sin(a) * ry * k * wob;
			d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
		}
		return d + 'Z';
	}
	const iceK = $derived(Math.sqrt(Math.max(0, left)));
	const grains = $derived(
		Array.from({ length: spoons * 12 }, (_, i) => {
			const a = hash(i, 3) * Math.PI * 2;
			const r = Math.sqrt(hash(i, 7)) * 0.85;
			return { i, x: CX + Math.cos(a) * 200 * r, y: CY + Math.sin(a) * 58 * r };
		})
	);
	const tooCold = $derived(spoons > 0 && target === 0);
	const verdict = $derived(
		spoons === 0
			? 'no salt: the ice stays hard'
			: tooCold
				? 'too cold: the salt does nothing'
				: left <= 0.001
					? 'all the ice has melted'
					: dissolved < 0.98
						? 'the ice is melting'
						: 'the melting has stopped'
	);
</script>

<g class="sa-road">
	<!-- sky and snowy ground -->
	<rect x="0" y="0" width="960" height={HORIZON} fill="var(--sa-sky)" />
	<rect x="0" y={HORIZON} width="960" height={600 - HORIZON} fill="var(--sa-snow)" />
	<!-- the path -->
	<path
		d="M{CX - 70},{HORIZON} L{CX + 70},{HORIZON} L{CX + 360},600 L{CX - 360},600 Z"
		fill="var(--sa-path)"
	/>
	{#each [0.25, 0.5, 0.75] as u (u)}
		{@const y = HORIZON + (600 - HORIZON) * u * u}
		{@const w = 70 + 290 * u * u}
		<line x1={CX - w} y1={y} x2={CX + w} y2={y} stroke="var(--sa-path-line)" stroke-width="1.5" />
	{/each}

	<!-- the puddle of salty water, the ice left, the salt -->
	{#if melted > 0.5}
		<path
			d={blob(1.08, 230, 70, 11)}
			fill="var(--sa-water)"
			opacity={0.25 + 0.5 * (melted / ICE)}
		/>
	{/if}
	{#if left > 0.001}
		<path
			d={blob(iceK, 220, 66, 5)}
			fill="var(--sa-ice)"
			stroke="var(--sa-ice-edge)"
			stroke-width="2"
		/>
		<path
			d="M{CX - 120 * iceK},{CY - 20 * iceK} L{CX - 40 * iceK},{CY - 34 * iceK} M{CX +
				30 * iceK},{CY + 14 * iceK} L{CX + 120 * iceK},{CY - 4 * iceK}"
			stroke="white"
			stroke-width="4"
			stroke-linecap="round"
			opacity="0.7"
		/>
	{/if}
	{#each grains as g (g.i)}
		<rect
			x={g.x - 4}
			y={g.y - 3}
			width="8"
			height="6"
			rx="1.5"
			fill="var(--sa-salt)"
			stroke="var(--sa-salt-edge)"
			stroke-width="1"
			opacity={1 - 0.8 * dissolved}
			transform="rotate({hash(g.i, 9) * 90} {g.x} {g.y})"
		/>
	{/each}

	<!-- the thermometer on its post -->
	<rect x="104" y="440" width="12" height="150" rx="3" fill="var(--sa-post)" />
	<rect
		x="50"
		y="30"
		width="120"
		height="430"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Thermometer x={92} y={60} height={300} {temp} />
	<Readout id="sa-temp" order={1} label="Thermometer" value={degrees(temp)}>
		<Label x={110} y={446} text={degrees(temp)} size={24} weight={700} tabular />
	</Readout>

	<!-- what the salt does -->
	<Readout
		id="sa-salt"
		order={2}
		label="Salt on the ice"
		value="{spoons} spoonful{spoons === 1 ? '' : 's'}"
	>
		<Label
			x={930}
			y={60}
			text="salt: {spoons} spoonful{spoons === 1 ? '' : 's'}"
			anchor="end"
			size={20}
			weight={700}
		/>
	</Readout>
	<Readout id="sa-melted" order={3} label="Ice melted" value="{grams(melted)} of {grams(ICE)}">
		<Label
			x={930}
			y={96}
			text="ice melted: {grams(melted)} of {grams(ICE)}"
			anchor="end"
			size={18}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="sa-verdict" order={4} label="So" value={verdict}>
		<Label
			x={930}
			y={130}
			text={verdict}
			anchor="end"
			size={17}
			weight={700}
			color={tooCold || spoons === 0 ? 'var(--sa-no)' : 'var(--sa-yes)'}
		/>
	</Readout>
</g>
