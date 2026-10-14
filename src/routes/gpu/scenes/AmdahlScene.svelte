<script lang="ts">
	/**
	 * Amdahl's law, measured: the matrix job with a share s that must run in
	 * sequence, on 1 to 16,384 workers.
	 *
	 * Modes (`step.hints.mode`):
	 *   curve   — log-log speed-up against workers: the ideal line, Amdahl's
	 *             curve, its ceiling 1/s, and the measured speed-ups (dots,
	 *             one per power of two, appearing one after another); bars
	 *             compare one worker's time with N workers' time
	 *   contest — the same chart; the bars race the fast core against the N
	 *             slow lanes (and, with `params.hybrid`, the fast core taking
	 *             the sequential part while the lanes do the rest)
	 *
	 * Bars fill on a shared clock (a pure function of t): the slowest finishes
	 * at BAR_T seconds. Reduced motion shows everything finished.
	 */
	import { Axes, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Label from './Txt.svelte';
	import { FAST_IPC, amdahl, contest, measuredSpeedup } from '../gpu';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'curve') as 'curve' | 'contest');
	const s = $derived(clamp(Number(params.serial ?? 5), 0, 50) / 100);
	const exp = $derived(clamp(Math.round(Number(params.workers ?? 10)), 0, 14));
	const N = $derived(2 ** exp);
	const hybrid = $derived(mode === 'contest' && Boolean(params.hybrid));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const fx = (v: number) => (v < 10 ? fmt(v, 1) : fmt(v));

	// ---- chart --------------------------------------------------------------------
	const PLOT = { x0: 96, x1: 540, y0: 80, y1: 470 };
	const sx = scale([0, 14], [PLOT.x0, PLOT.x1]);
	const sy = scale([0, 14], [PLOT.y1, PLOT.y0]);
	const lx = (n: number) => sx(Math.log2(n));
	const ly = (v: number) => sy(Math.log2(v));
	const ticks = [0, 2, 4, 6, 8, 10, 12, 14];
	const tickFmt = (v: number) => fmt(2 ** v);
	const curve = $derived.by(() => {
		let d = '';
		for (let k = 0; k <= 140; k++) {
			const n = 2 ** (k / 10);
			d += `${k === 0 ? 'M' : 'L'}${lx(n).toFixed(1)} ${ly(amdahl(s, n)).toFixed(1)}`;
		}
		return d;
	});
	const measured = $derived(
		Array.from({ length: 15 }, (_, k) => ({ k, n: 2 ** k, v: measuredSpeedup(s, 2 ** k).speedup }))
	);
	const DOT_LEAD = 0.6;
	const DOT_T = 0.22;
	const dotsShown = $derived(reduced ? 15 : clamp(Math.floor((t - DOT_LEAD) / DOT_T) + 1, 0, 15));
	const now = $derived(measuredSpeedup(s, N));
	const workersText = $derived(`${fmt(N)} worker${N === 1 ? '' : 's'}`);
	const ceiling = $derived(s > 0 ? 1 / s : Infinity);

	// ---- bars -----------------------------------------------------------------------
	const BX = 600;
	const BW = 320;
	const BAR_LEAD = 1;
	const BAR_T = 5;
	const fight = $derived(contest(s, N, hybrid));
	const bars = $derived.by(() => {
		if (mode === 'curve') {
			const one = now.one;
			return {
				max: one,
				items: [
					{ id: 'one', label: '1 worker', total: one, serial: one * s, color: 'var(--gpu-lane)' },
					{
						id: 'many',
						label: `${fmt(N)} worker${N === 1 ? '' : 's'}`,
						total: now.many,
						serial: one * s,
						color: 'var(--gpu-lane)'
					}
				]
			};
		}
		const lanesLabel = `${fmt(N)} slow lane${N === 1 ? '' : 's'}`;
		const items = [
			{
				id: 'fast',
				label: '1 fast core',
				total: fight.fast,
				serial: fight.serial / FAST_IPC,
				color: 'var(--gpu-fast)'
			},
			{
				id: 'lanes',
				label: hybrid ? `fast core, then ${lanesLabel}` : lanesLabel,
				total: fight.lanes,
				serial: hybrid ? fight.serial / FAST_IPC : fight.serial,
				color: 'var(--gpu-lane)'
			}
		];
		return { max: Math.max(fight.fast, fight.lanes), items };
	});
	const clock = $derived(reduced ? Infinity : Math.max(0, t - BAR_LEAD) / BAR_T);
	const pct = (v: number) => `${fmt(100 * v)}%`;
</script>

<g opacity={fadeIn}>
	<Axes
		{sx}
		{sy}
		xTicks={ticks}
		yTicks={ticks}
		xFormat={tickFmt}
		yFormat={tickFmt}
		xLabel="workers"
		yLabel="speed-up (times faster than 1 worker)"
	/>
	<!-- ideal: N workers, N times faster -->
	<line
		x1={lx(1)}
		y1={ly(1)}
		x2={lx(16384)}
		y2={ly(16384)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
		stroke-width="1.2"
	/>
	<Readout id="ideal">
		<Label
			x={lx(512)}
			y={ly(512) - 12}
			anchor="end"
			size={12}
			muted
			rotate={-41}
			text="if everything split"
		/>
	</Readout>
	{#if s > 0}
		<line
			x1={PLOT.x0}
			x2={PLOT.x1}
			y1={ly(ceiling)}
			y2={ly(ceiling)}
			stroke="var(--gpu-serial)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
	{/if}
	<Readout
		id="ceiling"
		order={2}
		label="Ceiling"
		value={s > 0 ? `1 ÷ ${fmt(100 * s)}% = ${fx(ceiling)}×` : 'none: nothing in sequence'}
		color="var(--gpu-serial)"
	>
		<Label
			x={s > 0 ? PLOT.x1 : PLOT.x0 + 12}
			y={s > 0 ? ly(ceiling) - 9 : PLOT.y0 + 40}
			anchor={s > 0 ? 'end' : 'start'}
			size={13}
			weight={700}
			color="var(--gpu-serial)"
			text={s > 0
				? `ceiling: 1 ÷ ${fmt(100 * s)}% = ${fx(ceiling)}×`
				: 'nothing in sequence: no ceiling'}
		/>
	</Readout>
	<path d={curve} fill="none" stroke="var(--gpu-lane)" stroke-width="2.5" />
	{#each measured as m (m.k)}
		<circle
			cx={lx(m.n)}
			cy={ly(m.v)}
			r={m.n === N ? 7 : 4.5}
			fill={m.n === N ? 'var(--gpu-lane)' : 'var(--stage-bg)'}
			stroke="var(--gpu-lane)"
			stroke-width="2"
			opacity={m.k < dotsShown ? 1 : 0}
		/>
	{/each}
	<Readout
		id="now"
		order={1}
		label={mode === 'curve' ? `Measured with ${workersText}` : undefined}
		value="{fx(now.speedup)}× faster"
		color="var(--gpu-lane)"
	>
		<Label
			x={lx(N) + (exp > 10 ? -12 : 12)}
			y={ly(now.speedup) + (ly(now.speedup) > PLOT.y1 - 60 ? -44 : 22)}
			anchor={exp > 10 ? 'end' : 'start'}
			size={13}
			weight={700}
			color="var(--gpu-lane)"
			opacity={exp < dotsShown ? 1 : 0}
			text="{workersText}: {fx(now.speedup)}× faster"
		/>
	</Readout>
	<Readout id="legend">
		<Label
			x={PLOT.x0 + 12}
			y={PLOT.y0 + 18}
			anchor="start"
			size={12}
			muted
			text="dots: measured · line: Amdahl’s law"
		/>
	</Readout>

	<!-- bars -->
	<Readout id="bars-title">
		<Label
			x={BX}
			y={100}
			anchor="start"
			size={14}
			weight={700}
			text={mode === 'curve' ? 'Ticks for the whole job' : 'The race, in ticks'}
		/>
		<Label
			x={BX}
			y={122}
			anchor="start"
			size={12}
			muted
			text="{fmt(100 * s)}% in sequence (orange), the rest split (green)"
		/>
	</Readout>
	{#each bars.items as b, i (b.id)}
		{@const y = 160 + i * 96}
		{@const fill = clamp((clock * bars.max) / b.total)}
		{@const w = (BW * b.total) / bars.max}
		{@const done = fill >= 1}
		{@const sw = Math.min(w, (BW * b.serial) / bars.max)}
		<Readout
			id="bar-{b.id}"
			order={3 + i}
			label={b.label}
			value="{fmt(b.total)} ticks"
			color={b.color}
		>
			<Label x={BX} {y} anchor="start" size={13} weight={600} color={b.color} text={b.label} />
			<rect x={BX} y={y + 10} width={BW} height="22" rx="4" fill="var(--stage-grid)" />
			<clipPath id="amdahl-bar-{b.id}">
				<rect x={BX} y={y + 10} width={Math.max(0, w * fill)} height="22" />
			</clipPath>
			<g clip-path="url(#amdahl-bar-{b.id})">
				<rect x={BX} y={y + 10} width={Math.max(1.5, sw)} height="22" fill="var(--gpu-serial)" />
				<rect
					x={BX + sw}
					y={y + 10}
					width={Math.max(b.serial < b.total ? 2 : 0, w - sw)}
					height="22"
					fill="var(--gpu-lane)"
				/>
			</g>
			<Label
				x={BX}
				y={y + 54}
				anchor="start"
				size={12}
				opacity={done ? 1 : 0.4}
				text="{fmt(b.total)} ticks{b.serial > 0 && mode === 'curve' && i === 1
					? ` (${pct(b.serial / b.total)} of it in sequence)`
					: ''}"
			/>
		</Readout>
	{/each}
	{#if mode === 'curve'}
		<Readout id="ratio">
			<Label
				x={BX}
				y={380}
				anchor="start"
				size={15}
				weight={700}
				opacity={clock >= 1 ? 1 : 0}
				text="{workersText}: {fx(now.speedup)}× faster"
			/>
			<Label
				x={BX}
				y={402}
				anchor="start"
				size={12}
				muted
				opacity={clock >= 1 ? 1 : 0}
				text={s > 0 ? 'the sequential part doesn’t shrink' : 'every worker busy all the time'}
			/>
		</Readout>
	{:else}
		{@const lanesWin = fight.winner === 'lanes'}
		{@const margin = Math.max(fight.fast, fight.lanes) / Math.min(fight.fast, fight.lanes)}
		<Readout
			id="verdict"
			order={6}
			label="Winner"
			value={lanesWin ? (hybrid ? 'the two together' : 'the slow lanes') : 'the fast core'}
		>
			<Label
				x={BX}
				y={380}
				anchor="start"
				size={16}
				weight={700}
				color={lanesWin ? 'var(--gpu-lane)' : 'var(--gpu-fast)'}
				opacity={clock >= 1 ? 1 : 0}
				text={lanesWin
					? hybrid
						? 'The two together win'
						: 'The slow lanes win'
					: 'The fast core wins'}
			/>
			<Label
				x={BX}
				y={404}
				anchor="start"
				size={12}
				muted
				opacity={clock >= 1 ? 1 : 0}
				text="{fx(margin)}× quicker than {lanesWin ? 'the fast core alone' : 'the lanes'}"
			/>
		</Readout>
		<Readout id="rule">
			<Label
				x={BX}
				y={444}
				anchor="start"
				size={12}
				muted
				text="the fast core does {FAST_IPC} instructions per tick; a lane does 1"
			/>
		</Readout>
	{/if}
</g>
