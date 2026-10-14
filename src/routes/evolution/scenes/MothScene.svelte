<script lang="ts">
	/**
	 * Moths on tree bark, the shades of the whole population as a histogram, and
	 * (when it runs) the average shade over the generations.
	 *
	 * Phases (`step.hints.phase`):
	 *   variation — the founders (generation 0) on pale bark; a key of the 13 shades
	 *   inherit   — six families (two parents and an offspring) on the left; on the
	 *               right every offspring of generation 1 placed by its parents'
	 *               average shade (x) and its own (y)
	 *   survive   — one generation meets the birds (`params.env`, `params.predation`):
	 *               the eaten moths go one by one; the histogram shows all moths
	 *               (outline) and the survivors (filled); below, each shade's chance
	 *               of surviving, the rule and the outcome; one moth is ringed
	 *   run       — the full simulation (environment, predation, mutation rate,
	 *               population size, the three ingredient switches), GPS generations
	 *               a second; in each generation the eaten moths fade, then the next
	 *               generation replaces them
	 *   reverse   — sooty bark for SWITCH generations, then pale bark again
	 *
	 * The run is computed once per setting (`runMoths`, seeded by `params.again`)
	 * and replayed: generation = floor(t · GPS). Reduced motion shows the last
	 * generation of the run (or the end of the birds' visit).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LOCI, SHADES, mothSurvival, runMoths } from '../model';
	import Moth from './Moth.svelte';
	import { wingColour } from './colours';

	let { step, t, params, reduced }: StageProps = $props();

	type Phase = 'variation' | 'inherit' | 'survive' | 'run' | 'reverse';
	const phase = $derived(String(step.hints?.phase ?? 'variation') as Phase);
	const G2 = 2 * LOCI;

	// ---- layout
	const TX0 = 24;
	const TY0 = 64;
	const TW = 400;
	const TH = 492;
	const RX0 = 500;
	const RX1 = 920;

	// ---- settings
	// Only the controls a step shows apply to it: the ingredients step runs the default
	// population (birds on sooty bark, 50%, 1 in 1,000, 500 moths) and the foresight step
	// the default birds, whatever was set on the earlier steps.
	const own = (id: string) => step.controls?.some((c) => c.id === id) ?? false;
	const env = $derived(own('env') ? String(params.env ?? 'sooty') : 'sooty');
	const birds = $derived(
		phase === 'variation' || phase === 'inherit' ? false : env !== 'none' || phase === 'reverse'
	);
	const predation = $derived(
		birds ? (own('predation') ? Number(params.predation ?? 0.5) : 0.5) : 0
	);
	const sootyNow = $derived(phase === 'variation' || phase === 'inherit' ? false : env !== 'pale');
	const N = $derived(own('N') ? Number(params.N ?? 500) : 500);
	const mu = $derived(own('mu') ? Number(params.mu ?? 0.001) : 0.001);
	const runs = $derived(Number(params.again ?? 0));
	const switches = $derived(
		step.id === 'ingredients'
			? {
					variation: params.variation !== false,
					inheritance: params.inheritance !== false,
					selection: params.selection !== false
				}
			: { variation: true, inheritance: true, selection: true }
	);
	const SWITCH = 60;
	const GENS = $derived(phase === 'reverse' ? 140 : phase === 'run' ? 100 : 1);
	const GPS = $derived(phase === 'reverse' ? 4 : 3);

	const sim = $derived(
		runMoths({
			N,
			mu,
			predation,
			bark: phase === 'reverse' ? (g) => (g < SWITCH ? 1 : 0) : () => (sootyNow ? 1 : 0),
			generations: GENS,
			seed: 11 + runs * 7919 + (phase === 'reverse' ? 3 : 0),
			...switches
		})
	);

	// ---- time
	const LEAD = 0.6;
	const running = $derived(phase === 'run' || phase === 'reverse');
	const clock = $derived(reduced ? GENS + 0.99 : Math.max(0, t - LEAD) * GPS);
	const g = $derived(running ? Math.min(GENS, Math.floor(clock)) : 0);
	const frac = $derived(running ? (g >= GENS ? 0 : clock - Math.floor(clock)) : 0);
	const gen = $derived(sim[g]);

	// The birds' visit in the survive phase: eaten moths go one by one over VISIT seconds.
	const VISIT = 6;
	const visit = $derived(phase === 'survive' ? (reduced ? 1 : clamp((t - 1) / VISIT)) : 0);

	// Bark shade. Between steps and when the environment control changes it is tweened
	// (the effect depends only on the step and the control); in the foresight run the air
	// is cleaned at generation SWITCH and the bark lightens over two generations of
	// animation time (a pure function of t).
	const barkTarget = $derived(sootyNow ? 1 : 0);
	const barkTween = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const b = barkTarget;
		untrack(() => barkTween.set(b, { duration: reduced ? 0 : 900 }));
	});
	const bark = $derived({
		current: phase === 'reverse' ? 1 - smoothstep(SWITCH - 1, SWITCH + 1, clock) : barkTween.current
	});
	const barkFill = $derived.by(() => {
		const pale = [205, 202, 186];
		const sooty = [60, 56, 51];
		const u = bark.current;
		return `rgb(${pale.map((p, i) => Math.round(p + (sooty[i] - p) * u)).join(',')})`;
	});
	const lichen = $derived(`rgba(150, 170, 120, ${0.4 * (1 - bark.current)})`);
	const soot = $derived(`rgba(20, 18, 16, ${0.5 * bark.current})`);

	// ---- the moths on the bark
	const COLS = 10;
	const ROWS = 10;
	const slots = Array.from({ length: COLS * ROWS }, (_, i) => {
		const c = i % COLS;
		const r = Math.floor(i / COLS);
		return {
			x: TX0 + 22 + (c + 0.5) * ((TW - 44) / COLS) + (hash(i, 1) - 0.5) * 12,
			y: TY0 + 30 + (r + 0.5) * ((TH - 60) / ROWS) + (hash(i, 2) - 0.5) * 14,
			rot: (hash(i, 3) - 0.5) * 50
		};
	});
	// The order in which the birds find the eaten moths (survive phase).
	const eatOrder = $derived.by(() => {
		const eaten = gen.survived.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
		eaten.sort((a, b) => hash(a, 9) - hash(b, 9));
		// when[i]: the share of the visit at which moth i is eaten (−1: it survives).
		const when = gen.survived.map(() => -1);
		eaten.forEach((i, k) => (when[i] = (k + 0.5) / Math.max(1, eaten.length)));
		return when;
	});
	const ringed = $derived(
		gen.survived.findIndex((s, i) => s && gen.sample[i] >= 4 && gen.sample[i] <= 7)
	);

	function mothOpacity(i: number): number {
		if (phase === 'survive') {
			const w = eatOrder[i];
			return w < 0 ? 1 : 1 - smoothstep(w - 0.02, w + 0.04, visit) * 0.92;
		}
		if (!running || gen.survived[i] || g >= GENS) return 1;
		// Eaten moths fade in the middle of the generation.
		return 1 - 0.85 * smoothstep(0.2, 0.55, frac);
	}
	// The bird, at the moth it is eating (survive phase).
	const bird = $derived.by(() => {
		if (phase !== 'survive' || visit <= 0 || visit >= 1) return null;
		let best = -1;
		let bestW = Infinity;
		for (let i = 0; i < eatOrder.length; i++) {
			const w = eatOrder[i];
			if (w >= 0 && w >= visit - 0.04 && w < bestW) {
				bestW = w;
				best = i;
			}
		}
		return best >= 0 ? slots[best] : null;
	});
	// Between generations the next one fades in (run phases).
	const swap = $derived(running && g < GENS ? smoothstep(0.75, 1, frac) : 0);

	// ---- histogram (share of moths of each shade)
	const HY0 = 92;
	const HY1 = 262;
	const histOf = (h: number[], n: number) => h.map((c) => c / Math.max(1, n));
	const before = $derived(histOf(gen.hist, N));
	const after = $derived(
		phase === 'survive'
			? histOf(
					gen.hist.map((c, k) => c - (c - gen.survivorHist[k]) * visit),
					N
				)
			: before
	);
	const ghost = $derived(phase === 'survive' ? before : running ? histOf(sim[0].hist, N) : null);
	const hMax = $derived(
		Math.max(0.3, ...before, ...(ghost ?? [])) > 0.6
			? 1
			: Math.max(0.3, ...before, ...(ghost ?? [])) > 0.4
				? 0.6
				: 0.4
	);
	const hx = scale([0, SHADES], [RX0, RX1]);
	const hy = $derived(scale([0, hMax], [HY1, HY0]));
	const barW = (RX1 - RX0) / SHADES;
	const shadeOf = (k: number) => k / G2;

	// ---- the average shade over the generations
	const MY0 = 360;
	const MY1 = 512;
	const mx = $derived(scale([0, GENS], [RX0, RX1]));
	const my = scale([0, 1], [MY1, MY0]);
	const meanPath = $derived(
		linePath(
			sim.slice(0, g + 1),
			(d) => d.g,
			(d) => d.mean,
			mx,
			my
		)
	);
	const barkPath = $derived(
		linePath(
			sim,
			(d) => d.g,
			(d) => d.bark,
			mx,
			my
		)
	);

	// ---- survival rule (survive phase)
	const sy = scale([0, 1], [MY1, MY0]);
	const observed = $derived(
		gen.hist
			.map((c, k) => (c >= 8 ? { k, share: gen.survivorHist[k] / c } : null))
			.filter((d) => d !== null)
	);
	const survived = $derived(gen.survivors);
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const darkAvg = $derived(
		(phase === 'survive' ? gen.mean + (gen.survivorMean - gen.mean) * visit : gen.mean) * G2
	);

	// ---- inheritance (the first offspring generation of a population)
	const kids = $derived(
		phase === 'inherit'
			? runMoths({
					N: 500,
					mu: 0.001,
					predation: 0,
					bark: () => 0,
					generations: 1,
					seed: 11,
					// A more even mix than the woodland's, so the offspring span the whole scale.
					founding: 0.45
				})[1]
			: null
	);
	const families = $derived(
		kids ? kids.parents.slice(0, 6).map((p, i) => ({ a: p[0], b: p[1], c: kids.sample[i] })) : []
	);
	const ix = scale([0, G2], [RX0 + 30, RX1 - 10]);
	const iy = scale([0, G2], [500, 110]);
	const reveal = $derived(reduced ? 1 : smoothstep(0.4, 3, t));

	const title = $derived(
		phase === 'inherit'
			? 'Six families: parents and one offspring'
			: `${Math.min(100, N)} of the ${N.toLocaleString('en-GB')} moths${running ? `, generation ${g}` : ''}`
	);
	const envLabel = $derived(
		running && phase === 'reverse'
			? g < SWITCH
				? 'sooty bark'
				: 'clean, pale bark'
			: sootyNow
				? 'sooty bark'
				: 'pale bark'
	);
	const birdsLabel = $derived(birds ? `birds hunting (${pct(predation)})` : 'no birds');
	const offSwitches = $derived(
		[
			!switches.variation && 'no variation',
			!switches.inheritance && 'no inheritance',
			!switches.selection && 'equal survival'
		].filter(Boolean) as string[]
	);
</script>

<g>
	<!-- ===================================================== left: bark or families -->
	{#if phase !== 'inherit'}
		<Label x={TX0} y={44} text={title} anchor="start" size={14} weight={600} />
		<rect x={TX0} y={TY0} width={TW} height={TH} rx="14" fill={barkFill} stroke="var(--border)" />
		<!-- bark texture: furrows, lichen patches on clean bark, soot on dirty bark -->
		{#each Array.from({ length: 14 }, (_, k) => k) as k (k)}
			<path
				d="M{TX0 + 14 + k * 27 + hash(k, 4) * 8} {TY0 + 6} C {TX0 +
					4 +
					k * 27 +
					hash(k, 5) * 20} {TY0 + TH * 0.35}, {TX0 + 24 + k * 27 + hash(k, 6) * 10} {TY0 +
					TH * 0.65}, {TX0 + 12 + k * 27 + hash(k, 7) * 12} {TY0 + TH - 6}"
				stroke={soot}
				stroke-width={2 + hash(k, 8) * 3}
				fill="none"
			/>
		{/each}
		{#each Array.from({ length: 9 }, (_, k) => k) as k (k)}
			<ellipse
				cx={TX0 + 30 + hash(k, 11) * (TW - 60)}
				cy={TY0 + 30 + hash(k, 12) * (TH - 60)}
				rx={22 + hash(k, 13) * 26}
				ry={12 + hash(k, 14) * 16}
				fill={lichen}
			/>
		{/each}
		{#each slots as s, i (i)}
			{#if i < gen.sample.length}
				{@const next = running && g < GENS ? sim[g + 1].sample[i] : undefined}
				<Moth
					x={s.x}
					y={s.y}
					rotate={s.rot}
					size={0.95}
					shade={shadeOf(
						next !== undefined && swap > 0
							? gen.sample[i] + (next - gen.sample[i]) * swap
							: gen.sample[i]
					)}
					opacity={swap > 0 ? Math.max(mothOpacity(i), swap) : mothOpacity(i)}
				/>
			{/if}
		{/each}
		{#if bird}
			<g transform="translate({bird.x} {bird.y - 18})" opacity="0.92">
				<path
					d="M-16 -2 C -10 -10, -2 -10, 0 -4 C 2 -10, 10 -10, 16 -2 C 8 -5, 4 -2, 0 2 C -4 -2, -8 -5, -16 -2 Z"
					fill="var(--stage-ink)"
				/>
			</g>
		{/if}
		{#if phase === 'survive' && ringed >= 0}
			{@const s = slots[ringed]}
			<circle cx={s.x} cy={s.y} r="20" fill="none" stroke="var(--ev-r3)" stroke-width="2.5" />
			<Readout
				id="ringed"
				order={9}
				label="Ringed moth"
				value="{gen.sample[ringed]} dark alleles, all its life"
			>
				<Label
					x={s.x < TX0 + TW / 2 ? s.x + 26 : s.x - 26}
					y={s.y + 4}
					anchor={s.x < TX0 + TW / 2 ? 'start' : 'end'}
					text="{gen.sample[ringed]} of 12 dark, all its life"
					size={12}
					pill
				/>
			</Readout>
		{/if}
		<Readout id="env" order={1} label="Bark" value="{envLabel}, {birdsLabel}">
			<Label
				x={TX0 + 12}
				y={TY0 + TH + 26}
				anchor="start"
				text="{envLabel} · {birdsLabel}"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Label x={TX0} y={44} text={title} anchor="start" size={14} weight={600} />
		<rect
			x={TX0}
			y={TY0}
			width={TW}
			height={TH}
			rx="14"
			fill="var(--ev-panel)"
			stroke="var(--border)"
		/>
		<Readout
			id="families"
			order={1}
			label="Dark alleles, parents → offspring"
			value={families.map((f) => `${f.a} × ${f.b} → ${f.c}`).join(' · ')}
		/>
		{#each families as f, i (i)}
			{@const y = TY0 + 48 + i * 76}
			{@const o = reduced ? 1 : smoothstep(0.3 + i * 0.35, 0.8 + i * 0.35, t)}
			<g opacity={o}>
				<Moth x={TX0 + 60} {y} shade={shadeOf(f.a)} size={1.3} />
				<Label x={TX0 + 110} y={y + 5} text="×" size={16} muted />
				<Moth x={TX0 + 160} {y} shade={shadeOf(f.b)} size={1.3} />
				<path
					d="M{TX0 + 205} {y} H{TX0 + 280}"
					stroke="var(--stage-line)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
				<Moth x={TX0 + 330} {y} shade={shadeOf(f.c)} size={1.3} />
				<Label x={TX0 + 60} y={y + 30} text="{f.a} dark" size={11} muted />
				<Label x={TX0 + 160} y={y + 30} text="{f.b} dark" size={11} muted />
				<Label x={TX0 + 330} y={y + 30} text="{f.c} dark" size={11} weight={600} />
			</g>
		{/each}
	{/if}

	<!-- ===================================================== right: charts -->
	{#if phase === 'inherit' && kids}
		<Label
			x={RX0}
			y={56}
			text="Every offspring: its shade against its parents’ average"
			anchor="start"
			size={13}
			weight={600}
		/>
		<Axes
			sx={ix}
			sy={iy}
			xTicks={[0, 2, 4, 6, 8, 10, 12]}
			yTicks={[0, 2, 4, 6, 8, 10, 12]}
			xLabel="parents’ average (dark alleles)"
		/>
		<Label x={RX0 + 30} y={100} text="offspring" anchor="start" size={11} muted />
		<line
			x1={ix(0)}
			y1={iy(0)}
			x2={ix(12)}
			y2={iy(12)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		{#each kids.sample as c, i (i)}
			{@const p = kids.parents[i]}
			<circle
				cx={ix((p[0] + p[1]) / 2) + (hash(i, 21) - 0.5) * 10}
				cy={iy(c) + (hash(i, 22) - 0.5) * 10}
				r="4"
				fill="var(--ev-r1)"
				fill-opacity="0.6"
				opacity={smoothstep(i / 100, i / 100 + 0.05, reveal)}
			/>
		{/each}
		<Readout id="kids" order={2} label="Offspring" value="each dot one offspring of generation 1">
			<Label
				x={RX1}
				y={562}
				anchor="end"
				text="each dot: one offspring · dashed: offspring = parents’ average"
				size={11}
				muted
			/>
		</Readout>
	{:else}
		<Label
			x={RX0}
			y={56}
			text={phase === 'survive'
				? 'Shades: all the moths and the survivors'
				: 'How many moths of each shade'}
			anchor="start"
			size={13}
			weight={600}
		/>
		<Axes sx={hx} sy={hy} xTicks={[]} yTicks={[0, hMax / 2, hMax]} yFormat={pct} />
		{#each after as v, k (k)}
			<rect
				x={hx(k) + 3}
				y={hy(v)}
				width={barW - 6}
				height={Math.max(0, HY1 - hy(v))}
				rx="2"
				fill={wingColour(shadeOf(k))}
				stroke="var(--stage-line)"
				stroke-width="0.8"
			/>
		{/each}
		{#if ghost}
			{#each ghost as v, k (k)}
				<rect
					x={hx(k) + 1}
					y={hy(v)}
					width={barW - 2}
					height={Math.max(0, HY1 - hy(v))}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.2"
					stroke-dasharray="3 3"
				/>
			{/each}
		{/if}
		<Label x={RX0} y={HY1 + 18} text="pale" anchor="start" size={11} muted />
		<Label x={(RX0 + RX1) / 2} y={HY1 + 18} text="dark alleles: 0 … 12" size={11} muted />
		<Label x={RX1} y={HY1 + 18} text="dark" anchor="end" size={11} muted />
		{#if ghost}
			<Readout
				id="ghost"
				order={3}
				label="Dashed outline"
				value={phase === 'survive' ? 'all moths, before the birds' : 'generation 0'}
			>
				<Label
					x={RX1}
					y={HY0 - 10}
					anchor="end"
					text={phase === 'survive'
						? 'dashed: before the birds · filled: survivors'
						: 'dashed: generation 0'}
					size={11}
					muted
				/>
			</Readout>
		{/if}

		{#if phase === 'variation'}
			<Label x={RX0} y={326} text="The 13 shades" anchor="start" size={13} weight={600} />
			{#each Array.from({ length: SHADES }, (_, k) => k) as k (k)}
				<Moth x={RX0 + 16 + k * 32.5} y={400} shade={shadeOf(k)} size={0.9} />
				<Label x={RX0 + 16 + k * 32.5} y={428} text={String(k)} size={11} muted />
			{/each}
			<Readout
				id="key"
				order={4}
				label="Shade"
				value="number of dark alleles, 0 to 12 (6 genes × 2 copies)"
			>
				<Label
					x={RX0}
					y={462}
					anchor="start"
					text="dark alleles out of 12 (6 genes × 2 copies)"
					size={12}
					muted
				/>
			</Readout>
		{:else if phase === 'survive'}
			<Label
				x={RX0}
				y={326}
				text="Chance of surviving the birds"
				anchor="start"
				size={13}
				weight={600}
			/>
			<Axes sx={hx} {sy} xTicks={[]} yTicks={[0, 0.5, 1]} yFormat={pct} />
			<Label x={RX0} y={MY1 + 18} text="pale" anchor="start" size={11} muted />
			<Label x={RX1} y={MY1 + 18} text="dark" anchor="end" size={11} muted />
			<path
				d={linePath(
					Array.from({ length: SHADES }, (_, k) => k),
					(k) => k + 0.5,
					(k) => mothSurvival(shadeOf(k), sootyNow ? 1 : 0, predation),
					hx,
					sy
				)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				fill="none"
			/>
			{#each observed as d (d.k)}
				<circle
					cx={hx(d.k + 0.5)}
					cy={sy(d.share)}
					r="4.5"
					fill="var(--ev-r1)"
					opacity={smoothstep(0.85, 1, visit)}
				/>
			{/each}
			<Readout
				id="survived"
				order={2}
				label="Survived"
				value="{survived} of {N}"
				opacity={smoothstep(0.85, 1, visit)}
			>
				<Label
					x={RX1}
					y={MY1 + 42}
					anchor="end"
					text="dashed: the rule · dots: what happened · {survived} of {N} survived"
					size={11}
					muted
					opacity={smoothstep(0.85, 1, visit)}
				/>
			</Readout>
		{:else}
			<Label
				x={RX0}
				y={326}
				text="Average shade, generation by generation"
				anchor="start"
				size={13}
				weight={600}
			/>
			<Axes
				sx={mx}
				sy={my}
				yTicks={[0, 0.5, 1]}
				yFormat={(v) => (v === 0 ? 'pale' : v === 1 ? 'dark' : '')}
				xLabel="generations"
			/>
			<path
				d={barkPath}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
				fill="none"
			/>
			<path d={meanPath} stroke="var(--ev-r1)" stroke-width="2.5" fill="none" />
			<circle cx={mx(g)} cy={my(gen.mean)} r="4" fill="var(--ev-r1)" />
			{#if phase === 'reverse'}
				<line
					x1={mx(SWITCH)}
					x2={mx(SWITCH)}
					y1={MY0}
					y2={MY1}
					stroke="var(--stage-line)"
					stroke-dasharray="2 3"
				/>
				<Label x={mx(SWITCH) + 6} y={MY0 + 12} anchor="start" text="air cleaned" size={11} muted />
			{/if}
			<Readout id="legend" order={5}>
				<Label
					x={RX1}
					y={MY0 - 8}
					anchor="end"
					text="dashed: bark · blue: average moth"
					size={11}
					muted
				/>
			</Readout>
		{/if}
		<Readout
			id="mean"
			order={2}
			label="Average moth"
			value="{darkAvg.toFixed(1)} of 12 dark alleles"
		>
			<Label
				x={RX0}
				y={HY1 + 40}
				anchor="start"
				text="average moth: {darkAvg.toFixed(1)} of 12 dark alleles"
				size={12}
			/>
		</Readout>
		{#if running && offSwitches.length}
			<Readout id="off" order={6} label="Switched off" value={offSwitches.join(', ')}>
				<Label
					x={RX1}
					y={HY1 + 40}
					anchor="end"
					text="off: {offSwitches.join(', ')}"
					size={12}
					color="var(--ev-lost)"
					weight={600}
				/>
			</Readout>
		{/if}
	{/if}
</g>
