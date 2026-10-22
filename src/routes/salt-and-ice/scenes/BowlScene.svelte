<script lang="ts">
	/**
	 * A bowl of ice (500 g, about four cups) seen cut open, with a thermometer. Bowl step: salt
	 * stirred in, the bowl cools to the model's insulated balance as some ice melts into salty
	 * water at the bottom. Cream step: a bag of cream sits in the ice; a ten-minute clock runs
	 * over the step, and the model's run gives the bowl's and the cream's temperatures, the ice
	 * melted and how much of the cream's water has frozen.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Flow, Label, clamp, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		EUTECTIC,
		SOFT,
		SPOON,
		bath,
		saltinessAt,
		simulateBath,
		type BathSample
	} from '../model';
	import { degrees, grams } from '../format';
	import Thermometer from './Thermometer.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'bowl'));
	const ICE = 500;
	const MINUTES = 10;
	const BAGS: Record<string, number> = { plain: 0, spoon: 1, cup: 8 };
	const spoons = $derived(
		phase === 'bowl'
			? Math.round(Number(params.bowlSalt ?? 0))
			: (BAGS[String(params.bag ?? 'cup')] ?? 8)
	);

	// ---- bowl step: the insulated balance --------------------------------------------------------
	const still = $derived(bath(ICE, spoons * SPOON));
	const tempTween = Tween.of(() => still.temp, { duration: 2400, easing: cubicOut });
	const meltTween = Tween.of(() => still.melted, { duration: 2400, easing: cubicOut });

	// ---- cream step: ten minutes of shaking -------------------------------------------------------
	const EVERY = 1 / 30;
	const run: BathSample[] = $derived(
		phase === 'cream' ? simulateBath(ICE, spoons * SPOON, MINUTES, EVERY) : []
	);
	const minute = $derived(reduced ? MINUTES : Math.min(MINUTES, t / 1.8));
	const now = $derived.by((): BathSample | null => {
		if (run.length === 0) return null;
		const f = minute / EVERY;
		const i = Math.min(run.length - 2, Math.floor(f));
		const a = run[i];
		const b = run[i + 1];
		const u = f - i;
		const mix = (x: number, y: number) => x + (y - x) * u;
		return {
			minute,
			bath: mix(a.bath, b.bath),
			cream: mix(a.cream, b.cream),
			melted: mix(a.melted, b.melted),
			frozen: mix(a.frozen, b.frozen),
			fromCream: mix(a.fromCream, b.fromCream)
		};
	});
	const softAt = $derived(run.find((r) => r.frozen >= SOFT)?.minute ?? null);

	const bathTemp = $derived(now ? now.bath : reduced ? still.temp : tempTween.current);
	const melted = $derived(now ? now.melted : reduced ? still.melted : meltTween.current);
	const left = $derived(1 - melted / ICE);
	const frozen = $derived(now?.frozen ?? 0);
	const creamWord = $derived(
		frozen >= SOFT ? 'soft ice cream' : frozen > 0.01 ? 'slushy: ice crystals' : 'runny'
	);

	// ---- the bowl --------------------------------------------------------------------------------
	const BX = 420;
	const RIM = 250;
	const BOT = 548;
	const bowlPath = `M${BX - 250},${RIM} C${BX - 245},${BOT - 10} ${BX - 120},${BOT} ${BX},${BOT} C${BX + 120},${BOT} ${BX + 245},${BOT - 10} ${BX + 250},${RIM}`;
	const brineTop = $derived(BOT - 8 - Math.min(120, melted * 0.3));
	const cubeK = $derived(Math.cbrt(Math.max(0, left)));
	const bag = $derived(phase === 'cream');
	const CUBES = [
		[-190, 300],
		[-130, 290],
		[-60, 300],
		[10, 288],
		[80, 300],
		[150, 292],
		[200, 305],
		[-200, 360],
		[-140, 365],
		[-180, 425],
		[-110, 430],
		[140, 362],
		[200, 368],
		[100, 432],
		[170, 432],
		[-70, 370],
		[0, 365],
		[70, 372],
		[-50, 440],
		[20, 445],
		[-120, 490],
		[-40, 500],
		[40, 500],
		[110, 490]
	] as const;
	const cubes = $derived(
		CUBES.map(([dx, y], i) => ({ i, x: BX + dx, y, rot: (hash(i, 2) - 0.5) * 40 })).filter(
			(c) => !bag || Math.abs(c.x - BX) > 95 || c.y < 300 || c.y > 486
		)
	);
	const grains = $derived(
		Array.from({ length: spoons * 5 }, (_, i) => ({
			i,
			x: BX - 200 + hash(i, 5) * 400,
			y: RIM + 20 + hash(i, 6) * 40
		}))
	);
	// The share of the salt dissolved: no more than the meltwater can hold at the bowl's
	// temperature; the rest stays as grains.
	const dissolved = $derived.by(() => {
		if (spoons === 0 || bathTemp >= 0) return 0;
		const c = saltinessAt(bathTemp) ?? EUTECTIC.salt;
		return clamp((melted * c) / (100 - c) / (spoons * SPOON));
	});
	const sparkles = $derived(
		Array.from({ length: Math.round(frozen * 26) }, (_, i) => ({
			i,
			x: BX - 72 + hash(i, 11) * 144,
			y: 352 + hash(i, 12) * 104
		}))
	);
	const flowing = $derived(now ? clamp((now.cream - now.bath) / 4) : 0);
	const handAngle = $derived((minute / 60) * 360 * 6);
</script>

<g class="sa-bowl">
	<defs>
		<clipPath id="sa-bowl-clip"><path d="{bowlPath} Z" /></clipPath>
	</defs>
	<!-- the salty water at the bottom, then the ice -->
	<g clip-path="url(#sa-bowl-clip)">
		<rect
			x={BX - 260}
			y={brineTop}
			width="520"
			height={BOT - brineTop + 10}
			fill="var(--sa-water)"
			opacity="0.55"
		/>
	</g>
	{#if bag}
		<path
			d="M{BX - 84},{336} Q{BX - 90},{470} {BX - 70},{474} L{BX + 70},{474} Q{BX + 90},{470} {BX +
				84},{336} Z"
			fill="var(--sa-cream)"
			stroke="var(--sa-bag)"
			stroke-width="3"
		/>
		<line
			x1={BX - 92}
			y1={334}
			x2={BX + 92}
			y2={334}
			stroke="var(--sa-bag)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		{#each sparkles as s (s.i)}
			<path
				d="M{s.x - 5},{s.y} L{s.x + 5},{s.y} M{s.x},{s.y - 5} L{s.x},{s.y + 5}"
				stroke="var(--sa-crystal)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
		<Label
			x={BX}
			y={410}
			text="cream"
			size={18}
			weight={700}
			color="var(--sa-cream-ink)"
			halo={false}
		/>
		{#each [-1, 1] as side (side)}
			<Flow
				d="M{BX + side * 92},{400} L{BX + side * 138},{400}"
				color="var(--sa-heat)"
				width={4}
				arrow
				dash={8}
				t={reduced ? 0 : t}
				opacity={flowing}
			/>
		{/each}
	{/if}
	{#each cubes as c (c.i)}
		{@const s = 50 * cubeK}
		<rect
			x={c.x - s / 2}
			y={c.y - s / 2}
			width={s}
			height={s}
			rx={8 * cubeK}
			fill="var(--sa-ice)"
			stroke="var(--sa-ice-edge)"
			stroke-width="2"
			opacity="0.92"
			transform="rotate({c.rot} {c.x} {c.y})"
		/>
	{/each}
	{#each grains as g (g.i)}
		<rect
			x={g.x - 4}
			y={g.y - 3}
			width="8"
			height="6"
			rx="1.5"
			fill="var(--sa-salt)"
			stroke="var(--sa-salt-edge)"
			opacity={1 - 0.85 * dissolved}
		/>
	{/each}
	<path d={bowlPath} fill="none" stroke="var(--sa-bowl)" stroke-width="8" stroke-linecap="round" />

	<!-- the bowl's thermometer -->
	<Thermometer x={78} y={70} height={300} temp={bathTemp} />
	<Readout id="sa-bath" order={2} label="Bowl" value={degrees(bathTemp)}>
		<Label x={92} y={36} text="bowl: {degrees(bathTemp)}" size={20} weight={700} tabular />
	</Readout>

	<!-- readouts on the right -->
	{#if bag && now}
		<circle cx={850} cy={92} r="44" fill="var(--surface)" stroke="var(--border)" stroke-width="2" />
		{#each { length: 10 }, i (i)}
			<line
				x1={850 + Math.sin((i / 10) * Math.PI * 2) * 36}
				y1={92 - Math.cos((i / 10) * Math.PI * 2) * 36}
				x2={850 + Math.sin((i / 10) * Math.PI * 2) * 42}
				y2={92 - Math.cos((i / 10) * Math.PI * 2) * 42}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
			/>
		{/each}
		<line
			x1={850}
			y1={92}
			x2={850 + Math.sin((handAngle * Math.PI) / 180) * 32}
			y2={92 - Math.cos((handAngle * Math.PI) / 180) * 32}
			stroke="var(--sa-red)"
			stroke-width="3.5"
			stroke-linecap="round"
		/>
		<Readout id="sa-clock" order={1} label="Shaking for" value="{Math.floor(minute)} min">
			<Label x={850} y={164} text="{Math.floor(minute)} min" size={18} weight={700} tabular />
		</Readout>
		<Readout id="sa-cream" order={3} label="Cream" value="{degrees(now.cream)}, {creamWord}">
			<Label x={850} y={226} text="cream: {degrees(now.cream)}" size={19} weight={700} tabular />
			<Label
				x={850}
				y={252}
				text={creamWord}
				size={16}
				weight={700}
				color={frozen >= SOFT ? 'var(--sa-yes)' : frozen > 0.01 ? undefined : 'var(--sa-no)'}
			/>
		</Readout>
		{#if softAt !== null && minute >= softAt}
			<Readout id="sa-soft" order={4} label="Frozen after" value="{Math.round(softAt)} min">
				<Label x={850} y={278} text="frozen after {Math.round(softAt)} min" size={14} muted />
			</Readout>
		{/if}
	{/if}
	{#if !bag}
		<Readout
			id="sa-bwhy"
			order={7}
			label="Why"
			value={spoons > 0 ? 'melting takes heat from the bowl itself' : 'plain ice stays at 0 °C'}
		>
			<Label
				x={850}
				y={210}
				text={spoons > 0 ? 'the melting takes heat' : 'plain ice'}
				size={16}
				weight={600}
			/>
			<Label
				x={850}
				y={234}
				text={spoons > 0 ? 'from the bowl itself' : 'stays at 0 °C'}
				size={16}
				weight={600}
			/>
		</Readout>
	{/if}
	<Readout id="sa-bmelt" order={5} label="Ice melted" value="{grams(melted)} of {grams(ICE)}">
		<Label x={850} y={bag ? 330 : 120} text="ice melted:" size={15} muted />
		<Label
			x={850}
			y={bag ? 354 : 146}
			text="{grams(melted)} of {grams(ICE)}"
			size={18}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="sa-bsalt" order={6} label="Salt" value="{spoons} spoonful{spoons === 1 ? '' : 's'}">
		<Label
			x={850}
			y={bag ? 400 : 60}
			text="salt: {spoons} spoonful{spoons === 1 ? '' : 's'}"
			size={18}
			weight={700}
		/>
	</Readout>
</g>
