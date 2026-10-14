<script lang="ts">
	/**
	 * Myelin. Top: five internodes of a human nerve fibre of the chosen
	 * diameter, bare or wrapped in myelin, with the front of the impulse (where
	 * sodium channels are opening) moving along it at the measured speed,
	 * slowed down about 36,000 times: on the myelinated fibre it jumps from
	 * node to node, on the bare one it creeps. Bottom: a race over one metre
	 * (spinal cord to toe) between the two, slowed 50 times.
	 *
	 * Speeds from fibres.ts (Hursh 1939 for myelinated fibres; √d scaling from
	 * the squid axon for bare ones). Everything moves as a pure function of t;
	 * the race restarts when a control changes. Under reduced motion the
	 * front is shown on the third node and the race at its end.
	 */
	import { Label, clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { internode, myelinatedSpeed, unmyelinatedSpeed } from '../fibres';
	import { replayClock } from './replay';

	let { t, params, reduced }: StageProps = $props();

	const myelin = $derived(params.myelin === undefined ? true : Boolean(params.myelin));
	const d = $derived(Number(params.fibre ?? 10)); // µm
	const vM = $derived(myelinatedSpeed(d));
	const vU = $derived(unmyelinatedSpeed(d));
	const v = $derived(myelin ? vM : vU);
	const L = $derived(internode(d)); // µm
	const NODES = 5; // internodes in view

	/** Close-up: seconds of animation per second of real time. */
	const SLOW = 36000;
	const since = replayClock();
	const elapsed = $derived(since(`${myelin}|${d}`, t));
	/** Real time in the close-up, µs; loops after the front leaves the view. */
	const viewReal = $derived((NODES * L) / v); // µs to cross the view (µm / (m/s) = µs)
	const loop = $derived((viewReal * SLOW) / 1e6 + 1.2); // s of animation per pass
	const tau = $derived(reduced ? (2.3 * L) / vM : (((elapsed % loop) - 0.4) * 1e6) / SLOW); // µs

	// ---- the close-up -----------------------------------------------------------------
	const X0 = 60;
	const X1 = 900;
	const Y = 200;
	const R = 13; // drawn half-thickness of the axon
	const seg = (X1 - X0) / NODES;
	const nodeX = Array.from({ length: NODES + 1 }, (_, i) => X0 + i * seg);
	/** Where the front is, in internodes from the left (myelinated: stepwise, from node to node). */
	const front = $derived.by(() => {
		if (tau < 0) return -1;
		const pos = (tau * v) / L; // internodes travelled at the average speed
		if (!myelin) return pos;
		// Each node fires in turn; the depolarisation spreads over the internode within a few µs.
		return Math.floor(pos) + smoothstep(0, 0.25, pos % 1);
	});
	const frontX = $derived(X0 + clamp(front, 0, NODES) * seg);
	const nodeGlow = (i: number) => {
		if (!myelin || front < 0) return 0;
		const ago = front - i;
		return ago < 0 ? 0 : 1 - smoothstep(0.6, 2.2, ago);
	};

	// ---- the race -------------------------------------------------------------------
	const RACE_SLOW = 50;
	const tM = $derived(1 / vM); // s to travel 1 m
	const tU = $derived(1 / vU);
	const raceLen = $derived(tU * RACE_SLOW + 2); // s of animation (the slow one, plus a pause)
	const raceReal = $derived(reduced ? tU : Math.max(0, (elapsed % raceLen) - 0.4) / RACE_SLOW);
	const RX0 = 180;
	const RX1 = 880;
	const lanes = $derived([
		{ id: 'm', label: 'with myelin', v: vM, time: tM, y: 440, on: myelin },
		{ id: 'u', label: 'bare', v: vU, time: tU, y: 500, on: !myelin }
	]);
	const fmtT = (s: number) => (s < 0.1 ? `${(s * 1000).toFixed(1)} ms` : `${s.toFixed(2)} s`);
	const fmtV = (x: number) => (x < 10 ? x.toFixed(1) : x.toFixed(0));
</script>

<g class="myelin">
	<Readout id="title" order={0} label="Fibre" value="{d} µm, {myelin ? 'myelinated' : 'bare'}">
		<Label
			x={X0}
			y={70}
			anchor="start"
			size={14}
			weight={600}
			text="a {d} µm nerve fibre, {myelin ? 'wrapped in myelin' : 'bare'}"
		/>
		<Label
			x={X0}
			y={90}
			anchor="start"
			size={11}
			muted
			text="5 internodes, {((5 * L) / 1000).toFixed(1)} mm · slowed down 36,000 times"
		/>
	</Readout>
	<Readout id="speed" order={1} label="Speed" value="{fmtV(v)} m/s" color="var(--nr-fire)">
		<Label x={X1} y={70} anchor="end" size={15} weight={700} text="{fmtV(v)} m/s" />
		<Label
			x={X1}
			y={90}
			anchor="end"
			size={11}
			muted
			text={myelin ? `one jump every ${(L / v).toFixed(0)} µs` : 'the front creeps along'}
		/>
	</Readout>

	<!-- the axon: depolarised behind the front -->
	<rect
		x={X0 - 8}
		y={Y - R}
		width={X1 - X0 + 16}
		height={2 * R}
		rx={R}
		fill="var(--nr-axon)"
		stroke="var(--nr-axon-edge)"
		stroke-width="1.5"
	/>
	{#if front >= 0}
		<rect
			x={X0 - 6}
			y={Y - R + 2}
			width={Math.max(0, frontX - X0 + 6)}
			height={2 * R - 4}
			rx={R - 2}
			fill="var(--nr-fire)"
			opacity="0.7"
		/>
	{/if}
	{#if myelin}
		{#each nodeX.slice(0, -1) as x (x)}
			<rect
				x={x + 6}
				y={Y - R - 18}
				width={seg - 12}
				height={2 * R + 36}
				rx="18"
				fill="var(--nr-myelin)"
				stroke="var(--nr-myelin-edge)"
				stroke-width="1.5"
				opacity="0.92"
			/>
			{#each [10, 20, 30] as k (k)}
				<line
					x1={x + 18}
					x2={x + seg - 18}
					y1={Y - R - 18 + k * 0.5 + 3}
					y2={Y - R - 18 + k * 0.5 + 3}
					stroke="var(--nr-myelin-edge)"
					opacity="0.4"
				/>
				<line
					x1={x + 18}
					x2={x + seg - 18}
					y1={Y + R + 18 - k * 0.5 - 3}
					y2={Y + R + 18 - k * 0.5 - 3}
					stroke="var(--nr-myelin-edge)"
					opacity="0.4"
				/>
			{/each}
		{/each}
		{#each nodeX as x, i (x)}
			{@const g = nodeGlow(i)}
			<circle cx={x} cy={Y} r={6 + 10 * g} fill="var(--nr-fire)" opacity={0.25 + 0.75 * g} />
			{#if g > 0.4}
				<path
					d="M{x} {Y - R - 30} L{x} {Y - R - 4} M{x - 5} {Y - R - 10} L{x} {Y - R - 3} L{x + 5} {Y -
						R -
						10}"
					fill="none"
					stroke="var(--nr-na)"
					stroke-width="2.4"
					stroke-linecap="round"
					opacity={g}
				/>
			{/if}
		{/each}
	{:else if front >= 0 && front <= NODES}
		{#each [-24, -12, 0] as dx (dx)}
			<path
				d="M{frontX + dx} {Y - R - 26} L{frontX + dx} {Y - R - 4} M{frontX + dx - 5} {Y -
					R -
					10} L{frontX + dx} {Y - R - 3} L{frontX + dx + 5} {Y - R - 10}"
				fill="none"
				stroke="var(--nr-na)"
				stroke-width="2.4"
				stroke-linecap="round"
			/>
		{/each}
	{/if}
	<Readout
		id="nodes"
		order={3}
		label={myelin
			? 'Nodes of Ranvier: only they fire'
			: 'Front of the impulse: Na⁺ channels opening'}
		marker={myelin ? 1 : undefined}
		at={myelin ? [X0 + seg, Y + 52] : undefined}
	>
		<Label
			x={myelin ? X0 + seg : X0}
			y={Y + R + 42}
			anchor={myelin ? 'middle' : 'start'}
			size={12}
			text={myelin
				? 'node of Ranvier: only the nodes fire'
				: 'every patch of membrane must fire in turn'}
		/>
	</Readout>
	{#if myelin}
		<Readout
			id="internode"
			order={4}
			label="Internode"
			value="{(L / 1000).toFixed(2)} mm of myelin"
		>
			<Label
				x={X0 + 2.5 * seg}
				y={Y + R + 42}
				size={12}
				muted
				text="myelin: {(L / 1000).toFixed(1)} mm between nodes"
			/>
		</Readout>
	{/if}

	<!-- the race -->
	<Readout id="race-title">
		<Label
			x={X0}
			y={392}
			anchor="start"
			size={13}
			weight={600}
			text="race over 1 metre, spinal cord to toe ({d} µm fibres, slowed 50 times)"
		/>
	</Readout>
	{#each lanes as l (l.id)}
		{@const u = clamp(raceReal / l.time)}
		<g opacity={l.on ? 1 : 0.5}>
			<Label
				x={RX0 - 14}
				y={l.y + 5}
				anchor="end"
				size={12}
				weight={l.on ? 700 : 500}
				text={l.label}
			/>
			<rect x={RX0} y={l.y - 7} width={RX1 - RX0} height="14" rx="7" fill="var(--stage-grid)" />
			<rect
				x={RX0}
				y={l.y - 7}
				width={(RX1 - RX0) * u}
				height="14"
				rx="7"
				fill={l.id === 'm' ? 'var(--nr-myelin-edge)' : 'var(--nr-axon-edge)'}
			/>
			<circle cx={RX0 + (RX1 - RX0) * u} cy={l.y} r="9" fill="var(--nr-fire)" />
			<Readout
				id="lane-{l.id}"
				order={5 + (l.id === 'm' ? 0 : 1)}
				label="1 m {l.label}"
				value="{fmtT(l.time)} at {fmtV(l.v)} m/s"
			>
				<Label
					x={RX1}
					y={l.y - 14}
					anchor="end"
					size={11}
					muted
					text="{u >= 1 ? 'arrived: ' : ''}{fmtT(l.time)} at {fmtV(l.v)} m/s"
				/>
			</Readout>
		</g>
	{/each}
	<Readout id="note">
		<Label
			x={X0}
			y={560}
			anchor="start"
			size={11}
			muted
			text="speeds: myelinated 6 m/s per µm of diameter (Hursh 1939); bare scaled from the squid axon (∝ √diameter)"
		/>
	</Readout>
</g>
