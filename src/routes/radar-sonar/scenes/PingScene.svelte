<script lang="ts">
	/**
	 * A pulse out to two targets and the echoes back (../model.ts `echo`, a 1 µs plain pulse).
	 * Above: the range line, with the radar at the left, the outgoing pulse and the returning
	 * echoes, slowed about 50,000 times (100 µs of real time, the round trip to 15 km, in 5 s of
	 * animation, then a second's pause). Below: the range display, echo strength in dB above the
	 * noise against range, swept out at half the pulse's speed as echoes arrive; the previous
	 * sweep stays faintly behind. The targets are draggable. Hint `power` adds the echo
	 * strengths, the 1/R⁴ curve of a 10 m² boat, and target B as a flat plate square on, coated,
	 * or tilted, with the direction its reflection goes. Reduced motion shows a complete sweep
	 * and no pulse in flight.
	 */
	import {
		Axes,
		Handle,
		Label,
		clamp,
		cycle,
		linePath,
		scale,
		smoothstep
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, echo, plateRcs, snrDb } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const power = $derived(step.hints?.power === true);
	const rA = $derived(Number(params.rA ?? 4000));
	const rB = $derived(Number(params.rB ?? 9000));
	const shape = $derived(String(params.shape ?? 'face'));
	const rcsB = $derived(
		!power ? 10 : shape === 'tilt' ? plateRcs(1, 30) : plateRcs(1, 0) * (shape === 'coat' ? 0.1 : 1)
	);

	const RMAX = 15000;
	const TMAX = (2 * RMAX) / C;
	const sx = scale([0, RMAX], [110, 900]);
	const LINE = 170;
	const sy = scale([0, 80], [520, 300]);

	const trace = $derived(
		echo(
			{ kind: 'plain', duration: 1e-6 },
			[
				{ r: rA, rcs: 10 },
				{ r: rB, rcs: rcsB, phase: Math.PI / 2 }
			],
			0,
			RMAX,
			5e6,
			{ seed: 11 }
		)
	);
	const points = $derived(
		Array.from(trace.range, (r, i) => ({ r, y: clamp(trace.out[i], 0, 80) }))
	);
	const full = $derived(
		linePath(
			points,
			(d) => d.r,
			(d) => d.y,
			sx,
			sy
		)
	);

	// the slowed clock: τ real seconds since the pulse left
	const u = $derived(reduced ? 1 : clamp((cycle(t, 6) * 6) / 5));
	const tau = $derived(u * TMAX);
	const sweep = $derived((C * tau) / 2);
	const live = $derived(
		reduced
			? full
			: linePath(
					points.filter((d) => d.r <= sweep),
					(d) => d.r,
					(d) => d.y,
					sx,
					sy
				)
	);
	const out = $derived(C * tau);
	const oOut = $derived(reduced ? 0 : 1 - smoothstep(0.85 * RMAX, RMAX, out));

	/** Where target `r`'s echo is on its way back, if it is. */
	const back = (r: number) => (out > r && out < 2 * r ? 2 * r - out : null);

	const peakOf = (r: number) => {
		let best = 0;
		for (let i = 0; i < trace.range.length; i++)
			if (Math.abs(trace.range[i] - r) < 150 && trace.out[i] > best) best = trace.out[i];
		return best;
	};
	const pA = $derived(peakOf(rA));
	const pB = $derived(peakOf(rB));
	const heard = (r: number) => reduced || sweep >= r;
	const us = (r: number) => ((2 * r) / C) * 1e6;
	const kmText = (r: number) => `${(r / 1000).toFixed(1)} km`;

	const curve = $derived(
		power
			? linePath(
					Array.from({ length: 60 }, (_, i) => 500 + (i * (RMAX - 500)) / 59),
					(r) => r,
					(r) => clamp(snrDb(r, 10, 1e-6), 0, 80),
					sx,
					sy
				)
			: ''
	);

	const step100 = (v: number) => clamp(Math.round(v / 100) * 100, 500, 14500);
	const moveTo = (id: string) => (p: { x: number }) => setParam(id, step100(sx.invert(p.x)));
	const keyFor = (id: string, v: number) => (s: number | 'start' | 'end') =>
		setParam(id, s === 'start' ? 500 : s === 'end' ? 14500 : step100(v + s * 100));

	// labels of the two echoes, lifted apart when the targets are close
	const close = $derived(Math.abs(sx(rA) - sx(rB)) < 170);
	const yLab = (p: number, lift: boolean) =>
		Math.max(290, sy(clamp(p, 0, 80)) - 12) - (lift ? 20 : 0);
	const tilt = $derived(power && shape === 'tilt' ? 30 : 0);
</script>

<g>
	<Readout id="title" order={1} label="Radar" value="a pulse out, the echoes back">
		<Label
			x={24}
			y={34}
			text={power
				? 'the echo weakens as 1/R⁴, and depends on where the target sends it'
				: 'a pulse goes out; the echoes come back; their delay is the range'}
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<!-- the range line and the beam -->
	<path
		d="M{sx(0)} {LINE - 14} L{sx(RMAX)} {LINE - 46} L{sx(RMAX)} {LINE + 46} L{sx(0)} {LINE + 14} Z"
		fill="var(--rs-pulse)"
		opacity="0.06"
	/>
	<line
		x1={sx(0)}
		x2={sx(RMAX)}
		y1={LINE}
		y2={LINE}
		stroke="var(--stage-line)"
		stroke-dasharray="2 4"
	/>
	<!-- the antenna -->
	<path
		d="M60 {LINE - 30} Q92 {LINE} 60 {LINE + 30}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="3"
		stroke-linecap="round"
	/>
	<line x1="76" x2="98" y1={LINE} y2={LINE} stroke="var(--stage-ink)" stroke-width="2" />
	<line x1="60" x2="60" y1={LINE + 30} y2={LINE + 52} stroke="var(--stage-ink)" stroke-width="2" />
	<Label x={62} y={LINE + 70} text="radar" size={12} muted />

	<!-- outgoing pulse -->
	{#if oOut > 0.01 && out < RMAX}
		<path
			d="M{sx(out) - 4} {LINE - 16 - (out / RMAX) * 30} Q{sx(out) + 10} {LINE} {sx(out) - 4} {LINE +
				16 +
				(out / RMAX) * 30}"
			fill="none"
			stroke="var(--rs-pulse)"
			stroke-width="4"
			stroke-linecap="round"
			opacity={oOut}
		/>
	{/if}
	<!-- returning echoes -->
	{#each [{ r: rA, c: 'var(--rs-a)', id: 'a' }, { r: rB, c: 'var(--rs-b)', id: 'b' }] as e (e.id)}
		{@const x = back(e.r)}
		{#if !reduced && x !== null}
			<path
				d="M{sx(x) + 4} {LINE - 12} Q{sx(x) - 8} {LINE} {sx(x) + 4} {LINE + 12}"
				fill="none"
				stroke={e.c}
				stroke-width="3"
				stroke-linecap="round"
				opacity={0.9 * smoothstep(0, 0.05, (out - e.r) / e.r)}
			/>
		{/if}
	{/each}

	<!-- targets -->
	{#each [{ r: rA, c: 'var(--rs-a)', id: 'A', plate: false }, { r: rB, c: 'var(--rs-b)', id: 'B', plate: power }] as tg (tg.id)}
		{@const x = sx(tg.r)}
		{#if tg.plate}
			<g transform="rotate({-tilt} {x} {LINE})">
				<rect
					x={x - 3}
					y={LINE - 22}
					width={shape === 'coat' ? 8 : 6}
					height="44"
					rx="1.5"
					fill={tg.c}
					stroke={shape === 'coat' ? 'var(--stage-ink)' : 'none'}
					stroke-width="1.5"
				/>
			</g>
			<!-- where the reflection goes -->
			{@const ang = tilt === 0 ? 180 : 180 - 2 * tilt}
			{@const len = shape === 'coat' ? 40 : tilt ? 46 : 64}
			<line
				x1={x - 6}
				y1={LINE}
				x2={x - 6 + len * Math.cos((ang * Math.PI) / 180)}
				y2={LINE - len * Math.sin((ang * Math.PI) / 180)}
				stroke={tg.c}
				stroke-width={shape === 'coat' ? 1.5 : 2.5}
				marker-end="url(#arrowhead)"
				opacity="0.8"
			/>
		{:else}
			<path
				d="M{x - 16} {LINE - 4} L{x + 16} {LINE - 4} L{x + 10} {LINE + 6} L{x - 10} {LINE +
					6} Z M{x - 2} {LINE - 4} L{x - 2} {LINE - 16} L{x + 7} {LINE - 8} Z"
				fill={tg.c}
			/>
		{/if}
		<Readout
			id="t{tg.id}"
			order={tg.id === 'A' ? 3 : 4}
			label="Target {tg.id}"
			value="{kmText(tg.r)}: echo after {us(tg.r).toFixed(1)} µs"
			color={tg.c}
		>
			<Label
				{x}
				y={LINE - 56 - (tg.id === 'B' && close ? 18 : 0)}
				text="{tg.id}: {kmText(tg.r)}"
				size={13}
				weight={600}
				color={tg.c}
			/>
		</Readout>
		<Handle
			{x}
			y={LINE + 30}
			r={7}
			color={tg.c}
			label="Target {tg.id}’s range"
			value={tg.r}
			min={500}
			max={14500}
			valuetext={kmText(tg.r)}
			onmove={moveTo(tg.id === 'A' ? 'rA' : 'rB')}
			onkey={keyFor(tg.id === 'A' ? 'rA' : 'rB', tg.r)}
		/>
	{/each}

	<!-- the range display -->
	<Axes
		{sx}
		{sy}
		xTicks={[0, 2500, 5000, 7500, 10000, 12500, 15000]}
		xFormat={(v) => `${v / 1000}`}
		yTicks={[0, 20, 40, 60, 80]}
		xLabel="range (km)"
		yLabel="echo (dB above noise)"
	/>
	{#if power}
		<path
			d={curve}
			fill="none"
			stroke="var(--rs-a)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity="0.7"
		/>
		<Readout id="law">
			<Label
				x={sx(12500)}
				y={sy(clamp(snrDb(12500, 10, 1e-6), 0, 80)) + 18}
				text="a 10 m² boat: −12 dB each time the range doubles"
				size={11}
				muted
				color="var(--rs-a)"
			/>
		</Readout>
	{/if}
	<path d={full} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1" opacity="0.35" />
	<path d={live} fill="none" stroke="var(--stage-ink)" stroke-width="1.5" />
	{#if !reduced && u < 1}
		<line
			x1={sx(sweep)}
			x2={sx(sweep)}
			y1={sy(0)}
			y2={sy(80)}
			stroke="var(--rs-pulse)"
			stroke-width="1.5"
			opacity="0.7"
		/>
	{/if}
	{#each [{ r: rA, p: pA, c: 'var(--rs-a)', id: 'A' }, { r: rB, p: pB, c: 'var(--rs-b)', id: 'B' }] as e (e.id)}
		<g opacity={heard(e.r) ? 1 : 0.25}>
			<Readout
				id="e{e.id}"
				order={e.id === 'A' ? 5 : 6}
				label="Echo {e.id}"
				value="{Math.round(e.p)} dB"
				color={e.c}
			>
				<Label
					x={sx(e.r)}
					y={yLab(e.p, e.id === 'B' && close)}
					text={power ? `${e.id} · ${Math.round(e.p)} dB` : `${e.id} · ${us(e.r).toFixed(1)} µs`}
					size={12}
					weight={600}
					color={e.c}
				/>
			</Readout>
		</g>
	{/each}

	<Readout
		id="clock"
		order={2}
		label="Since the pulse left"
		value="{(tau * 1e6).toFixed(1)} µs → {kmText(sweep)}"
	>
		<Label
			x={936}
			y={34}
			text="{(tau * 1e6).toFixed(1)} µs since the pulse left → range {kmText(sweep)} = c × t ÷ 2"
			size={12}
			anchor="end"
			muted
			tabular
		/>
	</Readout>
	{#if power}
		<Readout
			id="plate"
			order={7}
			label="Plate B's cross-section"
			value="{Math.round(rcsB).toLocaleString('en-US')} m²"
		>
			<Label
				x={936}
				y={58}
				text="plate B: σ ≈ {rcsB >= 10
					? Math.round(rcsB).toLocaleString('en-US')
					: rcsB.toFixed(1)} m² · boat A: 10 m²"
				size={12}
				anchor="end"
				color="var(--rs-b)"
				tabular
			/>
		</Readout>
	{/if}
</g>
