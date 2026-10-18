<script lang="ts">
	/**
	 * One Reno sender's packets crossing the bottleneck (../model.ts `pipeRun`), slowed down
	 * SLOW times: each dot is a packet logged by the simulation, drawn where it is at the
	 * simulated time (on the way to the router, waiting in its queue, on the bottleneck link) and
	 * each small dot an acknowledgement on its way back. Dropped packets fall out of the queue.
	 * Below, the congestion window against time.
	 *
	 * Focus (`step.hints.focus`): 'window' (from 12 s, in the sawtooth; the chart shows 0–16 s
	 * with a cursor) or 'start' (from 0 s: slow start, the overshoot and the first halving; the
	 * chart draws itself). Reduced motion freezes a frame at REDUCED_AT of simulated time.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BASE_RTT, LINK_RATE, PIPE, pipeRun, type PacketLog } from '../model';

	let { step, t, reduced }: StageProps = $props();

	const focus = $derived(step.hints?.focus === 'start' ? 'start' : 'window');
	const run = $derived(pipeRun(focus));
	const SLOW = 20;
	const REDUCED_AT = { start: 0.5, window: 8.7 };
	const range = $derived(PIPE[focus]);
	/** Simulated time of the frame, s. */
	const sim = $derived(
		reduced ? REDUCED_AT[focus] : Math.min(range.to, range.from + Math.max(0, t - 0.5) / SLOW)
	);

	// ---- geometry ---------------------------------------------------------------------------
	const Y = 150;
	const YA = 232;
	const SX = 128; // sender's edge
	const QT = 400; // queue tail
	const SLOT = 4;
	const QH = QT + 61 * SLOT; // queue head (packet in service)
	const RX = 832; // receiver's edge
	const ACCESS = BASE_RTT / 4;

	/** Index of the first logged packet sent after time `s`. */
	function firstAfter(ps: PacketLog[], s: number) {
		let lo = 0;
		let hi = ps.length;
		while (lo < hi) {
			const m = (lo + hi) >> 1;
			if (ps[m].sent < s) lo = m + 1;
			else hi = m;
		}
		return lo;
	}

	interface Dot {
		key: string;
		x: number;
		y: number;
		kind: 'data' | 're' | 'ack' | 'drop';
		o: number;
		/** Waiting in the queue (drawn smaller, to fit its slot). */
		q?: boolean;
	}

	const dots = $derived.by(() => {
		const ps = run.packets;
		const out: Dot[] = [];
		const s = sim;
		for (let i = firstAfter(ps, s - 0.8); i < ps.length && ps[i].sent <= s; i++) {
			const p = ps[i];
			const key = `${i}`;
			if (s < p.atQueue) {
				const u = (s - p.sent) / ACCESS;
				out.push({ key, x: SX + u * (QT - SX), y: Y, kind: p.retransmit ? 're' : 'data', o: 1 });
				continue;
			}
			if (p.out < 0) {
				// dropped at the full queue (−1) or lost on the link (−2): falls and fades
				const u = (s - p.atQueue) / 0.06;
				if (u < 1) out.push({ key, x: QT - 6, y: Y + 14 + 40 * u, kind: 'drop', o: 1 - u });
				continue;
			}
			if (s < p.out) {
				// waiting: packets ahead of it = what the link sends before it leaves
				const ahead = Math.max(0, (p.out - s) * LINK_RATE - 1);
				out.push({
					key,
					x: QH - SLOT / 2 - ahead * SLOT,
					y: Y,
					kind: p.retransmit ? 're' : 'data',
					o: 1,
					q: true
				});
				continue;
			}
			if (s < p.recv) {
				const u = (s - p.out) / (p.recv - p.out);
				out.push({
					key,
					x: QH + 8 + u * (RX - QH - 8),
					y: Y,
					kind: p.retransmit ? 're' : 'data',
					o: 1
				});
				continue;
			}
			if (p.acked > 0 && s < p.acked) {
				const u = (s - p.recv) / (p.acked - p.recv);
				out.push({ key, x: RX - u * (RX - SX), y: YA, kind: 'ack', o: 1 });
			}
		}
		return out;
	});

	const sample = $derived(
		run.samples[Math.min(run.samples.length - 1, Math.max(0, Math.round(sim / 0.005)))]
	);
	const cwnd = $derived(sample.cwnd[0]);
	const inFlight = $derived(dots.filter((d) => d.kind === 'data' || d.kind === 're').length);
	const acks = $derived(dots.filter((d) => d.kind === 'ack').length);
	const queued = $derived(sample.queue);
	const lossesSoFar = $derived(run.losses.filter((l) => l.t <= sim));

	// ---- chart --------------------------------------------------------------------------------
	const CX0 = 90;
	const CX1 = 870;
	const chartT = $derived(focus === 'start' ? 1.8 : 14);
	const sx = $derived(scale([0, chartT], [CX0, CX1]));
	const sy = scale([0, 250], [548, 330]);
	const shownSamples = $derived(
		run.samples.filter(
			(d, i) => d.t <= (focus === 'start' ? sim : chartT) && i % (focus === 'start' ? 1 : 10) === 0
		)
	);
	const cPath = $derived(
		linePath(
			shownSamples,
			(d) => d.t,
			(d) => Math.min(250, d.cwnd[0]),
			sx,
			sy
		)
	);
	const fmtS = (s: number) => `${s.toFixed(2)} s`;
</script>

<g>
	<Readout id="title" order={1} label="Simulated time" value="{fmtS(sim)} (slowed down {SLOW}×)">
		<Label
			x={24}
			y={32}
			text="one sender, one bottleneck · t = {fmtS(sim)} (slowed down {SLOW}×)"
			size={14}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<!-- sender, links, router, receiver -->
	<rect
		x={24}
		y={104}
		width={SX - 24}
		height={150}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label x={76} y={96} text="sender" size={13} weight={600} />
	<rect
		x={RX}
		y={104}
		width={936 - RX}
		height={150}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label x={884} y={96} text="receiver" size={13} weight={600} />
	<line
		x1={SX}
		x2={QT - 4}
		y1={Y}
		y2={Y}
		stroke="var(--tcp-link)"
		stroke-width="16"
		stroke-linecap="round"
	/>
	<line
		x1={QH + 6}
		x2={RX}
		y1={Y}
		y2={Y}
		stroke="var(--tcp-link)"
		stroke-width="10"
		stroke-linecap="round"
	/>
	<line
		x1={SX}
		x2={RX}
		y1={YA}
		y2={YA}
		stroke="var(--tcp-link)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<rect
		x={QT - 4}
		y={Y - 16}
		width={QH - QT + 10}
		height={32}
		rx="6"
		fill="none"
		stroke="var(--tcp-queue)"
		stroke-width="1.5"
	/>
	<Label
		x={(QT + QH) / 2}
		y={Y - 26}
		text="router queue: 60 packets"
		size={12}
		color="var(--tcp-queue)"
	/>
	<Readout id="bneck">
		<Label x={(QH + RX) / 2 + 4} y={Y - 14} text="bottleneck 12 Mbit/s" size={11} muted />
	</Readout>
	<Readout id="acks">
		<Label x={(SX + RX) / 2} y={YA + 22} text="acknowledgements" size={11} color="var(--tcp-ack)" />
	</Readout>

	{#each dots as d (d.key)}
		{#if d.kind === 'ack'}
			<circle cx={d.x} cy={d.y} r="2.4" fill="var(--tcp-ack)" />
		{:else if d.kind === 'drop'}
			<g opacity={d.o}>
				<line
					x1={d.x - 4}
					x2={d.x + 4}
					y1={d.y - 4}
					y2={d.y + 4}
					stroke="var(--tcp-drop)"
					stroke-width="2"
				/>
				<line
					x1={d.x - 4}
					x2={d.x + 4}
					y1={d.y + 4}
					y2={d.y - 4}
					stroke="var(--tcp-drop)"
					stroke-width="2"
				/>
			</g>
		{:else if d.kind === 're'}
			<circle
				cx={d.x}
				cy={d.y}
				r={d.q ? 1.9 : 3.2}
				fill="var(--tcp-flow1)"
				stroke="var(--tcp-drop)"
				stroke-width="1.5"
			/>
		{:else}
			<circle cx={d.x} cy={d.y} r={d.q ? 1.9 : 3} fill="var(--tcp-flow1)" />
		{/if}
	{/each}

	<Readout
		id="cwnd"
		order={2}
		label="Congestion window"
		value="{Math.floor(cwnd)} packets"
		color="var(--tcp-flow1)"
	>
		<Label
			x={76}
			y={160}
			text="cwnd {Math.floor(cwnd)}"
			size={14}
			weight={700}
			color="var(--tcp-flow1)"
			tabular
		/>
	</Readout>
	<Readout
		id="flight"
		order={3}
		label="On the way"
		value="{inFlight} packets going, {acks} ACKs returning"
	>
		<Label x={76} y={186} text="{inFlight} packets going" size={11} muted tabular />
		<Label x={76} y={202} text="{acks} ACKs returning" size={11} muted tabular />
	</Readout>
	<Readout
		id="queue"
		order={4}
		label="In the router's queue"
		value="{queued} packets"
		color="var(--tcp-queue)"
	>
		<Label
			x={(QT + QH) / 2}
			y={Y + 34}
			text="{queued} queued"
			size={12}
			color="var(--tcp-queue)"
			tabular
		/>
	</Readout>
	{#if lossesSoFar.length > 0 && focus === 'start'}
		<Readout
			id="loss"
			order={5}
			label="Loss detected"
			value="window halved at {fmtS(lossesSoFar[0].t)}"
		>
			<Label
				x={30}
				y={286}
				text="loss detected: window halved"
				size={12}
				weight={600}
				anchor="start"
				color="var(--tcp-drop)"
				pill
			/>
		</Readout>
	{/if}

	<!-- window against time -->
	<Axes {sx} {sy} xLabel="seconds" yTicks={[0, 60, 121, 250]} />
	<line
		x1={CX0}
		x2={CX1}
		y1={sy(60)}
		y2={sy(60)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
		opacity="0.6"
	/>
	<line
		x1={CX0}
		x2={CX1}
		y1={sy(121)}
		y2={sy(121)}
		stroke="var(--tcp-queue)"
		stroke-dasharray="3 4"
		opacity="0.7"
	/>
	<Readout id="k-pipe">
		<Label x={CX1 - 4} y={sy(60) - 6} text="the path holds 60" size={11} anchor="end" muted />
	</Readout>
	<Readout id="k-full">
		<Label
			x={CX1 - 4}
			y={sy(121) - 6}
			text="path + queue: 121"
			size={11}
			anchor="end"
			color="var(--tcp-queue)"
		/>
	</Readout>
	<Label x={CX0 + 8} y={342} text="congestion window, packets" size={11} anchor="start" muted />
	<path d={cPath} fill="none" stroke="var(--tcp-flow1)" stroke-width="2.2" />
	{#if focus === 'window'}
		<line
			x1={sx(sim)}
			x2={sx(sim)}
			y1={330}
			y2={548}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		<circle cx={sx(sim)} cy={sy(cwnd)} r="4.5" fill="var(--tcp-flow1)" />
	{:else}
		<circle cx={sx(sim)} cy={sy(Math.min(250, cwnd))} r="4.5" fill="var(--tcp-flow1)" />
	{/if}
	{#each lossesSoFar.filter((l) => l.t <= chartT) as l (l.t)}
		<path d="M{sx(l.t)} {sy(250) - 2} l-5 -8 h10 z" fill="var(--tcp-drop)" />
	{/each}
</g>
