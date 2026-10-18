<script lang="ts">
	/**
	 * Two users on the page's bottleneck (../model.ts `sharing`): user A with one connection over
	 * a 60 ms path, user B joining at 5 s with `n2` connections over a path of `rtt2` ms. Top: the
	 * rates of every connection, stacked, averaged over a second. Bottom: the shares over the
	 * last 20 s, per connection and per user. Drawn SPEED times faster than real time.
	 */
	import { Axes, Label, areaPath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BASE_RTT, mbps, meanRate, sharing } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const rtt2 = $derived(Number(params.rtt2 ?? 60));
	const n2 = $derived(Math.round(Number(params.n2 ?? 1)));
	const JOIN = 5;
	const T = 80;
	const SPEED = 3;
	const run = $derived(sharing({ rtt2: rtt2 / 1000, n2, join: JOIN, until: T }));
	const now = $derived(reduced ? T : Math.min(T, t * SPEED));
	const nf = $derived(1 + n2);

	const sx = scale([0, T], [90, 820]);
	const sy = scale([0, 12], [330, 90]);
	/** Cumulative rates (Mbit/s), averaged over the last second. */
	const stacks = $derived(
		run.samples.map((d, i, a) => {
			const w = a.slice(Math.max(0, i - 19), i + 1);
			const cum = [0];
			for (let f = 0; f < d.rate.length; f++)
				cum.push(cum[f] + mbps(w.reduce((x, y) => x + y.rate[f], 0) / w.length));
			return { t: d.t, cum };
		})
	);
	const shown = $derived(
		thin(
			stacks.filter((d) => d.t <= now),
			300
		)
	);
	const bands = $derived(
		Array.from({ length: nf }, (_, f) =>
			areaPath(
				shown,
				(d) => d.t,
				(d) => d.cum[f],
				(d) => d.cum[f + 1],
				sx,
				sy
			)
		)
	);
	const recent = $derived(
		now <= JOIN + 2 ? null : meanRate(run, Math.max(JOIN + 1, now - 20), now)
	);
	const total = $derived(recent ? recent.reduce((a, b) => a + b, 0) : 1);
	const shareA = $derived(recent ? recent[0] / total : 1);
	const color = (f: number) => (f === 0 ? 'var(--tcp-flow1)' : 'var(--tcp-flow2)');
	const BX0 = 90;
	const BX1 = 820;
	const pct = (v: number) => `${Math.round(v * 100)} %`;
</script>

<g>
	<Readout id="title" order={1} label="Two users" value="t = {now.toFixed(0)} s">
		<Label
			x={24}
			y={30}
			text="user A: 1 connection, {BASE_RTT * 1000} ms · user B: {n2} connection{n2 > 1
				? 's'
				: ''}, {rtt2} ms, from {JOIN} s · t = {now.toFixed(0)} s"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<Axes {sx} {sy} xLabel="seconds" yTicks={[0, 6, 12]} />
	<Label
		x={90}
		y={78}
		text="rates of all connections, stacked, Mbit/s"
		size={11}
		anchor="start"
		muted
	/>
	{#each bands as d, f (f)}
		<path
			{d}
			fill={color(f)}
			opacity={f === 0 ? 0.75 : 0.45 + 0.12 * (f % 2)}
			stroke="var(--stage-bg)"
			stroke-width="0.8"
		/>
	{/each}

	{#if recent}
		<Label
			x={BX0}
			y={406}
			text="shares over the last 20 s, per connection"
			size={11}
			anchor="start"
			muted
		/>
		{#each recent as r, f (f)}
			{@const x0 = BX0 + ((BX1 - BX0) * recent.slice(0, f).reduce((a, b) => a + b, 0)) / total}
			<rect
				x={x0}
				y={414}
				width={((BX1 - BX0) * r) / total}
				height={22}
				fill={color(f)}
				opacity={f === 0 ? 0.85 : 0.5 + 0.15 * (f % 2)}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
		<Label x={BX0} y={466} text="per user" size={11} anchor="start" muted />
		<rect
			x={BX0}
			y={474}
			width={(BX1 - BX0) * shareA}
			height={22}
			rx="3"
			fill="var(--tcp-flow1)"
			opacity="0.85"
		/>
		<rect
			x={BX0 + (BX1 - BX0) * shareA}
			y={474}
			width={(BX1 - BX0) * (1 - shareA)}
			height={22}
			rx="3"
			fill="var(--tcp-flow2)"
			opacity="0.65"
		/>
		<line
			x1={(BX0 + BX1) / 2}
			x2={(BX0 + BX1) / 2}
			y1={408}
			y2={502}
			stroke="var(--stage-ink)"
			stroke-dasharray="2 3"
		/>
		<Readout id="a" order={2} label="User A" value={pct(shareA)} color="var(--tcp-flow1)">
			<Label
				x={BX0}
				y={524}
				text="share of user A: {pct(shareA)}"
				size={13}
				weight={600}
				anchor="start"
				color="var(--tcp-flow1)"
				tabular
			/>
		</Readout>
		<Readout id="b" order={3} label="User B" value={pct(1 - shareA)} color="var(--tcp-flow2)">
			<Label
				x={BX1}
				y={524}
				text="share of user B: {pct(1 - shareA)}"
				size={13}
				weight={600}
				anchor="end"
				color="var(--tcp-flow2)"
				tabular
			/>
		</Readout>
	{/if}
</g>
