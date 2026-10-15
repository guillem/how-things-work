<script lang="ts">
	/**
	 * Balancing a pole on a cart. Left: the cart on its track (the camera follows it,
	 * marks every half metre), the 1 m pole with its tilt, and the cart's push. Right:
	 * the readout card, the tilt against time and the cart's acceleration.
	 *
	 * The 20 s run (`balance`, from a 6° tilt) is precomputed per setting and replayed in
	 * real time; a change of gains or "Tip it" restarts it, and it starts over after a
	 * 3 s hold. A fallen pole lies on the floor. Reduced motion: the complete run.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, scale } from '#lib/draw/index.ts';
	import { G, POLE, at, balance, type Gains } from '../control';
	import Card from './Card.svelte';
	import Plot from './Plot.svelte';
	import { restartClock, seriesPath, type Cell } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const gains = $derived<Gains>({
		kp: Number(params.poleKp ?? 15),
		ki: 0,
		kd: Number(params.poleKd ?? 3)
	});
	const SECONDS = 20;
	const run = $derived(balance({ gains, seconds: SECONDS }));
	const DEG = 180 / Math.PI;

	const clock = restartClock();
	const since = $derived(clock(`${gains.kp}|${gains.kd}|${String(params.nudge ?? 0)}`, t));
	const now = $derived(reduced ? SECONDS : Math.min(SECONDS, since % (SECONDS + 3)));
	const fallen = $derived(now >= run.end);
	const theta = $derived(
		fallen ? Math.sign(at(run, run.x[2], run.end)) * (Math.PI / 2) : at(run, run.x[2], now)
	);
	const cartX = $derived(at(run, run.x[0], Math.min(now, run.end)));
	const push = $derived(fallen ? 0 : -at(run, run.u, now));

	// ---- the drawing ------------------------------------------------------------------------------
	const CX = 230;
	const TRACK = 400;
	const PXM = 190;
	const tip = $derived({
		x: CX + Math.sin(theta) * POLE.length * PXM,
		y: TRACK - 26 - Math.cos(theta) * POLE.length * PXM
	});
	const marks = $derived.by(() => {
		const out: { k: number; px: number }[] = [];
		const a = Math.ceil((cartX - CX / PXM) / 0.5);
		for (let k = a; k * 0.5 <= cartX + (440 - CX) / PXM; k++)
			out.push({ k, px: CX + (k * 0.5 - cartX) * PXM });
		return out;
	});

	// ---- plots -------------------------------------------------------------------------------------
	const P0 = 520;
	const P1 = 928;
	const TP = { top: 140, bottom: 330 };
	const AP = { top: 400, bottom: 540 };
	const sx = scale([0, SECONDS], [P0, P1]);
	const sy = scale([-10, 10], [TP.bottom, TP.top]);
	const sa = scale([-15, 15], [AP.bottom, AP.top]);
	const tiltSeries = $derived(run.x[2].map((v) => v * DEG));
	const endIdx = $derived(
		Number.isFinite(run.end) ? Math.floor(run.end / run.sample) : run.u.length
	);
	const tiltPath = $derived(
		seriesPath(tiltSeries.subarray(0, endIdx + 1), run.sample, sx, sy, 1, -11, 11)
	);
	const pushPath = $derived(
		seriesPath(run.u.map((v) => -v).subarray(0, endIdx + 1), run.sample, sx, sa, 1, -16, 16)
	);

	const verdict = $derived(
		gains.kp <= G
			? { v: 'falls', why: 'Kp below g' }
			: gains.kd <= 0
				? { v: 'wobbles', why: 'no D to damp it' }
				: Number.isFinite(run.end)
					? { v: 'falls', why: 'the push is too weak' }
					: { v: 'stands', why: 'Kp beats g, D damps it' }
	);
	const cells: Cell[] = $derived([
		{
			id: 'tilt',
			label: 'tilt',
			value: fallen ? 'fell over' : `${(theta * DEG).toFixed(1)}°`,
			sub: 'tipped to 6° at the start',
			color: 'var(--fc-pole)'
		},
		{
			id: 'push',
			label: 'cart push',
			value: `${push.toFixed(1)} m/s²`,
			sub: 'towards the lean',
			color: 'var(--fc-out)'
		},
		{
			id: 'verdict',
			label: `Kp ${gains.kp.toFixed(1)} vs g ${G.toFixed(2)}`,
			value: verdict.v,
			sub: verdict.why
		}
	]);
</script>

<g>
	<defs>
		<clipPath id="pole-track">
			<rect x="16" y="40" width="444" height="430" rx="12" />
		</clipPath>
		<clipPath id="pole-plots">
			<rect x={P0} y={TP.top - 4} width={sx(now) - P0 + 1} height={AP.bottom - TP.top + 8} />
		</clipPath>
	</defs>

	<g clip-path="url(#pole-track)">
		<line x1="16" x2="456" y1={TRACK} y2={TRACK} stroke="var(--fc-road)" stroke-width="3" />
		{#each marks as m (m.k)}
			<line
				x1={m.px}
				x2={m.px}
				y1={TRACK}
				y2={TRACK + (m.k % 2 ? 6 : 12)}
				stroke="var(--fc-road)"
			/>
			{#if m.k % 2 === 0 && Math.abs(m.px - CX) > 40 && m.px > 40 && m.px < 436}
				<Readout id="mark-{m.k}">
					<Label x={m.px} y={TRACK + 28} text="{m.k / 2} m" size={11} anchor="middle" muted />
				</Readout>
			{/if}
		{/each}
		<!-- upright reference -->
		<line
			x1={CX}
			x2={CX}
			y1={TRACK - 26}
			y2={TRACK - 26 - PXM - 20}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 5"
			opacity="0.6"
		/>
		<!-- the cart -->
		<rect
			x={CX - 44}
			y={TRACK - 34}
			width="88"
			height="24"
			rx="5"
			fill="var(--fc-car)"
			stroke="var(--stage-ink)"
		/>
		<circle cx={CX - 26} cy={TRACK - 8} r="7" fill="var(--fc-body)" />
		<circle cx={CX + 26} cy={TRACK - 8} r="7" fill="var(--fc-body)" />
		<!-- the pole and its weight -->
		<line
			x1={CX}
			y1={TRACK - 26}
			x2={tip.x}
			y2={tip.y}
			stroke="var(--fc-pole)"
			stroke-width="4"
			stroke-linecap="round"
		/>
		<circle cx={tip.x} cy={tip.y} r="13" fill="var(--fc-pole)" stroke="var(--stage-ink)" />
		<circle cx={CX} cy={TRACK - 26} r="4" fill="var(--stage-ink)" />
		{#if Math.abs(push) > 0.3}
			{@const len = Math.max(-90, Math.min(90, push * 8))}
			<line
				x1={CX + Math.sign(len) * 50}
				x2={CX + Math.sign(len) * 50 + len}
				y1={TRACK - 22}
				y2={TRACK - 22}
				stroke="var(--fc-out)"
				stroke-width="3"
				marker-end="url(#arrowhead)"
			/>
		{/if}
	</g>
	<Readout id="pole-labels">
		{#if !fallen}
			<Label x={CX} y={TRACK - 34 - PXM - 22} text="upright" size={11} anchor="middle" muted />
		{/if}
		<Label
			x={CX}
			y={TRACK + 52}
			text="the cart moves under the weight"
			size={12}
			anchor="middle"
			muted
		/>
	</Readout>
	{#if fallen}
		<Readout id="fell" label="The pole" value="fell over">
			<Label
				x={CX}
				y={84}
				text="fell over: {verdict.why}"
				size={14}
				anchor="middle"
				weight={700}
				color="var(--fc-limit)"
			/>
		</Readout>
	{/if}

	<Card {cells} x={472} y={16} w={472} h={68} />

	<Plot
		{sx}
		{sy}
		xTicks={[0, 5, 10, 15, 20]}
		yTicks={[-10, -5, 0, 5, 10]}
		xFormat={(s) => (s === SECONDS ? `${s} s` : String(s))}
		yFormat={(s) => `${s}°`}
	/>
	<Readout id="tilt-title">
		<Label anchor="start" x={P0} y={TP.top - 10} text="tilt" size={12} muted />
	</Readout>
	<Plot
		{sx}
		sy={sa}
		xTicks={[0, 5, 10, 15, 20]}
		yTicks={[-15, 0, 15]}
		xFormat={() => ''}
		yFormat={(s) => `${s}`}
	/>
	<Readout id="push-title">
		<Label anchor="start" x={P0} y={AP.top - 8} text="cart push, m/s²" size={12} muted />
	</Readout>
	<g clip-path="url(#pole-plots)">
		<path
			d={tiltPath}
			fill="none"
			stroke="var(--fc-pole)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
		<path
			d={pushPath}
			fill="none"
			stroke="var(--fc-out)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
	</g>
	<Readout id="time" order={20} label="Time" value="{Math.floor(now)} s of {SECONDS}" />
</g>
