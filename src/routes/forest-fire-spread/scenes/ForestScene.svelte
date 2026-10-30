<script lang="ts">
	/**
	 * The forest seen from above, run by the model (`burn`): the 50 × 50 page forest lit along its
	 * left edge, with the step's density, firebreak, wind or corner rule; a 12 × 8 close-up whose
	 * arrows show which trees catch fire at the next tick; and the tally of 30 forests planted
	 * equally thickly, each bar growing as far as its fire gets. A change of control restarts the
	 * fire; under reduced motion the finished fire is shown.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { burn, carried, CLOSE, cornerSafe, PAGE, plant, reachByTick, tally } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'forest'));
	const N = PAGE.size;

	// ---- what the step plants and how the fire spreads ------------------------------------------
	const density = $derived(
		view === 'tally'
			? Number(params.tally ?? 0.59)
			: typeof step.hints?.density === 'number'
				? step.hints.density
				: Number(params.density ?? 0.5)
	);
	const breakWidth = $derived(
		typeof step.hints?.firebreak === 'number'
			? step.hints.firebreak
			: step.id === 'firebreak'
				? Number(params.firebreak ?? 0)
				: 0
	);
	const wind = $derived(params.wind === true && step.id === 'wind');
	const corners = $derived(params.corners === true && step.id === 'corners');
	const rule = $derived({ corners, jump: wind ? 1 : 0 });

	const forest = $derived(
		view === 'close'
			? plant(CLOSE.w, CLOSE.h, CLOSE.density, CLOSE.seed)
			: plant(N, N, density, PAGE.seed, { from: PAGE.firebreakFrom, width: breakWidth })
	);
	const fire = $derived(burn(forest, rule));
	const fires = $derived(view === 'tally' ? tally(N, density, 30) : []);
	const reaches = $derived(fires.map((f) => reachByTick(f, N)));

	// ---- the clock: restarts whenever the forest or the rule changes ----------------------------
	const RATE = $derived(view === 'close' ? 1 : 8);
	const restartKey = $derived(
		`${step.id}|${density}|${breakWidth}|${wind}|${corners}|${String(params.relight ?? 0)}`
	);
	let t0 = $state(0);
	$effect(() => {
		void restartKey;
		t0 = untrack(() => t);
	});
	const local = $derived(t >= t0 ? t - t0 : t);
	// The close-up waits a second before the first tick, so the lit column is seen first.
	const tick = $derived(
		reduced ? 100000 : Math.floor(Math.max(0, local - (view === 'close' ? 1 : 0.3)) * RATE)
	);
	const done = $derived(tick > fire.ticks);

	// ---- the big forest, drawn as four paths (bare ground is the background) ---------------------
	const C = $derived(view === 'tally' ? 6 : 9);
	const X0 = $derived(view === 'tally' ? 40 : 255);
	const Y0 = $derived(view === 'tally' ? 130 : 110);
	const cells = $derived.by(() => {
		if (view === 'close') return { green: '', burning: '', ember: '', glow: '', ash: '' };
		let green = '';
		let burning = '';
		let ember = '';
		let glow = '';
		let ash = '';
		const w = forest.w;
		for (let i = 0; i < forest.trees.length; i++) {
			if (!forest.trees[i]) continue;
			const x = X0 + (i % w) * C;
			const y = Y0 + Math.floor(i / w) * C;
			const r = `M${x} ${y}h${C}v${C}h${-C}z`;
			const lit = fire.lit[i];
			if (lit < 0 || lit > tick) green += r;
			else if (lit === tick) {
				if (wind && carried(fire, w, i)) ember += r;
				else burning += r;
			} else if (lit === tick - 1) glow += r;
			else ash += r;
		}
		return { green, burning, ember, glow, ash };
	});
	const reachNow = $derived.by(() => {
		let r = -1;
		fire.lit.forEach((k, i) => {
			if (k >= 0 && k <= tick) r = Math.max(r, i % forest.w);
		});
		return r;
	});
	const burntNow = $derived(fire.lit.reduce((a, k) => a + (k >= 0 && k <= tick ? 1 : 0), 0));
	const status = $derived(
		!done
			? `burning: ${reachNow + 1} of ${N} squares across`
			: fire.crossed
				? 'the fire crossed the whole forest'
				: `the fire went out ${fire.reach + 1} squares in`
	);

	// ---- the close-up ---------------------------------------------------------------------------
	const CC = 56;
	const CX = 144;
	const CY = 124;
	const safe = $derived(view === 'close' ? cornerSafe(forest, fire) : []);
	const arrows = $derived.by(() => {
		if (view !== 'close') return [];
		const out: { from: number; to: number }[] = [];
		fire.lit.forEach((k, i) => {
			if (k === tick + 1 && fire.from[i] >= 0) out.push({ from: fire.from[i], to: i });
		});
		return out;
	});
	const cxOf = (i: number) => CX + (i % CLOSE.w) * CC + CC / 2;
	const cyOf = (i: number) => CY + Math.floor(i / CLOSE.w) * CC + CC / 2;

	// ---- the tally ------------------------------------------------------------------------------
	const BX = 440;
	const BW = 440;
	const crossedNow = $derived(
		reaches.filter((r) => r[Math.min(tick, r.length - 1)] === N - 1).length
	);
	const tallyDone = $derived(fires.every((f) => tick > f.ticks));
</script>

<g class="ff">
	{#if view === 'close'}
		<!-- the close-up: ground squares, trees, fire and ash -->
		<rect x={CX} y={CY} width={CLOSE.w * CC} height={CLOSE.h * CC} fill="var(--ff-ground)" rx="4" />
		{#each Array.from({ length: CLOSE.w * CLOSE.h }, (_, i) => i) as i (i)}
			{#if forest.trees[i]}
				{@const lit = fire.lit[i]}
				{@const state = lit < 0 || lit > tick ? 'tree' : lit === tick ? 'fire' : 'ash'}
				{#if state === 'tree'}
					<circle cx={cxOf(i)} cy={cyOf(i)} r="15" fill="var(--ff-tree)" />
				{:else if state === 'fire'}
					<circle cx={cxOf(i)} cy={cyOf(i)} r="17" fill="var(--ff-fire)" />
					<path
						d="M{cxOf(i) - 8} {cyOf(i) + 8} Q{cxOf(i) - 10} {cyOf(i) - 4} {cxOf(i)} {cyOf(i) -
							14} Q{cxOf(i) + 10} {cyOf(i) - 4} {cxOf(i) + 8} {cyOf(i) + 8} Z"
						fill="var(--ff-ember)"
					/>
				{:else}
					<circle cx={cxOf(i)} cy={cyOf(i)} r="10" fill="var(--ff-ash)" />
				{/if}
			{/if}
		{/each}
		{#each arrows as a (a.to)}
			{@const dx = cxOf(a.to) - cxOf(a.from)}
			{@const dy = cyOf(a.to) - cyOf(a.from)}
			{@const len = Math.hypot(dx, dy)}
			<line
				x1={cxOf(a.from) + (dx / len) * 16}
				y1={cyOf(a.from) + (dy / len) * 16}
				x2={cxOf(a.to) - (dx / len) * 17}
				y2={cyOf(a.to) - (dy / len) * 17}
				stroke="var(--ff-arrow)"
				stroke-width="4"
				marker-end="url(#arrowhead)"
			/>
		{/each}
		{#if done}
			{#each safe as i (i)}
				<circle
					cx={cxOf(i)}
					cy={cyOf(i)}
					r="22"
					fill="none"
					stroke="var(--ff-safe)"
					stroke-width="4"
				/>
			{/each}
		{/if}
		<Readout
			id="ff-close"
			order={1}
			label="Fire"
			value={done
				? `${fire.burnt} trees burnt, ${fire.trees - fire.burnt} stayed green`
				: `tick ${Math.min(tick, fire.ticks)}`}
		>
			<Label
				x={480}
				y={70}
				text={done
					? `${fire.burnt} trees burnt, ${fire.trees - fire.burnt} stayed green`
					: `tick ${Math.min(tick, fire.ticks)}: the arrows show who catches fire next`}
				size={20}
				weight={700}
			/>
		</Readout>
		{#if done && safe.length}
			<Readout id="ff-safe" order={2} label="Circled" value="touched the fire only at a corner">
				<Label
					x={480}
					y={100}
					text="circled: touched the fire only at a corner, so they stayed green"
					size={15}
					color="var(--ff-safe)"
					weight={600}
				/>
			</Readout>
		{/if}
		<Readout id="ff-lit-close">
			<Label x={CX - 12} y={CY + (CLOSE.h * CC) / 2} text="lit here" anchor="end" size={15} muted />
		</Readout>
	{:else}
		<!-- the forest from above -->
		<rect x={X0} y={Y0} width={N * C} height={N * C} fill="var(--ff-ground)" />
		{#if breakWidth > 0 && view === 'forest'}
			<rect
				x={X0 + PAGE.firebreakFrom * C}
				y={Y0 - 6}
				width={breakWidth * C}
				height={N * C + 12}
				fill="var(--ff-break)"
			/>
			<Label
				x={X0 + (PAGE.firebreakFrom + breakWidth / 2) * C}
				y={Y0 + N * C + 26}
				text="firebreak"
				size={15}
				weight={600}
			/>
		{/if}
		<path d={cells.green} fill="var(--ff-tree)" />
		<path d={cells.ash} fill="var(--ff-ash)" />
		<path d={cells.glow} fill="var(--ff-glow)" />
		<path d={cells.burning} fill="var(--ff-fire)" />
		<path d={cells.ember} fill="var(--ff-ember)" />

		{#if view === 'forest'}
			<Readout id="ff-lit">
				<Label x={X0 - 12} y={Y0 + (N * C) / 2} text="lit here" anchor="end" size={15} muted />
				<Label
					x={X0 + N * C + 12}
					y={Y0 + (N * C) / 2}
					text="far side"
					anchor="start"
					size={15}
					muted
				/>
			</Readout>
			{#if wind}
				{#each [0.25, 0.5, 0.75] as f (f)}
					<line
						x1={60}
						y1={Y0 + N * C * f + 30}
						x2={170}
						y2={Y0 + N * C * f + 30}
						stroke="var(--ff-wind)"
						stroke-width="5"
						marker-end="url(#arrowhead)"
					/>
				{/each}
				<Label x={115} y={Y0 + N * C * 0.25} text="wind" size={16} weight={600} />
			{/if}
			<Readout
				id="ff-status"
				order={1}
				label="Fire"
				value={status}
				color={done && fire.crossed ? 'var(--ff-fire)' : undefined}
			>
				<Label
					x={480}
					y={52}
					text={status}
					size={20}
					weight={700}
					color={done && fire.crossed ? 'var(--ff-fire)' : undefined}
				/>
			</Readout>
			<Readout
				id="ff-burnt"
				order={2}
				label="Trees"
				value="{burntNow.toLocaleString('en-US')} of {fire.trees.toLocaleString('en-US')} burnt"
			>
				<Label
					x={480}
					y={82}
					text="{burntNow.toLocaleString('en-US')} of {fire.trees.toLocaleString(
						'en-US'
					)} trees burnt"
					size={15}
					muted
					tabular
				/>
			</Readout>
		{:else}
			<!-- the tally: one bar per forest, as far as its fire got -->
			<Readout id="ff-first">
				<Label
					x={X0 + (N * C) / 2}
					y={Y0 + N * C + 28}
					text={done ? 'forest 1' : 'forest 1, burning'}
					size={15}
					muted
				/>
			</Readout>
			<line
				x1={BX + BW}
				y1={110}
				x2={BX + BW}
				y2={110 + 30 * 15}
				stroke="var(--ff-fire)"
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<Readout id="ff-far">
				<Label x={BX + BW} y={100} text="far side" size={14} muted />
				<Label x={BX - 10} y={124} text="1" anchor="end" size={13} muted />
				<Label x={BX - 10} y={124 + 29 * 15} text="30" anchor="end" size={13} muted />
			</Readout>
			{#each reaches as r, k (k)}
				{@const reach = r[Math.min(tick, r.length - 1)]}
				<rect
					x={BX}
					y={112 + k * 15}
					width={((reach + 1) / N) * BW}
					height="11"
					rx="2"
					fill={reach === N - 1 ? 'var(--ff-fire)' : 'var(--ff-ash)'}
				/>
			{/each}
			<Readout
				id="ff-tally"
				order={1}
				label="Crossed"
				value="{crossedNow} of 30 forests{tallyDone ? '' : ' so far'}"
			>
				<Label
					x={480}
					y={52}
					text="the fire crossed {crossedNow} of 30 forests{tallyDone ? '' : ' so far'}"
					size={20}
					weight={700}
				/>
			</Readout>
		{/if}
	{/if}
</g>
