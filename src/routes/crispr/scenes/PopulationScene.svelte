<script lang="ts">
	/**
	 * Steps "flask" and "arms": the population model (`simulate`) drawn over
	 * ten days. Top: bacteria (green) and phages (red) on a log scale, drawn up
	 * to the current moment (ten days in 24 s; reduced motion: the whole run).
	 * Bottom: at that moment, the commonest bacterium's array (spacers named by
	 * the phage target they match, a–f, with a prime for each changed letter)
	 * and the commonest phage's six targets, changed ones ringed in red.
	 *
	 * flask: phages never change; the CRISPR toggle switches the defence off.
	 * arms: CRISPR on; phages may change a letter.
	 */
	import { clamp, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { POP, SITES, SITE_NAMES, sampleAt, simulate, type SpacerKey } from '../model';
	import ArrayStrip from './ArrayStrip.svelte';
	import { type StripSpacer } from './strip';

	let { step, t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 999 : t);
	const view = $derived(step.hints?.view === 'arms' ? 'arms' : 'flask');

	const crispr = $derived(view === 'arms' ? true : params.crispr !== false);
	const mutate = $derived(view === 'arms' ? params.mutate !== false : false);
	const seed = $derived(1 + Number(params.again ?? 0));
	const run = $derived(simulate({ crispr, mutate, seed }));

	const DRAW = 24; // seconds to draw the ten days
	const simT = $derived(clamp((time / DRAW) * POP.hours, 0, POP.hours));

	// ---- chart geometry
	const X0 = 110;
	const X1 = 900;
	const Y0 = 320; // value 1
	const Y1 = 60; // value 1e10
	const sx = (h: number) => X0 + (h / POP.hours) * (X1 - X0);
	const sy = (v: number) => Y0 - (Math.log10(Math.max(1, v)) / 10) * (Y0 - Y1);
	const hourly = $derived(run.samples.filter((_, i) => i % Math.round(1 / POP.dt) === 0));
	const path = (key: 'bacteria' | 'phage', upTo: number) => {
		let d = '';
		for (const s of hourly) {
			if (s.t > upTo) break;
			d += `${d ? 'L' : 'M'}${sx(s.t).toFixed(1)} ${sy(s[key]).toFixed(1)}`;
		}
		const now = sampleAt(run, upTo);
		d += `${d ? 'L' : 'M'}${sx(upTo).toFixed(1)} ${sy(now[key]).toFixed(1)}`;
		return d;
	};
	const now = $derived(sampleAt(run, simT));
	const snap = $derived(run.snapshots[Math.min(run.snapshots.length - 1, Math.floor(simT))]);

	const fmt = (v: number) => {
		if (v < 1) return '0';
		const e = Math.floor(Math.log10(v));
		if (e < 3) return String(Math.round(v));
		let m = v / 10 ** e;
		if (Number(m.toFixed(1)) >= 10) {
			m /= 10;
			return `${m.toFixed(1)}×10${String(e + 1)
				.split('')
				.map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)])
				.join('')}`;
		}
		const sup = String(e)
			.split('')
			.map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)])
			.join('');
		return `${m.toFixed(1)}×10${sup}`;
	};
	const TICKS = [0, 2, 4, 6, 8, 10];
	const SUP = ['⁰', '²', '⁴', '⁶', '⁸', '¹⁰'];

	// ---- bottom panel
	const primes = (v: number) =>
		v === 0 ? '' : v === 1 ? '′' : v === 2 ? '″' : v === 3 ? '‴' : `${v}`;
	const siteColor = (s: number) => `var(--cr-s${s + 1})`;
	const MAX = 6;
	const spacers: StripSpacer[] = $derived(
		(snap?.spacers ?? []).slice(0, MAX).map((k: SpacerKey, i) => ({
			key: `${i}-${k.site}.${k.variant}`,
			label: SITE_NAMES[k.site] + primes(k.variant),
			color: siteColor(k.site)
		}))
	);
	const sites = $derived(snap?.sites ?? []);
	const day = $derived(simT / 24);
</script>

<g>
	<!-- axes -->
	{#each TICKS as e, i (e)}
		<line
			x1={X0}
			x2={X1}
			y1={sy(10 ** e)}
			y2={sy(10 ** e)}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<text x={X0 - 10} y={sy(10 ** e) + 4} text-anchor="end" font-size="12" class="muted"
			>{e === 0 ? '1' : `10${SUP[i]}`}</text
		>
	{/each}
	{#each [0, 2, 4, 6, 8, 10] as d (d)}
		<text x={sx(d * 24)} y={Y0 + 20} text-anchor="middle" font-size="12" class="muted">day {d}</text
		>
	{/each}
	<line x1={X0} x2={X0} y1={Y1} y2={Y0} stroke="var(--stage-line)" />
	<line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke="var(--stage-line)" />
	<Readout id="axis">
		<Label
			x={X0}
			y={42}
			text="number in the flask (each line is ten times the one below)"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- the run -->
	<path
		d={path('phage', simT)}
		fill="none"
		stroke="var(--cr-phage-line)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>
	<path
		d={path('bacteria', simT)}
		fill="none"
		stroke="var(--cr-bact-line)"
		stroke-width="2.6"
		stroke-linejoin="round"
	/>
	<circle cx={sx(simT)} cy={sy(now.bacteria)} r={4.5} fill="var(--cr-bact-line)" />
	<circle cx={sx(simT)} cy={sy(now.phage)} r={4.5} fill="var(--cr-phage-line)" />

	<Readout
		id="bact"
		order={1}
		label="Bacteria"
		value={fmt(now.bacteria)}
		color="var(--cr-bact-line)"
	>
		<Label
			x={X1}
			y={42}
			text="bacteria {fmt(now.bacteria)}"
			size={13}
			weight={600}
			anchor="end"
			color="var(--cr-bact-line)"
		/>
	</Readout>
	<Readout id="phage" order={2} label="Phages" value={fmt(now.phage)} color="var(--cr-phage-line)">
		<Label
			x={X1 - 170}
			y={42}
			text="phages {fmt(now.phage)}"
			size={13}
			weight={600}
			anchor="end"
			color="var(--cr-phage-line)"
		/>
	</Readout>
	<Readout id="day" order={3} label="Time" value="day {day.toFixed(1)}">
		<Label x={X1 - 330} y={42} text="day {day.toFixed(1)}" size={13} anchor="end" muted />
	</Readout>

	<!-- bottom panel: the commonest bacterium and phage -->
	<rect
		x={24}
		y={366}
		width={912}
		height={214}
		rx={12}
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="arr"
		order={4}
		label="Commonest bacterium"
		value={crispr
			? spacers.length
				? `spacers ${spacers.map((s) => s.label).join(' ')} (newest first)`
				: 'no spacers yet'
			: 'no CRISPR'}
	>
		<Label
			x={44}
			y={396}
			text="Commonest bacterium: its array"
			size={13}
			weight={600}
			anchor="start"
		/>
		<Label
			x={44}
			y={416}
			text="spacers named by the phage target they match; ′ = after a changed letter"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
	{#if crispr}
		<ArrayStrip
			x={58}
			y={482}
			{spacers}
			scale={0.72}
			text={12}
			more={(snap?.spacers.length ?? 0) > MAX}
		/>
		{#if spacers.length === 0}
			<Label x={200} y={500} text="no spacers yet" size={12} anchor="start" muted />
		{/if}
	{:else}
		<Label
			x={44}
			y={466}
			text="no CRISPR system: nothing to remember with"
			size={13}
			anchor="start"
			muted
		/>
	{/if}
	<Readout id="avg">
		<Label
			x={44}
			y={556}
			text="spacers gained, on average: {now.spacers.toFixed(1)} per bacterium"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<line x1={520} x2={520} y1={384} y2={562} stroke="var(--border)" />
	<Readout
		id="tgt"
		order={6}
		label="Commonest phage"
		value={sites.length
			? `targets ${sites.map((v, s) => SITE_NAMES[s] + primes(v)).join(' ')}`
			: 'none left'}
	>
		<Label
			x={540}
			y={396}
			text="Commonest phage: its six targets"
			size={13}
			weight={600}
			anchor="start"
		/>
		<Label
			x={540}
			y={416}
			text="ringed: a letter has changed there"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
	{#if sites.length}
		{#each Array.from({ length: SITES }, (_, s) => s) as s (s)}
			{@const v = sites[s]}
			{@const x = 552 + s * 62}
			<rect {x} y={468} width={48} height={30} rx={5} fill={siteColor(s)} />
			<text
				x={x + 24}
				y={488}
				text-anchor="middle"
				font-size="13"
				style:fill="var(--cr-on-colour)"
				font-weight="700">{SITE_NAMES[s] + primes(v)}</text
			>
			{#if v > 0}
				<rect
					x={x - 4}
					y={464}
					width={56}
					height={38}
					rx={8}
					fill="none"
					stroke="var(--cr-mismatch)"
					stroke-width="2.4"
				/>
			{/if}
		{/each}
	{:else}
		<Label x={540} y={466} text="no phages left" size={13} anchor="start" muted />
	{/if}
	<Readout id="chg">
		<Label
			x={540}
			y={556}
			text="changed letters, on average: {now.changes.toFixed(1)} per phage"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
</g>
