<script lang="ts">
	/**
	 * A long rope seen from the side, for the first chapter.
	 *
	 * Phases (`step.hints.phase`), cross-faded with a tween:
	 *   wave   — a hand at the left end shakes it at `params.frequency`; the sine
	 *            wave runs right at 2 m/s from t = 0 (the rope ahead of the front
	 *            is still). A red bead 3 m along only moves up and down; a
	 *            bracket marks one wavelength between two crests. Card: f, λ, v.
	 *   pulses — the ends are clamped; a pulse enters from each end every 3.6 s
	 *            and they cross in the middle half-way through (the reduced-motion
	 *            frame is that moment of overlap). `params.second` turns the right one
	 *            upside down. Dashed: each pulse alone; solid: the rope (their sum).
	 *
	 * Everything is a pure function of t (`travelling`, `pulse` from the model).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { pulse, travelling, wavelength } from '../waves';
	import Card from './Card.svelte';
	import { fmt, pathOf, type Cell } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	const V = 2; // m/s along this rope
	const PXM = 140; // px per metre
	const X0 = 96; // rope start (the hand)
	const X1 = 920; // rope end
	const Y = 330; // rope at rest
	const AMP = 74; // px: the hand's swing
	const BEAD_M = 3; // m from the hand
	const PERIOD = 3.6; // s between pulse passes; they meet half-way through
	const PW = 0.32; // m: pulse half-width
	const MID = (X0 + X1) / 2;

	const phase = $derived(String(step.hints?.phase ?? 'wave'));
	const f = $derived(Math.max(0.1, Number(params.frequency ?? 1)));
	const lam = $derived(wavelength(V, f));
	const inverted = $derived(params.second === 'down');

	// cross-fade between the two phases (and smooth flips of the right pulse)
	const wWave = new Tween(1, { duration: 700, easing: cubicInOut });
	const sign = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const w = phase === 'wave' ? 1 : 0;
		const s = inverted ? -1 : 1;
		untrack(() => {
			wWave.set(w, { duration: reduced ? 0 : 700 });
			sign.set(s, { duration: reduced ? 0 : 600 });
		});
	});

	const xm = (x: number) => (x - X0) / PXM; // px → m along the rope
	const xs = Array.from({ length: Math.round((X1 - X0) / 3) + 1 }, (_, i) =>
		Math.min(X1, X0 + i * 3)
	);

	// ---- the travelling wave ------------------------------------------------------------
	const tw = $derived(reduced ? 2.5 : t);
	const handY = $derived(Y - AMP * Math.sin(2 * Math.PI * f * tw));
	const ropeWave = $derived(
		pathOf(xs.map((x) => ({ x, y: Y - AMP * travelling(xm(x), tw, f, V) })))
	);
	const front = $derived(X0 + V * tw * PXM);
	const beadX = X0 + BEAD_M * PXM;
	const beadY = $derived(Y - AMP * travelling(BEAD_M, tw, f, V));
	/**
	 * One wavelength between two neighbouring crests behind the front, the pair
	 * nearest x = 640; crests sit where f(t − x/v) = k + ¼.
	 */
	const bracket = $derived.by(() => {
		const crestX = (k: number) => X0 + V * (tw - (k + 0.25) / f) * PXM;
		let best: { a: number; b: number } | null = null;
		for (let k = 0; k < 40; k++) {
			const b = crestX(k);
			const a = crestX(k + 1);
			if (a < X0 + 10) break;
			if (b > Math.min(front, X1) - 10) continue;
			if (!best || Math.abs((a + b) / 2 - 640) < Math.abs((best.a + best.b) / 2 - 640))
				best = { a, b };
		}
		return best;
	});

	// ---- the two pulses ----------------------------------------------------------------
	const ps = $derived(reduced ? PERIOD / 2 : t % PERIOD);
	const cA = $derived(MID - V * PXM * (PERIOD / 2 - ps));
	const cB = $derived(MID + V * PXM * (PERIOD / 2 - ps));
	const wpx = PW * PXM;
	// pulses fade in from the clamps and out into them
	const edgeFade = (c: number) =>
		Math.min(1, Math.max(0, (c - X0 + wpx) / (2 * wpx)), Math.max(0, (X1 + wpx - c) / (2 * wpx)));
	const a1 = $derived(edgeFade(cA));
	const a2 = $derived(edgeFade(cB) * sign.current);
	const yA = (x: number) => AMP * a1 * pulse(x, cA, wpx);
	const yB = (x: number) => AMP * a2 * pulse(x, cB, wpx);
	const ropePulses = $derived(pathOf(xs.map((x) => ({ x, y: Y - yA(x) - yB(x) }))));
	const ghostA = $derived(pathOf(xs.map((x) => ({ x, y: Y - yA(x) }))));
	const ghostB = $derived(pathOf(xs.map((x) => ({ x, y: Y - yB(x) }))));
	const overlap = $derived(Math.max(0, 1 - Math.abs(cA - cB) / (4.5 * wpx)));
	const peak = $derived(Math.abs(yA(MID) + yB(MID)));

	const rope = $derived(wWave.current > 0.5 ? ropeWave : ropePulses);
	const show = (v: number) => Math.max(0, Math.min(1, (v - 0.5) * 2));
	const oWave = $derived(show(wWave.current));
	const oPulse = $derived(show(1 - wWave.current));

	// ---- readouts ----------------------------------------------------------------------
	const cells = $derived<Cell[]>(
		phase === 'wave'
			? [
					{
						id: 'f',
						label: 'Frequency f',
						value: `${fmt(f, 2)} Hz`,
						sub: 'swings of the hand per second'
					},
					{
						id: 'l',
						label: 'Wavelength λ',
						value: `${fmt(lam, 2)} m`,
						sub: 'crest to crest',
						color: 'var(--wav-a)'
					},
					{
						id: 'v',
						label: 'Speed v = f × λ',
						value: `${fmt(f * lam, 1)} m/s`,
						sub: 'fixed by the rope'
					}
				]
			: [
					{ id: 'a', label: 'Pulse from the left', value: 'upright', color: 'var(--wav-a)' },
					{
						id: 'b',
						label: 'Pulse from the right',
						value: inverted ? 'upside down' : 'upright',
						color: 'var(--wav-b)'
					},
					{
						id: 's',
						label: 'Where they overlap',
						value: 'the heights add',
						sub: inverted ? 'up + down = flat, for an instant' : 'up + up = twice as tall'
					}
				]
	);
</script>

<g>
	<Card x={16} y={16} w={928} {cells} />

	<!-- metre ruler under the rope -->
	<g style:pointer-events="none">
		<line x1={X0} x2={X1} y1={Y + 130} y2={Y + 130} stroke="var(--stage-line)" />
		{#each [0, 1, 2, 3, 4, 5] as m (m)}
			<line
				x1={X0 + m * PXM}
				x2={X0 + m * PXM}
				y1={Y + 125}
				y2={Y + 135}
				stroke="var(--stage-line)"
			/>
			<text x={X0 + m * PXM} y={Y + 152} text-anchor="middle" class="muted" style:font-size="11px"
				>{m} m</text
			>
		{/each}
	</g>

	<!-- rest line -->
	<line
		x1={X0}
		x2={X1}
		y1={Y}
		y2={Y}
		stroke="var(--stage-line)"
		stroke-dasharray="3 5"
		opacity="0.8"
	/>

	{#if oWave > 0}
		<g opacity={oWave} style:pointer-events="none">
			<!-- the hand: a block on a rod, moving up and down -->
			<line
				x1={X0 - 36}
				x2={X0 - 36}
				y1={Y - AMP - 20}
				y2={Y + AMP + 20}
				stroke="var(--stage-line)"
				stroke-width="2"
			/>
			<rect
				x={X0 - 52}
				y={handY - 16}
				width="32"
				height="32"
				rx="8"
				fill="var(--protein)"
				stroke="var(--protein-edge)"
				stroke-width="1.5"
			/>
			<line x1={X0 - 20} x2={X0} y1={handY} y2={handY} stroke="var(--wav-sum)" stroke-width="3" />
			<text x={X0 - 36} y={Y + AMP + 40} text-anchor="middle" class="muted" style:font-size="12px"
				>hand</text
			>

			<!-- one wavelength -->
			{#if bracket}
				{@const yb = Y - AMP - 26}
				<line
					x1={bracket.a}
					x2={bracket.a}
					y1={yb - 6}
					y2={Y - AMP - 6}
					stroke="var(--wav-a)"
					stroke-dasharray="2 3"
				/>
				<line
					x1={bracket.b}
					x2={bracket.b}
					y1={yb - 6}
					y2={Y - AMP - 6}
					stroke="var(--wav-a)"
					stroke-dasharray="2 3"
				/>
				<line
					x1={bracket.a + 2}
					x2={bracket.b - 2}
					y1={yb}
					y2={yb}
					stroke="var(--wav-a)"
					stroke-width="1.5"
					marker-start="url(#arrowhead)"
					marker-end="url(#arrowhead)"
				/>
				<text
					x={(bracket.a + bracket.b) / 2}
					y={yb - 10}
					text-anchor="middle"
					class="halo"
					style:font-size="13px"
					style:fill="var(--wav-a)"
					font-weight="600">λ = {fmt(lam, 2)} m</text
				>
			{/if}

			<!-- the front, while it is still on the rope -->
			{#if front < X1 - 30}
				<line
					x1={front + 8}
					x2={front + 58}
					y1={Y - 22}
					y2={Y - 22}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					marker-end="url(#arrowhead)"
				/>
				<text x={front + 10} y={Y - 32} class="muted halo" style:font-size="12px">front, 2 m/s</text
				>
			{/if}
		</g>
	{/if}

	{#if oPulse > 0}
		<g opacity={oPulse} style:pointer-events="none">
			<!-- clamps at both ends -->
			<rect x={X0 - 14} y={Y - 30} width="10" height="60" rx="3" fill="var(--stage-line)" />
			<rect x={X1 + 4} y={Y - 30} width="10" height="60" rx="3" fill="var(--stage-line)" />
			{#if overlap > 0}
				<path
					d={ghostA}
					fill="none"
					stroke="var(--wav-a)"
					stroke-width="2"
					stroke-dasharray="6 5"
					opacity={overlap}
				/>
				<path
					d={ghostB}
					fill="none"
					stroke="var(--wav-b)"
					stroke-width="2"
					stroke-dasharray="6 5"
					opacity={overlap}
				/>
			{/if}
		</g>
	{/if}

	<!-- the rope -->
	<path
		d={rope}
		fill="none"
		stroke="var(--wav-sum)"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>

	{#if oWave > 0}
		<g opacity={oWave} style:pointer-events="none">
			<line
				x1={beadX}
				x2={beadX}
				y1={Y - AMP - 4}
				y2={Y + AMP + 4}
				stroke="var(--wav-bead)"
				stroke-width="1.5"
				stroke-dasharray="2 4"
				opacity="0.7"
			/>
			<circle
				cx={beadX}
				cy={beadY}
				r="8"
				fill="var(--wav-bead)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<text
				x={beadX}
				y={Y + AMP + 26}
				text-anchor="middle"
				class="halo"
				style:font-size="12px"
				style:fill="var(--wav-bead)">the bead only moves up and down</text
			>
		</g>
	{/if}

	{#if oPulse > 0}
		<g opacity={oPulse} style:pointer-events="none">
			{#if overlap < 0.35}
				{#if a1 > 0.3}
					<text
						x={cA}
						y={Y - AMP - 20}
						text-anchor="middle"
						class="halo"
						style:font-size="22px"
						style:fill="var(--wav-a)"
						font-weight="700">→</text
					>
				{/if}
				{#if Math.abs(a2) > 0.3}
					<text
						x={cB}
						y={a2 > 0 ? Y - AMP - 20 : Y + AMP + 32}
						text-anchor="middle"
						class="halo"
						style:font-size="22px"
						style:fill="var(--wav-b)"
						font-weight="700">←</text
					>
				{/if}
			{:else}
				<text
					x={MID}
					y={Y - Math.max(AMP, peak) - 24}
					text-anchor="middle"
					class="halo"
					style:font-size="13px"
					font-weight="600"
					opacity={Math.min(1, (overlap - 0.35) * 3)}
					>{inverted ? 'up + down = flat' : 'up + up = twice as tall'}</text
				>
			{/if}
			<g transform="translate(0 {Y + 186})">
				<line x1={X0} x2={X0 + 26} y1="0" y2="0" stroke="var(--wav-sum)" stroke-width="3" />
				<text x={X0 + 34} y="4" style:font-size="12px">the rope (the sum)</text>
				<line
					x1={X0 + 190}
					x2={X0 + 216}
					y1="0"
					y2="0"
					stroke="var(--wav-a)"
					stroke-width="2"
					stroke-dasharray="6 5"
				/>
				<line
					x1={X0 + 222}
					x2={X0 + 248}
					y1="0"
					y2="0"
					stroke="var(--wav-b)"
					stroke-width="2"
					stroke-dasharray="6 5"
				/>
				<text x={X0 + 256} y="4" style:font-size="12px">each pulse on its own</text>
			</g>
		</g>
	{/if}
</g>
