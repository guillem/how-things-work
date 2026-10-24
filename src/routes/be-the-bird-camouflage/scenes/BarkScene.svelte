<script lang="ts">
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		initialPopulation,
		nextGeneration,
		survivors,
		shadeCounts,
		shadeColor,
		barkMarks,
		HUNT_SECONDS,
		type Moth
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	let population = $state<Moth[]>(initialPopulation());
	let caught = $state<number[]>([]);
	let generation = $state(1);
	let started = $state(false);
	let finished = $state(false);
	let began = $state(0);
	let history = $state<{ generation: number; counts: number[] }[]>([
		{ generation: 1, counts: shadeCounts(initialPopulation()) }
	]);
	const marks = barkMarks();
	const soot = $derived(params.soot === true);
	const elapsed = $derived(Math.max(0, t - began));
	const expired = $derived(started && !reduced && elapsed >= HUNT_SECONDS);
	const hunting = $derived(started && !finished && !expired);
	const done = $derived(started && (finished || expired));
	const living = $derived(survivors(population, new Set(caught)));
	const bins = $derived(shadeCounts(living));
	const binScale = $derived(60 / Math.max(10, ...bins));
	const seconds = $derived(Math.max(0, Math.ceil(HUNT_SECONDS - elapsed)));
	const status = $derived(
		hunting
			? reduced
				? 'Hunting · untimed'
				: `Hunting · ${seconds} seconds left`
			: done
				? living.length
					? 'Hunt over · the survivors can breed'
					: 'No survivors · this colony died out'
				: 'Look closely: can you spot 24 moths?'
	);
	const instruction = $derived(
		hunting
			? 'Tap a moth to catch it'
			: done
				? living.length
					? 'Press the button for their offspring'
					: 'Press the button for a new colony'
				: step.controls?.some((c) => c.id === 'hunt')
					? 'Press the button to begin a hunt'
					: 'Each adult keeps its own shade'
	);

	// Step navigation stops the hunt without discarding the reader's catches.
	$effect(() => {
		void step.id;
		untrack(() => {
			if (started) finished = true;
		});
	});
	$effect(() => {
		const n = Number(params.hunt ?? 0);
		if (!n) return;
		untrack(() => {
			if (hunting) {
				finished = true;
				return;
			}
			if (started) {
				if (living.length === 0) {
					population = initialPopulation(17 + n * 41);
					generation = 1;
					history = [{ generation, counts: shadeCounts(population) }];
				} else {
					population = nextGeneration(living, generation * 741 + n * 31);
					generation++;
					history = [...history.slice(-4), { generation, counts: shadeCounts(population) }];
				}
				caught = [];
			}
			started = true;
			finished = false;
			began = t;
		});
	});
	function catchMoth(id: number) {
		if (hunting && !caught.includes(id)) caught = [...caught, id];
	}
	function keyCatch(event: KeyboardEvent, id: number) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			catchMoth(id);
		}
	}
</script>

<g class="camouflage-bark">
	<!-- Procedural bark, no external texture or image data. -->
	<rect x="28" y="74" width="574" height="436" rx="28" fill={shadeColor(soot ? 0.88 : 0.12)} />
	<path
		d="M52 84 Q72 180 50 290 T63 500 M198 80 Q178 220 205 330 T188 507 M378 78 Q350 205 379 350 T359 504 M550 80 Q525 210 552 360 T537 501"
		stroke={shadeColor(soot ? 0.95 : 0.3)}
		stroke-width="10"
		fill="none"
		opacity="0.5"
	/>
	{#each marks as mark, i (i)}
		<path
			d="M{mark.x} {mark.y} q{-4 + (i % 9)} {mark.length / 2} 0 {mark.length}"
			stroke={shadeColor(soot ? (i % 2 ? 0.73 : 0.98) : i % 2 ? 0.01 : 0.28)}
			stroke-width={mark.width}
			fill="none"
		/>
	{/each}
	<Label x={315} y={48} text={soot ? 'Sooty bark' : 'Pale bark'} size={22} weight={650} />
	{#each population as moth (moth.id)}
		{#if !caught.includes(moth.id)}
			<g
				transform="translate({moth.x} {moth.y}) rotate({moth.angle})"
				role="button"
				tabindex={hunting ? 0 : -1}
				aria-label="Catch moth {moth.id + 1}"
				aria-disabled={!hunting}
				onclick={() => catchMoth(moth.id)}
				onkeydown={(e) => keyCatch(e, moth.id)}
				class:hunting
			>
				<!-- Large transparent target stays on the insect; no visible outline gives its position away. -->
				<circle r="30" fill="transparent" />
				<path
					d="M0 -11 C-8 -25 -28 -24 -27 -5 L-17 15 L-5 10 L0 20 L5 10 L17 15 L27 -5 C28 -24 8 -25 0 -11 Z"
					fill={shadeColor(moth.shade)}
				/>
				<path
					d="M-21 -10 L-12 0 L-19 7 M21 -10 L12 0 L19 7 M-9 -14 L-5 -4 M9 -14 L5 -4"
					stroke={shadeColor(Math.min(1, moth.shade + 0.08))}
					stroke-width="2"
					fill="none"
				/>
				<path
					d="M0 -14 L0 15 M-1 -13 L-7 -20 M1 -13 L7 -20"
					stroke={shadeColor(Math.min(1, moth.shade + 0.14))}
					stroke-width="2.5"
					fill="none"
				/>
			</g>
		{/if}
	{/each}

	<rect
		x="626"
		y="74"
		width="306"
		height="436"
		rx="16"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label x={779} y={112} text="Who is left?" size={22} weight={650} />
	<Readout id="living" label="Alive" value={`${living.length} of 24`} order={1}>
		<Label x={779} y={146} text={`${living.length} of 24 still alive`} size={18} />
	</Readout>
	{#each bins as count, i (i)}
		<rect
			x={659 + i * 41}
			y={230 - count * binScale}
			width="27"
			height={count * binScale}
			rx="3"
			fill={shadeColor((i + 0.5) / 6)}
			stroke="var(--stage-line)"
		/>
	{/each}
	<line x1="654" y1="232" x2="901" y2="232" stroke="var(--stage-line)" />
	<Label x={660} y={255} text="pale" anchor="start" size={15} muted />
	<Label x={900} y={255} text="dark" anchor="end" size={15} muted />
	<Label x={779} y={294} text="Generations · before each hunt" size={15} />
	{#each history as record, i (record.generation)}
		<Label x={656} y={326 + i * 32} text={`${record.generation}`} size={14} muted />
		{@const total = record.counts.reduce((a, b) => a + b, 0)}
		{#each record.counts as count, j (j)}
			{@const offset = record.counts.slice(0, j).reduce((a, b) => a + b, 0)}
			<rect
				x={675 + (226 * offset) / total}
				y={311 + i * 32}
				width={(226 * count) / total}
				height="19"
				fill={shadeColor((j + 0.5) / 6)}
			/>
		{/each}
	{/each}
	<Readout id="generation" label="Generation" value={`${generation}`} order={2}>
		<Label x={315} y={544} text={`Generation ${generation} · ${status}`} size={18} weight={600} />
	</Readout>
	<Readout id="hunt" label="Hunt" value={status} note={instruction} order={3}>
		<Label x={480} y={579} text={instruction} size={16} muted />
	</Readout>
</g>

<style>
	.hunting {
		cursor: crosshair;
	}
	g[role='button']:focus-visible {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}
</style>
