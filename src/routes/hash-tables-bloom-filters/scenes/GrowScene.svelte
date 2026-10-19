<script lang="ts">
	/**
	 * 200 words arrive, eight a second, in a table that starts with 8 slots and doubles, rehashing
	 * every word, whenever the next word would push the load factor past the slider's maximum.
	 * Top: the table as it stands (filled slots; a word moved from its home slot in orange, or
	 * chain heights for chaining), with a callout for a little over a second after each rehash.
	 * Charts: the load factor against words inserted, a sawtooth under the maximum, and the mean
	 * probes of a successful search in the table as it stands against the expected value for its
	 * size. Reduced motion shows all 200 words in.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { INSERTABLE, buildTable, expectedProbes, growRun, type Scheme } from '../model';
	import { C, group, memo } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const N = 200;
	const RATE = 8;
	const scheme: Scheme = $derived(params.growScheme === 'chaining' ? 'chaining' : 'linear');
	const maxLoad = $derived(clamp(Number(params.maxLoad) || 0.75, 0.5, 0.95));
	const KEYS = INSERTABLE.slice(0, N);
	const runOf = memo((key: string) => {
		const [s, l] = key.split('|');
		return growRun(s as Scheme, KEYS, Number(l), 8);
	}, 12);
	const run = $derived(runOf(`${scheme}|${maxLoad}`));
	const n = $derived(reduced ? N : clamp(Math.floor(t * RATE), 0, N));
	const now = $derived(n > 0 ? run.points[n - 1] : { n: 0, m: 8, hit: 0, moved: 0 });
	const m = $derived(now.m);
	const table = $derived(buildTable(scheme, KEYS.slice(0, n), m));
	/** The latest rehash, if it happened within the last 1.25 s of animation. */
	const recent = $derived.by(() => {
		const r = [...run.resizes].reverse().find((at) => at <= n);
		if (r === undefined || reduced || n - r > RATE * 1.25) return null;
		return { at: r, m: run.points[r - 1].m, moved: r - 1 };
	});
	const resizesSoFar = $derived(run.resizes.filter((at) => at <= n).length);
	const biggest = $derived(
		run.resizes.filter((at) => at <= n).reduce((a, at) => Math.max(a, at - 1), 0)
	);

	// ---- the strip -----------------------------------------------------------------------
	const X0 = 40;
	const W = 880;
	const SY = 112;
	const SH = 30;
	const pitch = $derived(W / m);
	const gap = $derived(pitch > 6 ? 1.5 : pitch > 3 ? 0.6 : 0);
	/** Filled slots as one path per colour (thousands of rects would be too many nodes). */
	const strip = $derived.by(() => {
		let own = '';
		let moved = '';
		let chains = '';
		for (let s = 0; s < m; s++) {
			const x = (X0 + s * pitch).toFixed(2);
			const w = Math.max(0.6, pitch - gap).toFixed(2);
			if (scheme === 'linear') {
				const ki = table.slots[s];
				if (ki < 0) continue;
				const r = `M${x} ${SY}h${w}v${SH}h-${w}Z`;
				if (table.home[ki] === s) own += r;
				else moved += r;
			} else {
				const len = table.chains[s].length;
				if (!len) continue;
				const hgt = Math.min(SH + 30, len * 9);
				chains += `M${x} ${SY + SH}h${w}v-${hgt}h-${w}Z`;
			}
		}
		return { own, moved, chains };
	});

	// ---- charts --------------------------------------------------------------------------
	const A = { x0: 96, x1: 560, y0: 222, y1: 330 };
	const P = { x0: 96, x1: 560, y0: 392, y1: 548 };
	const sxN = scale([0, N], [A.x0, A.x1]);
	const syA = scale([0, 1], [A.y1, A.y0]);
	const pMax = $derived(scheme === 'linear' ? 6 : 2);
	const syP = $derived(scale([0, pMax], [P.y1, P.y0]));
	const shown = $derived(run.points.slice(0, n));
	/** The load factor just before and after each insertion, so the drops are vertical. */
	const alphaLine = $derived(
		linePath(
			shown,
			(p) => p.n,
			(p) => p.n / p.m,
			sxN,
			syA
		)
	);
	const hitLine = $derived(
		linePath(
			shown,
			(p) => p.n,
			(p) => Math.min(pMax, p.hit),
			sxN,
			syP
		)
	);
	const expLine = $derived(
		linePath(
			shown,
			(p) => p.n,
			(p) => Math.min(pMax, expectedProbes(scheme, p.m, p.n).hit),
			sxN,
			syP
		)
	);
	const f2 = (x: number) => x.toFixed(2);
</script>

<g>
	<Readout
		id="gr-title"
		order={1}
		label="Table"
		value="{group(n)} words in {group(m)} slots, α = {f2(n / m)}"
	>
		<Label
			x={40}
			y={44}
			anchor="start"
			text="{scheme === 'linear' ? 'linear probing' : 'chaining'}: {n} words in {m} slots, α = {f2(
				n / m
			)}"
			size={15}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="gr-rule">
		<Label
			x={40}
			y={66}
			anchor="start"
			text="starts with 8 slots; doubles and rehashes when α would pass {f2(maxLoad)}"
			size={12}
			muted
		/>
	</Readout>

	<!-- the table -->
	<rect
		x={X0 - 3}
		y={SY - 3}
		width={W + 6}
		height={SH + 6}
		rx="4"
		fill={C.slot}
		stroke={C.slotEdge}
	/>
	{#if scheme === 'linear'}
		<path d={strip.own} fill={C.key} />
		<path d={strip.moved} fill={C.moved} />
	{:else}
		<path d={strip.chains} fill={C.key} />
	{/if}
	{#if recent}
		<Readout
			id="gr-flash"
			order={2}
			label="Rehash"
			value="doubled to {recent.m} slots, {recent.moved} words reinserted"
		>
			<rect
				x={X0 - 6}
				y={SY - 6}
				width={W + 12}
				height={SH + 12}
				rx="6"
				fill="none"
				stroke={C.probe}
				stroke-width="2.5"
			/>
			<Label
				x={480}
				y={SY + SH + 26}
				text="full: doubled to {recent.m} slots and rehashed all {recent.moved} words"
				size={13}
				weight={700}
				color={C.probeText}
			/>
		</Readout>
	{/if}

	<!-- load factor -->
	<Label x={A.x0 - 56} y={A.y0 - 18} anchor="start" text="load factor α" size={13} weight={700} />
	<Axes sx={sxN} sy={syA} yTicks={[0, 0.5, 1]} xTicks={[0, 50, 100, 150, 200]} />
	<line
		x1={A.x0}
		x2={A.x1}
		y1={syA(maxLoad)}
		y2={syA(maxLoad)}
		stroke={C.miss}
		stroke-width="1.2"
		stroke-dasharray="5 4"
	/>
	<Label
		x={A.x1 - 4}
		y={syA(maxLoad) - 6}
		anchor="end"
		text="maximum {f2(maxLoad)}"
		size={11}
		color={C.missText}
	/>
	<path d={alphaLine} fill="none" stroke={C.probe} stroke-width="2.2" stroke-linejoin="round" />

	<!-- probes -->
	<Label
		x={P.x0 - 56}
		y={P.y0 - 18}
		anchor="start"
		text="mean probes to find a word"
		size={13}
		weight={700}
	/>
	<Axes sx={sxN} sy={syP} xLabel="words inserted" xTicks={[0, 50, 100, 150, 200]} />
	<path d={expLine} fill="none" stroke={C.hit} stroke-width="1.3" opacity="0.7" />
	<path d={hitLine} fill="none" stroke={C.hit} stroke-width="3" stroke-linejoin="round" />
	{#if n > 0}
		<circle
			cx={sxN(n)}
			cy={syP(Math.min(pMax, now.hit))}
			r="5"
			fill={C.hit}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- readouts -->
	<Readout
		id="gr-hit"
		order={3}
		label="Mean probes, found"
		value="{f2(now.hit)} (expected {f2(expectedProbes(scheme, m, Math.max(1, n)).hit)})"
		color={C.hit}
	>
		<Label
			x={610}
			y={248}
			anchor="start"
			text="found in {f2(now.hit)} probes"
			size={15}
			weight={700}
			color={C.hitText}
			tabular
		/>
		<Label
			x={610}
			y={268}
			anchor="start"
			text="expected {f2(expectedProbes(scheme, m, Math.max(1, n)).hit)} at this size"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout
		id="gr-moves"
		order={4}
		label="Rehashing so far"
		value="{resizesSoFar} doublings, {group(now.moved)} words reinserted"
	>
		<Label
			x={610}
			y={318}
			anchor="start"
			text="{resizesSoFar} doublings so far"
			size={13}
			weight={600}
			tabular
		/>
		<Label
			x={610}
			y={338}
			anchor="start"
			text="{group(now.moved)} words reinserted in all, {n
				? f2(now.moved / n)
				: '0.00'} per word inserted"
			size={12}
			muted
			tabular
		/>
		<Label
			x={610}
			y={358}
			anchor="start"
			text="the biggest rehash: {biggest} words at once"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout id="gr-legend">
		<line x1="610" x2="636" y1="420" y2="420" stroke={C.hit} stroke-width="3" />
		<Label x={644} y={424} anchor="start" text="this table, as it stands" size={11} muted />
		<line x1="610" x2="636" y1="440" y2="440" stroke={C.hit} stroke-width="1.3" opacity="0.7" />
		<Label x={644} y={444} anchor="start" text="expected for its size (Knuth)" size={11} muted />
		{#if scheme === 'linear'}
			<rect x="610" y="458" width="11" height="11" rx="2" fill={C.key} />
			<Label x={628} y={468} anchor="start" text="at its own slot" size={11} muted />
			<rect x="610" y="478" width="11" height="11" rx="2" fill={C.moved} />
			<Label x={628} y={488} anchor="start" text="moved along" size={11} muted />
		{:else}
			<rect x="610" y="458" width="11" height="11" rx="2" fill={C.key} />
			<Label x={628} y={468} anchor="start" text="bar height: the slot’s chain" size={11} muted />
		{/if}
	</Readout>
</g>
