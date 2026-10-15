<script lang="ts">
	/**
	 * Symbols through white Gaussian noise.
	 *
	 * Left: the constellation with the received symbols arriving as a cloud
	 * (`SHOW_MAX` of them, simulated by the model; wrongly decided ones in red).
	 * They arrive at ARRIVE per second of animation time on top of a first batch,
	 * so the cloud is a pure function of t; reduced motion shows all of them.
	 *
	 * Right, by `step.hints.phase`:
	 * - `noise`: the bits of the latest symbols, sent and as read, wrong ones red.
	 * - `ber`, `qam`: the bit-error rate against the SNR, the theory curve for the
	 *   scheme and dots measured by the simulation (200,000 bits per dot); the
	 *   current SNR as a dashed line with its own measurement.
	 * - `tradeoff`: the theory curves of all five schemes, the current one bold.
	 *
	 * The scheme is `step.hints.scheme` when given, else `params.scheme`.
	 * `params.resend` changes the noise seed.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		SCHEMES,
		berTheory,
		decide,
		measureBer,
		schemeBits,
		schemeName,
		snrForBer,
		transmit,
		type Scheme
	} from '../radio';
	import { count, num, rate, sup } from '../format';
	import Constellation from './Constellation.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const SHOW_MAX = 1200;
	const FIRST = 120;
	const ARRIVE = 160;
	const MEASURE_BITS = 200_000;

	const phase = $derived(String(step.hints?.phase ?? 'noise'));
	const scheme = $derived(String(step.hints?.scheme ?? params.scheme ?? 'qam16') as Scheme);
	const snr = $derived(Number(params.snr ?? 10));
	const seed = $derived(1 + Number(params.resend ?? 0) * 7919);

	const tx = $derived(transmit(scheme, snr, SHOW_MAX, seed));
	const shown = $derived(reduced ? SHOW_MAX : Math.min(SHOW_MAX, FIRST + Math.floor(t * ARRIVE)));
	const here = $derived.by(() => {
		let wrong = 0;
		for (let s = 0; s < shown; s++) wrong += tx.wrong[s];
		return wrong;
	});
	const now = $derived(measureBer(scheme, snr, MEASURE_BITS, seed + 17));

	// ---- measured dots along the curve (cached per scheme) -----------------------------------
	const SWEEP = Array.from({ length: 21 }, (_, i) => -4 + i * 2);
	/** Not reactive state: a cache filled once per scheme. */
	const sweepCache: Partial<Record<Scheme, { db: number; ber: number; errors: number }[]>> = {};
	function sweep(s: Scheme) {
		let v = sweepCache[s];
		if (!v) {
			v = SWEEP.map((db, i) => {
				const m = measureBer(s, db, MEASURE_BITS, 101 + i);
				return { db, ber: m.ber, errors: m.errors };
			});
			sweepCache[s] = v;
		}
		return v;
	}
	const dots = $derived(phase === 'noise' ? [] : sweep(scheme).filter((d) => d.errors > 0));

	// ---- plot ------------------------------------------------------------------------------
	const sx = scale([-5, 35], [560, 920]);
	const sy = scale([-6, 0], [500, 110]);
	const yOf = (ber: number) => sy(Math.max(-6, Math.log10(Math.max(ber, 1e-7))));
	const curve = (s: Scheme) => {
		let d = '';
		let started = false;
		for (let db = -5; db <= 35.001; db += 0.25) {
			const b = berTheory(s, db);
			if (b < 1e-6) {
				if (started) d += `L${sx(db).toFixed(1)} ${sy(-6).toFixed(1)}`;
				break;
			}
			d += `${started ? 'L' : 'M'}${sx(db).toFixed(1)} ${yOf(b).toFixed(1)}`;
			started = true;
		}
		return d;
	};
	const curves = Object.fromEntries(SCHEMES.map((s) => [s, curve(s)])) as Record<Scheme, string>;
	const schemeColor: Record<Scheme, string> = {
		bpsk: 'var(--ws-s0)',
		qpsk: 'var(--ws-s1)',
		qam16: 'var(--ws-s2)',
		qam64: 'var(--ws-s3)',
		qam256: 'var(--ws-s4)'
	};
	/** Where each curve's name goes: beside the curve where it crosses 10⁻⁵. */
	const curveLabel = (s: Scheme) => ({
		x: sx(snrForBer(s, 1e-5)) + (s === 'bpsk' ? -6 : 6),
		y: sy(-5) - 6,
		anchor: s === 'bpsk' ? ('end' as const) : ('start' as const)
	});
	const exp = (e: number) => (e === 0 ? '1' : `10${sup(e)}`);

	// ---- bit strip (noise phase) ---------------------------------------------------------------
	const STRIP = 12;
	const strip = $derived.by(() => {
		const n = Math.min(shown, tx.n);
		const out: { s: number; sent: string; got: string }[] = [];
		for (let s = Math.max(0, n - STRIP); s < n; s++) {
			out.push({
				s,
				sent: decide(scheme, tx.sent[2 * s], tx.sent[2 * s + 1]),
				got: decide(scheme, tx.received[2 * s], tx.received[2 * s + 1])
			});
		}
		return out;
	});

	const theoryNow = $derived(berTheory(scheme, snr));
	const title = $derived(`${schemeName[scheme]} at ${num(snr)} dB SNR`);
	const nowText = $derived(
		now.errors === 0
			? `0 errors in ${count(now.bits)} bits`
			: `${count(now.errors)} wrong of ${count(now.bits)} bits: ${rate(now.ber)}`
	);
</script>

<g>
	<Readout id="title" order={0} label="Received" value={title}>
		<Label anchor="start" x={30} y={44} text="Received symbols: {title}" size={15} weight={700} />
	</Readout>
	<Constellation {scheme} {tx} {shown} cx={256} cy={316} half={226} uid="channel" />
	<Readout
		id="shown"
		order={1}
		label="In the cloud"
		value="{count(here)} of {count(shown)} symbols misread"
		color="var(--ws-bad)"
	>
		<Label
			anchor="start"
			x={30}
			y={568}
			text="{count(shown)} symbols · {count(here)} misread (red)"
			size={13}
			weight={600}
		/>
	</Readout>

	{#if phase === 'noise'}
		<!-- the latest symbols, bit by bit -->
		<Readout id="strip-title">
			<Label anchor="start" x={560} y={92} text="The latest symbols" size={14} weight={700} />
			<Label anchor="start" x={560} y={134} text="sent" size={12} muted />
			<Label anchor="start" x={660} y={134} text="read as" size={12} muted />
		</Readout>
		{#each strip as row, r (row.s)}
			{@const y = 160 + r * 26}
			{@const bad = row.sent !== row.got}
			<Readout id="strip-{r}">
				{#if bad}
					<rect
						x={652}
						y={y - 16}
						width="72"
						height="22"
						rx="4"
						fill="var(--ws-bad)"
						opacity="0.15"
					/>
				{/if}
				<Label anchor="start" x={560} {y} text={row.sent} size={15} weight={700} />
				<Label
					anchor="start"
					x={660}
					{y}
					text={row.got}
					size={15}
					weight={700}
					color={bad ? 'var(--ws-bad)' : undefined}
				/>
				{#if bad}
					<Label
						anchor="start"
						x={740}
						{y}
						text="misread"
						size={12}
						color="var(--ws-bad)"
						weight={600}
					/>
				{/if}
			</Readout>
		{/each}
		<Readout id="count-text">
			<Label
				anchor="start"
				x={560}
				y={500}
				text="Each symbol carries {schemeBits[scheme]} bits."
				size={13}
			/>
			<Label
				anchor="start"
				x={560}
				y={524}
				text="Noise pushed {count(here)} of the {count(shown)} symbols"
				size={13}
				weight={600}
			/>
			<Label
				anchor="start"
				x={560}
				y={546}
				text="across a dashed line into a neighbour’s square."
				size={13}
				weight={600}
			/>
		</Readout>
	{:else}
		<!-- bit-error rate against SNR -->
		<Readout id="plot-title">
			<Label anchor="start" x={560} y={78} text="Bit-error rate" size={14} weight={700} />
			<Label
				x={920}
				y={78}
				text={phase === 'tradeoff'
					? 'curves: theory · dots: simulated'
					: 'curve: theory · dots: simulated'}
				size={12}
				muted
				anchor="end"
			/>
		</Readout>
		<Axes
			{sx}
			{sy}
			xTicks={[-5, 0, 5, 10, 15, 20, 25, 30, 35]}
			yTicks={[-6, -5, -4, -3, -2, -1, 0]}
			xFormat={(v: number) => num(v, 0)}
			yFormat={(v: number) => exp(v)}
			xLabel="SNR (dB)"
		/>
		{#if phase === 'tradeoff'}
			{#each SCHEMES as s (s)}
				{@const lab = curveLabel(s)}
				<path
					d={curves[s]}
					fill="none"
					stroke={schemeColor[s]}
					stroke-width={s === scheme ? 3 : 1.6}
					opacity={s === scheme ? 1 : 0.75}
				/>
				<Readout
					id="lab-{s}"
					order={10 + SCHEMES.indexOf(s)}
					label={schemeName[s]}
					color={schemeColor[s]}
				>
					<Label
						x={lab.x}
						y={lab.y}
						text={schemeName[s]}
						size={11}
						weight={s === scheme ? 700 : 500}
						anchor={lab.anchor}
						color={schemeColor[s]}
					/>
				</Readout>
			{/each}
		{:else}
			<path d={curves[scheme]} fill="none" stroke="var(--ws-theory)" stroke-width="2.2" />
		{/if}
		{#each dots as d (d.db)}
			<circle
				cx={sx(d.db)}
				cy={yOf(d.ber)}
				r="4"
				fill={phase === 'tradeoff' ? schemeColor[scheme] : 'var(--ws-cloud)'}
				stroke="var(--stage-bg)"
			/>
		{/each}
		<line
			x1={sx(snr)}
			x2={sx(snr)}
			y1={sy(0)}
			y2={sy(-6)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		{#if now.errors > 0}
			<circle
				cx={sx(snr)}
				cy={yOf(now.ber)}
				r="7"
				fill="var(--ws-bad)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{:else}
			<path
				d="M{sx(snr) - 6} {sy(-6) - 16}l6 10l6 -10"
				fill="none"
				stroke="var(--ws-bad)"
				stroke-width="2"
			/>
		{/if}
		<Readout
			id="now"
			order={2}
			label="Measured at {num(snr)} dB"
			value={nowText}
			color="var(--ws-bad)"
		>
			<Label
				anchor="start"
				x={560}
				y={562}
				text="At {num(snr)} dB: {nowText}"
				size={13}
				weight={700}
			/>
		</Readout>
		<Readout id="theory" order={3} label="Theory" value={rate(theoryNow)}>
			<Label
				anchor="start"
				x={560}
				y={582}
				text="theory: {theoryNow < 1e-9 ? 'below 10⁻⁹' : rate(theoryNow)}"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
