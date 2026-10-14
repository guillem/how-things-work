<script lang="ts">
	/**
	 * One burst of CO₂ on top of today's air: the share still in the air after
	 * 1 to 1,000 years (logarithmic axis), against the Joos et al. (2013)
	 * multi-model mean for a 100 GtC pulse, and a bar of where the burst is at
	 * the cursor (air, ocean, plants and soils).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, linePath, scale, smoothstep, type Scale } from '#lib/draw/index.ts';
	import { pulseShares } from '../carbon';

	let { params, t, reduced }: StageProps = $props();
	const size = $derived(Number(params.pulse ?? 100));
	const shares = $derived(pulseShares(size, 1000));

	const L = 96;
	const R = 680;
	const lx = scale([0, 3], [L, R]);
	const sx: Scale = (() => {
		const f = ((y: number) => lx(Math.log10(Math.max(1, y)))) as Scale;
		f.domain = [1, 1000];
		f.range = [L, R];
		f.invert = (px: number) => 10 ** lx.invert(px);
		return f;
	})();
	const sy = scale([0, 1], [540, 90]);

	const joos = (y: number) =>
		0.2173 +
		0.224 * Math.exp(-y / 394.4) +
		0.2824 * Math.exp(-y / 36.54) +
		0.2763 * Math.exp(-y / 4.304);
	const years = Array.from({ length: 121 }, (_, i) => 10 ** (i / 40));
	const joosPath = linePath(years, (y) => y, joos, sx, sy);

	// The cursor sweeps 1 → 1,000 years (evenly in log time) over 14 s, then stays.
	const u = $derived(reduced ? 1 : smoothstep(0.3, 14, t));
	const cursor = $derived(10 ** (3 * u));
	const share = (y: number) => {
		const i = Math.floor(y);
		const a = shares[Math.min(i, 1000)];
		const b = shares[Math.min(i + 1, 1000)];
		const f = y - i;
		return {
			air: a.air + (b.air - a.air) * f,
			ocean: a.ocean + (b.ocean - a.ocean) * f,
			land: a.land + (b.land - a.land) * f
		};
	};
	const curve = $derived(
		linePath(
			years.filter((y) => y <= cursor),
			(y) => y,
			(y) => share(y).air,
			sx,
			sy
		)
	);
	const now = $derived(share(cursor));
	const marks = [20, 100, 1000];
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const yearText = $derived(cursor < 10 ? cursor.toFixed(1) : String(Math.round(cursor)));

	// bar of where the burst is
	const BX = 770;
	const BW = 70;
	const by = scale([0, 1], [540, 90]);
</script>

<g>
	<Label
		x={L - 4}
		y={50}
		text="Share of a {size} GtC burst still in the air"
		anchor="start"
		size={15}
		weight={700}
	/>
	<Axes
		{sx}
		{sy}
		xTicks={[1, 10, 100, 1000]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
		yFormat={pct}
		xFormat={(v: number) => (v === 1 ? '1 year' : v.toLocaleString('en-US'))}
	/>
	<Label
		x={(L + R) / 2}
		y={578}
		text="years after the release (each mark ten times the last)"
		size={12}
		muted
	/>

	<!-- a molecule's stay -->
	<line
		x1={sx(4)}
		x2={sx(4)}
		y1={90}
		y2={540}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 4"
	/>
	<Readout id="molecule" order={3} label="One molecule's stay in the air" value="about 4 years">
		<Label
			x={sx(4) + 6}
			y={110}
			text="one molecule's stay: ~4 years"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<path
		d={joosPath}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
		stroke-dasharray="6 4"
	/>
	<Readout id="joos">
		<Label
			x={sx(150)}
			y={sy(0.1)}
			text="dashed line: average of 15 research models (Joos et al. 2013)"
			size={11}
			muted
		/>
	</Readout>
	<path d={curve} fill="none" stroke="var(--cc-air)" stroke-width="3.2" />
	{#each marks as m (m)}
		{@const v = share(m).air}
		{@const on = cursor >= m ? 1 : 0}
		<g opacity={on}>
			<circle cx={sx(m)} cy={sy(v)} r="5" fill="var(--cc-air)" />
			<Readout
				id="mark-{m}"
				order={m === 20 ? 0 : m === 100 ? 1 : 2}
				label="After {m.toLocaleString('en-US')} years"
				value="{pct(v)} still in the air"
				color="var(--cc-air)"
				opacity={on}
			>
				<Label
					x={sx(m) + (m === 1000 ? -8 : 8)}
					y={sy(v) - 12}
					text="{pct(v)} after {m.toLocaleString('en-US')} yr"
					anchor={m === 1000 ? 'end' : 'start'}
					size={12}
					weight={700}
					color="var(--cc-air)"
					pill
				/>
			</Readout>
		</g>
	{/each}
	<line
		x1={sx(cursor)}
		x2={sx(cursor)}
		y1={90}
		y2={540}
		stroke="var(--cc-air)"
		stroke-opacity="0.35"
	/>

	<!-- where the burst is -->
	<Label x={BX + BW / 2} y={50} text="where it is" size={13} weight={700} />
	<Label x={BX + BW / 2} y={70} text="after {yearText} years" size={12} muted />
	<rect
		x={BX}
		y={by(now.air)}
		width={BW}
		height={by(0) - by(now.air)}
		fill="var(--cc-air-fill)"
		stroke="var(--cc-air)"
	/>
	<rect
		x={BX}
		y={by(now.air + now.ocean)}
		width={BW}
		height={by(now.air) - by(now.air + now.ocean)}
		fill="var(--cc-surface-fill)"
		stroke="var(--cc-ocean)"
	/>
	<rect
		x={BX}
		y={by(1)}
		width={BW}
		height={by(now.air + now.ocean) - by(1)}
		fill="var(--cc-plants-fill)"
		stroke="var(--cc-plants)"
	/>
	<Readout
		id="where"
		order={4}
		label="Where the burst is after {yearText} years"
		value="air {pct(now.air)} · ocean {pct(now.ocean)} · plants & soils {pct(now.land)}"
	>
		<Label
			x={BX + BW + 8}
			y={(by(0) + by(now.air)) / 2 + 4}
			text="air {pct(now.air)}"
			anchor="start"
			size={12}
			weight={600}
			color="var(--cc-air)"
		/>
		{#if now.ocean > 0.06}
			<Label
				x={BX + BW + 8}
				y={(by(now.air) + by(now.air + now.ocean)) / 2 + 4}
				text="ocean {pct(now.ocean)}"
				anchor="start"
				size={12}
				weight={600}
				color="var(--cc-ocean)"
			/>
		{/if}
		{#if now.land > 0.06}
			<Label
				x={BX + BW + 8}
				y={(by(now.air + now.ocean) + by(1)) / 2 + 4}
				text="plants {pct(now.land)}"
				anchor="start"
				size={12}
				weight={600}
				color="var(--cc-plants)"
			/>
		{/if}
	</Readout>
</g>
