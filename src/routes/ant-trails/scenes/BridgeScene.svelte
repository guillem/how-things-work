<script lang="ts">
	/**
	 * The double bridge: the nest on the left, the sugar on the right, two bridges between two
	 * forks, and 80 ants walking over them, simulated in real time from the start of the step (or
	 * the last "Run it again"). The scent on each stretch of bridge is drawn under the ants, and a
	 * tally counts which bridge the last 50 ants leaving the nest took. With reduced motion the
	 * bridges are shown after a fixed stretch of simulated time.
	 */
	import { untrack } from 'svelte';
	import { along, lerp, pathFrom, smooth, type Point } from '#lib/draw/math.ts';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bridges,
		lastChoices,
		PATCH,
		runBridges,
		SHORT,
		STEM,
		type Bridges,
		type Side
	} from '../model';
	import { ANT, GRAIN, SIM_SPEED } from './ant';
	import PlaceLabel from './PlaceLabel.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'equal'));
	const equal = $derived(phase === 'equal');
	const late = $derived(phase === 'late');
	const fading = $derived(late && params.fade === true);
	/** "Run it again" picks the next colony; the first one of each step is a typical run. */
	const seed = $derived(late ? 2 : 2 + Number(params.again ?? 0));
	/** The short bridge opens late in "late" (simulated seconds). */
	const OPENS = 40;
	const FROZEN = $derived(late ? 200 : 150);

	// ---- the drawing's geometry -----------------------------------------------------------------
	const NEST: Point = { x: 70, y: 290 };
	const F1: Point = { x: 170, y: 290 };
	const F2: Point = { x: 790, y: 290 };
	const SUGAR: Point = { x: 890, y: 290 };
	const top = smooth([F1, { x: 230, y: 205 }, { x: 480, y: 190 }, { x: 730, y: 205 }, F2]);
	const bottom = smooth([F1, { x: 230, y: 375 }, { x: 480, y: 390 }, { x: 730, y: 375 }, F2]);
	const straight = [F1, F2];
	const deep = smooth([
		F1,
		{ x: 178, y: 440 },
		{ x: 215, y: 530 },
		{ x: 300, y: 552 },
		{ x: 660, y: 552 },
		{ x: 745, y: 530 },
		{ x: 782, y: 440 },
		F2
	]);
	const paths = $derived(equal ? [top, bottom] : [straight, deep]);
	const names = $derived(equal ? ['top', 'bottom'] : ['short', 'long']);

	// ---- the simulation, advanced to the stage's clock -----------------------------------------
	const make = (phase: string, seed: number, fade: boolean) =>
		bridges({
			lengths: phase === 'equal' ? [SHORT, SHORT] : [SHORT, 2 * SHORT],
			opens: phase === 'late' ? [OPENS, 0] : [0, 0],
			fade,
			seed
		});
	let b: Bridges = make('equal', 2, false);
	let t0 = 0;
	let frame = $state(0);
	let resets = $state(0);
	$effect(() => {
		void step.id;
		const p = phase;
		const s = seed;
		const f = fading;
		untrack(() => {
			b = make(p, s, f);
			t0 = t;
			resets++;
		});
	});
	$effect(() => {
		void resets;
		const target = reduced ? FROZEN : SIM_SPEED * Math.max(0, t - t0);
		untrack(() => {
			const until = Math.min(target, reduced ? Infinity : b.time + 10);
			if (until > b.time) runBridges(b, until);
			frame++;
		});
	});

	const open0 = $derived.by(() => {
		void frame;
		return b.time >= b.opens[0];
	});

	// ---- what is drawn ---------------------------------------------------------------------------
	/** Where an ant `s` along its route over bridge `side` is, and which way it faces. */
	function place(s: number, side: Side, dir: number) {
		const L = b.lengths[side];
		let p: Point & { angle: number };
		if (s < STEM) p = { x: lerp(NEST.x, F1.x, s / STEM), y: NEST.y, angle: 0 };
		else if (s <= STEM + L) p = along(paths[side], (s - STEM) / L);
		else p = { x: lerp(F2.x, SUGAR.x, (s - STEM - L) / STEM), y: SUGAR.y, angle: 0 };
		// Out on one side of the bridge, home on the other.
		const off = dir > 0 ? -4 : 4;
		return {
			x: p.x - off * Math.sin(p.angle),
			y: p.y + off * Math.cos(p.angle),
			a: (p.angle * 180) / Math.PI + (dir > 0 ? 0 : 180)
		};
	}
	const ants = $derived.by(() => {
		void frame;
		const out: { x: number; y: number; a: number; c: boolean }[] = [];
		for (let i = 0; i < b.s.length; i++)
			if (b.time >= b.start[i])
				out.push({ ...place(b.s[i], b.side[i] as Side, b.dir[i]), c: b.dir[i] < 0 });
		return out;
	});
	/** The scent, three patches to a stroke. */
	const scent = $derived.by(() => {
		void frame;
		const out: { k: string; d: string; o: number; w: number }[] = [];
		for (const side of [0, 1] as Side[]) {
			const patches = b.scent[side];
			const L = b.lengths[side];
			for (let p = 0; p < patches.length; p += 3) {
				const v = (patches[p] + (patches[p + 1] ?? 0) + (patches[p + 2] ?? 0)) / 3;
				if (v < 0.5) continue;
				const a = along(paths[side], (p * PATCH) / L);
				const c = along(paths[side], Math.min(1, ((p + 3) * PATCH) / L));
				out.push({
					k: `${side}-${p}`,
					d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${c.x.toFixed(1)} ${c.y.toFixed(1)}`,
					o: Math.min(0.9, 0.15 + v / 150),
					w: 4 + Math.min(10, v / 15)
				});
			}
		}
		return out;
	});
	const tally = $derived.by(() => {
		void frame;
		return lastChoices(b, 50);
	});
	const counted = $derived(tally[0] + tally[1]);
</script>

<g class="at-bridges">
	<rect x="16" y="16" width="928" height="568" rx="16" fill="var(--at-ground)" />

	<!-- stems and bridges -->
	<path
		d={pathFrom([NEST, F1])}
		stroke="var(--at-bridge)"
		stroke-width="22"
		stroke-linecap="round"
		fill="none"
	/>
	<path
		d={pathFrom([F2, SUGAR])}
		stroke="var(--at-bridge)"
		stroke-width="22"
		stroke-linecap="round"
		fill="none"
	/>
	{#each paths as p, side (side)}
		<path
			d={pathFrom(p)}
			stroke="var(--at-bridge)"
			stroke-width="22"
			stroke-linecap="round"
			stroke-linejoin="round"
			fill="none"
			opacity={side === 0 && !open0 ? 0.35 : 1}
			stroke-dasharray={side === 0 && !open0 ? '14 10' : undefined}
		/>
	{/each}
	{#each scent as s (s.k)}
		<path
			d={s.d}
			stroke="var(--at-scent)"
			stroke-width={s.w}
			stroke-linecap="round"
			opacity={s.o}
		/>
	{/each}
	{#if late && !open0}
		{#each [F1, F2] as g, i (i)}
			<line
				x1={g.x + (i === 0 ? 34 : -34)}
				y1={g.y - 18}
				x2={g.x + (i === 0 ? 34 : -34)}
				y2={g.y + 18}
				stroke="var(--at-gate)"
				stroke-width="6"
				stroke-linecap="round"
			/>
		{/each}
	{/if}

	<!-- nest and sugar -->
	<circle cx={NEST.x} cy={NEST.y} r="34" fill="var(--at-nest)" />
	<circle cx={NEST.x} cy={NEST.y} r="9" fill="var(--at-hole)" />
	<PlaceLabel
		id="at-nest-name"
		x={NEST.x}
		y={NEST.y + 62}
		phone={{ x: NEST.x + 10, y: NEST.y + 80 }}
		text="nest"
	/>
	<g transform="translate({SUGAR.x} {SUGAR.y})">
		<circle r="24" fill="var(--at-sugar-bed)" />
		{#each [[-9, -6], [4, -10], [8, 4], [-4, 7], [-12, 5], [12, -3]] as [x, y], i (i)}
			<rect
				x={x - 4}
				y={y - 4}
				width="8"
				height="8"
				rx="1.5"
				fill="var(--at-sugar)"
				stroke="var(--at-sugar-edge)"
			/>
		{/each}
	</g>
	<PlaceLabel
		id="at-sugar-name"
		x={SUGAR.x}
		y={SUGAR.y + 52}
		phone={{ x: SUGAR.x + 30, y: SUGAR.y + 70 }}
		text="sugar"
		anchor="end"
	/>

	<!-- bridge names -->
	{#if equal}
		<PlaceLabel id="at-top-name" x={480} y={164} phone={{ x: 480, y: 150 }} text="top bridge" />
		<PlaceLabel
			id="at-bottom-name"
			x={480}
			y={432}
			phone={{ x: 480, y: 450 }}
			text="bottom bridge"
		/>
	{:else}
		<PlaceLabel
			id="at-short-name"
			x={480}
			y={266}
			phone={{ x: 480, y: 254 }}
			text={late && !open0 ? 'short bridge: closed for now' : 'short bridge'}
		/>
		<PlaceLabel id="at-long-name" x={480} y={522} phone={{ x: 480, y: 510 }} text="long bridge" />
	{/if}

	<!-- the ants -->
	{#each ants as a, i (i)}
		<g transform="translate({a.x} {a.y}) rotate({a.a})">
			<path d={ANT} fill="var(--at-ant)" stroke="var(--at-ant)" stroke-width="1.2" />
			{#if a.c}<rect {...GRAIN} fill="var(--at-sugar)" stroke="var(--at-sugar-edge)" />{/if}
		</g>
	{/each}

	<!-- the tally -->
	<Readout
		id="at-tally"
		order={1}
		label="The last {counted} ants to set out took"
		value="{names[0]} bridge {tally[0]}, {names[1]} bridge {tally[1]}"
	>
		<Label
			x={40}
			y={48}
			text={counted < 50 ? `The ${counted} ants so far took:` : 'The last 50 ants to set out took:'}
			anchor="start"
			size={15}
			weight={600}
		/>
		{#each [0, 1] as side (side)}
			<g transform="translate(40 {64 + side * 26})">
				<Label x={0} y={13} text="{names[side]} bridge" anchor="start" size={14} />
				<rect x="120" y="1" width="300" height="16" rx="8" fill="var(--surface-2)" />
				<rect
					x="120"
					y="1"
					width={(300 * tally[side]) / 50}
					height="16"
					rx="8"
					fill="var(--at-meter)"
				/>
				<Label
					x={432}
					y={14}
					text={String(tally[side])}
					anchor="start"
					size={15}
					weight={700}
					tabular
				/>
			</g>
		{/each}
	</Readout>
	{#if late}
		<Readout id="at-fade" order={2} label="Scent" value={fading ? 'fades' : 'never fades'}>
			<Label
				x={920}
				y={48}
				text={fading ? 'the scent fades' : 'the scent never fades'}
				anchor="end"
				size={14}
				muted
			/>
		</Readout>
	{/if}
</g>
