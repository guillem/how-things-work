<script lang="ts">
	/**
	 * Bitcoin's retarget (`retargetRun`): average block time in each 2016-block period when
	 * the hash rate changes by `params.jump` from the third period (week 4) on. Bars appear one
	 * period at a time; under each, the hash rate and the difficulty the nodes computed.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type Params } from '#lib/explainer/index.ts';
	import { retargetRun } from '../consensus';
	import Txt from './Txt.svelte';

	interface Props {
		t: number;
		params: Params;
		reduced: boolean;
	}
	let { t, params, reduced }: Props = $props();

	const jump = $derived(clamp(Number(params.jump ?? 2), 0.25, 8));
	const PERIODS = 8;
	const run = $derived(retargetRun(jump, PERIODS, 2));
	const tv = $derived(reduced ? 100 : t);
	const shown = (p: number) => smoothstep(0.4 + p * 0.7, 0.9 + p * 0.7, tv);

	const X0 = 110;
	const X1 = 920;
	const Y0 = 400;
	const Y1 = 110;
	const YMAX = 40;
	const y = (min: number) => Y0 - ((Y0 - Y1) * Math.min(min, YMAX)) / YMAX;
	const bw = (X1 - X0) / PERIODS;
	const bx = (p: number) => X0 + p * bw + bw * 0.18;
	const ticks = [0, 10, 20, 30, 40];
	const mult = (v: number) => {
		const r = Math.round(v * 100) / 100;
		return `× ${r}`;
	};
	const minutes = (s: number) => {
		const m = s / 60;
		return m >= 9.95 && m <= 10.05 ? '10' : m.toFixed(m < 2 ? 2 : 1);
	};
	const last = $derived(run[run.length - 1]);
</script>

<g>
	<Readout id="title" order={1} label="Target" value="one block every 10 minutes">
		<Txt
			x={24}
			y={40}
			text="Average time between blocks, in each period of 2016 blocks"
			size={16}
			weight={700}
		/>
	</Readout>
	<Readout id="sub" order={2} label="Hash rate" value="{mult(jump)} from week 4">
		<Txt
			x={24}
			y={64}
			text="Hash rate {mult(
				jump
			)} from period 3 on (week 4 at the normal pace) · the target is 10 minutes"
			size={12}
			muted
		/>
	</Readout>

	<!-- axes -->
	{#each ticks as v (v)}
		<line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="var(--stage-grid)" />
		<Txt x={X0 - 10} y={y(v) + 4} text="{v} min" size={11} anchor="end" muted />
	{/each}
	<line
		x1={X0}
		x2={X1}
		y1={y(10)}
		y2={y(10)}
		stroke="var(--cb-ok)"
		stroke-width="2"
		stroke-dasharray="7 5"
	/>
	<Readout id="legend">
		<line
			x1={X1 - 150}
			x2={X1 - 120}
			y1={92}
			y2={92}
			stroke="var(--cb-ok)"
			stroke-width="2"
			stroke-dasharray="7 5"
		/>
		<Txt x={X1 - 112} y={96} text="target: 10 min" size={12} weight={700} color="var(--cb-ok)" />
	</Readout>

	{#each run as r (r.period)}
		{@const o = shown(r.period)}
		{@const m = r.blockTime / 60}
		{@const off = Math.abs(m - 10) > 0.1}
		<g opacity={o}>
			<rect
				x={bx(r.period)}
				y={y(m * o)}
				width={bw * 0.64}
				height={Y0 - y(m * o)}
				rx="4"
				fill={off ? 'var(--cb-work)' : 'var(--cb-follower)'}
			/>
			<Txt
				x={bx(r.period) + bw * 0.32}
				y={Math.max(y(m) - 8, Y1 - 4)}
				text="{minutes(r.blockTime)}{m > YMAX ? ' ↑' : ''}"
				size={12}
				weight={700}
				anchor="middle"
			/>
			<Txt
				x={bx(r.period) + bw * 0.32}
				y={Y0 + 20}
				text={String(r.period + 1)}
				size={12}
				anchor="middle"
				muted
			/>
			<Readout id="hr-{r.period}">
				<Txt
					x={bx(r.period) + bw * 0.32}
					y={Y0 + 50}
					text={mult(r.hashrate)}
					size={12}
					anchor="middle"
				/>
				<Txt
					x={bx(r.period) + bw * 0.32}
					y={Y0 + 76}
					text={mult(r.difficulty)}
					size={12}
					anchor="middle"
					weight={600}
					color={Math.abs(r.difficulty - (r.period > 0 ? run[r.period - 1].difficulty : 1)) > 0.01
						? 'var(--cb-work)'
						: undefined}
				/>
			</Readout>
		</g>
	{/each}
	<Txt x={X0 - 10} y={Y0 + 20} text="period" size={11} anchor="end" muted />
	<Readout id="rows">
		<Txt x={X0 - 10} y={Y0 + 50} text="hash rate" size={11} anchor="end" muted />
		<Txt x={X0 - 10} y={Y0 + 76} text="difficulty" size={11} anchor="end" muted />
	</Readout>
	<Readout
		id="note"
		order={3}
		label="Result"
		value="back to 10 minutes after {jump === 1
			? 'no change'
			: jump > 4 || jump < 0.25
				? 'two periods'
				: 'one period'}"
	>
		<Txt
			x={24}
			y={Y0 + 116}
			text={jump === 1
				? 'Same hash rate: the difficulty stays put.'
				: jump > 4
					? `The difficulty may change by at most × 4 per period, so it takes two periods to reach ${mult(last.difficulty)}.`
					: `One period later the difficulty has followed the hash rate (${mult(last.difficulty)}) and blocks are 10 minutes apart again.`}
			size={13}
			weight={600}
		/>
	</Readout>
</g>
