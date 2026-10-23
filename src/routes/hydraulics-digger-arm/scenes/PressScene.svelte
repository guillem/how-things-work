<script lang="ts">
	/**
	 * A two-piston press seen from the side: the hand's small piston on the left, a pipe of oil along
	 * the bottom, and a big piston (a ram, like a bottle jack's) on the right carrying a load. Widths
	 * are drawn to scale (10 px per cm), and so are the strokes (6 px per cm), so a big piston's
	 * millimetre rise really is a few pixels. Everything comes from `press` in the model.
	 *
	 * same, ten: the reader pushes (slider or the handle). trade, car, boulder: the reader sets the big
	 * piston's width and the hand pushes by itself, down and back up. air: the reader lets air into
	 * the pipe; the hand pushes by itself and the bubble shrinks before the car moves.
	 */
	import {
		Handle,
		Label,
		clamp,
		easeInOut,
		pingpong,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { HAND, LOADS, press, ratio } from '../model';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'same'));

	// ---- what the reader set, and the press it makes -----------------------------------------------
	const AIR_SPOON = 15e-6;
	const reader = $derived(phase === 'same' || phase === 'ten');
	/** The big piston's width, cm. */
	const bigCm = $derived(
		phase === 'same'
			? 2
			: phase === 'ten'
				? 2 * Math.sqrt(10)
				: phase === 'air'
					? 16
					: clamp(Number(params.big ?? 6.5), 2, 30)
	);
	const load = $derived(
		phase === 'same'
			? null
			: phase === 'ten' || phase === 'trade'
				? { kind: 'crate' as const, kg: LOADS.crate, name: 'the crate' }
				: phase === 'boulder'
					? { kind: 'boulder' as const, kg: LOADS.boulder, name: 'the boulder' }
					: { kind: 'car' as const, kg: LOADS.car, name: 'the car' }
	);
	const loadKg = $derived(load?.kg ?? 0);
	const airM3 = $derived(phase === 'air' ? clamp(Number(params.air ?? 0), 0, 6) * AIR_SPOON : 0);
	/** Can the hand (at most 20 kg, or 10 kg on the crate step) hold the load up at all? */
	const needKg = $derived(loadKg / ratio(bigCm / 100));
	const strong = $derived(phase === 'same' || phase === 'ten' || needKg <= HAND.pushKg + 1e-9);

	/** The push, cm: the reader's, or the hand's own: down over 3 s, back up over 3 s. */
	const autoPush = $derived(HAND.stroke * 100 * easeInOut(pingpong(reduced ? 2.5 : t, 6)));
	const pushCm = $derived(
		reader ? clamp(Number(params.push ?? 0), 0, HAND.stroke * 100) : strong ? autoPush : 0
	);
	const st = $derived(press({ big: bigCm / 100, push: pushCm / 100, loadKg, air: airM3 }));
	const riseCm = $derived(st.rise * 100);
	/** One full push, for the steady readouts. */
	const full = $derived(press({ big: bigCm / 100, push: HAND.stroke, loadKg, air: airM3 }));
	const clean = $derived(press({ big: bigCm / 100, push: HAND.stroke, loadKg }));

	// ---- layout ----------------------------------------------------------------------------------------
	const KX = 10;
	const KY = 6;
	const SX = 170;
	const BX = 640;
	const PIPE_TOP = 398;
	const PIPE_BOT = 458;
	const S_TOP = 150;
	const S_FACE0 = 180;
	const B_TOP = 236;
	const B_FACE0 = 404;
	const RAM = 190;
	const sw = KX * 2;
	const bw = $derived(KX * bigCm);
	const sFace = $derived(S_FACE0 + pushCm * KY);
	const bFace = $derived(B_FACE0 - riseCm * KY);
	const ramTop = $derived(bFace - RAM);
	const handleY = $derived(sFace - 52);

	const fmtKg = (kg: number) => `${Math.round(kg).toLocaleString('en-GB')} kg`;
	function fmtCm(cm: number) {
		if (cm < 0.005) return '0 cm';
		if (cm >= 9.95) return `${Math.round(cm)} cm`;
		if (cm >= 0.995) return `${(Math.round(cm * 10) / 10).toLocaleString('en-GB')} cm`;
		return `${(Math.round(cm * 100) / 10).toLocaleString('en-GB')} mm`;
	}
	const times = (n: number) => {
		const r = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
		return r === 1 ? 'the same' : `${r.toLocaleString('en-GB')} times`;
	};

	// ---- oil flecks that travel with the oil -----------------------------------------------------------
	/** Pipe length from the small cylinder to the big one, px. */
	const pipeFrom = SX + sw / 2 + 4;
	const pipeTo = $derived(BX - bw / 2 - 8);
	const bubbleX = 330;
	/** How far the flecks in the pipe move, px: as far as the small piston (drawn, not to scale). */
	const movedBefore = $derived(pushCm * KY);
	const movedAfter = $derived(riseCm * KY * ratio(bigCm / 100));
	const flecks = $derived.by(() => {
		const out: { k: number; x: number; o: number }[] = [];
		const gap = 34;
		const span = pipeTo - pipeFrom;
		for (let k = 0; k < Math.ceil(span / gap); k++) {
			const x0 = pipeFrom + k * gap;
			const moved = airM3 > 0 && x0 > bubbleX ? movedAfter : movedBefore;
			let x = x0 + moved;
			x = pipeFrom + ((((x - pipeFrom) % span) + span) % span);
			const o = smoothstep(pipeFrom, pipeFrom + 14, x) * (1 - smoothstep(pipeTo - 14, pipeTo, x));
			if (airM3 > 0 && Math.abs(x - bubbleX) < bubbleR + 6) continue;
			out.push({ k, x, o });
		}
		return out;
	});

	// ---- the air bubble ----------------------------------------------------------------------------------
	const bubbleR = $derived(airM3 > 0 ? 2.8 * Math.sqrt(st.bubble * 1e6) : 0);
	const bubbleR0 = $derived(airM3 > 0 ? 2.8 * Math.sqrt(airM3 * 1e6) : 0);
	const squashedTo = $derived(airM3 > 0 ? Math.round(airM3 / full.bubble) : 1);

	// ---- the top view of the two faces (the crate step) ----------------------------------------------
	const TV = { x: 290, y: 300, k: 11 };
	const tvSmall = TV.k;
	const tvBig = $derived(TV.k * Math.sqrt(10));
	const gridCells = (() => {
		const cells: { i: number; j: number }[] = [];
		for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) cells.push({ i, j });
		return cells;
	})();

	// ---- dragging the handle -----------------------------------------------------------------------------
	function setPush(cm: number) {
		setParam('push', Math.round(clamp(cm, 0, HAND.stroke * 100)));
	}
	const handLabel = $derived(
		phase === 'same'
			? 'pushed down ' + fmtCm(pushCm)
			: strong
				? `your push: ${fmtKg(phase === 'air' ? st.handKg : needKg)}`
				: `your push: ${fmtKg(HAND.pushKg)}, not enough`
	);
	const bigText = $derived(
		phase === 'same'
			? 'pushed up ' + fmtCm(riseCm)
			: strong
				? `push on ${load?.name}: ${fmtKg(loadKg)}`
				: `${load?.name} doesn’t move`
	);
	const fraction = (n: number) => (n <= 2 ? 'half' : n === 3 ? 'third' : `${n}th`);
	const pushing = $derived(reader ? pushCm > 0.5 : strong);
</script>

<g class="press-scene">
	<defs>
		<clipPath id="press-tv-small"><circle cx={TV.x} cy={TV.y} r={tvSmall} /></clipPath>
		<clipPath id="press-tv-big"><circle cx={TV.x + 140} cy={TV.y} r={tvBig} /></clipPath>
	</defs>

	<!-- the floor -->
	<line x1="40" x2="920" y1={PIPE_BOT + 20} y2={PIPE_BOT + 20} stroke="var(--stage-line)" />

	<!-- the oil: under the small piston, in the pipe, under the big piston -->
	<rect x={SX - sw / 2} y={sFace} width={sw} height={PIPE_BOT - sFace} fill="var(--hyd-oil)" />
	<rect
		x={SX - sw / 2}
		y={PIPE_TOP}
		width={BX - SX + sw / 2}
		height={PIPE_BOT - PIPE_TOP}
		fill="var(--hyd-oil)"
	/>
	<rect x={BX - bw / 2} y={bFace} width={bw} height={PIPE_BOT - bFace} fill="var(--hyd-oil)" />
	{#each flecks as f (f.k)}
		<circle
			cx={f.x}
			cy={(PIPE_TOP + PIPE_BOT) / 2}
			r="3"
			fill="var(--hyd-oil-dark)"
			opacity={f.o}
		/>
	{/each}

	<!-- the air bubble -->
	{#if airM3 > 0}
		<circle
			cx={bubbleX}
			cy={PIPE_TOP + bubbleR0 + 2}
			r={bubbleR0}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
		/>
		<circle
			cx={bubbleX}
			cy={PIPE_TOP + bubbleR0 + 2}
			r={bubbleR}
			fill="var(--hyd-air)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Readout
			id="hyd-bubble"
			order={3}
			label="Air bubble"
			value="squeezed to a {fraction(squashedTo)} of its size"
		>
			<Label
				x={bubbleX}
				y={PIPE_BOT + 42}
				text="air: squeezed to a {fraction(squashedTo)} of its size"
				size={14}
			/>
		</Readout>
	{/if}

	<!-- the pipe and cylinder walls -->
	<g fill="none" stroke="var(--hyd-steel-edge)" stroke-width="3" stroke-linejoin="round">
		<path d="M{SX - sw / 2 - 2} {S_TOP} V{PIPE_BOT + 2} H{BX + bw / 2 + 2} V{B_TOP}" />
		<path d="M{SX + sw / 2 + 2} {S_TOP} V{PIPE_TOP - 2} H{BX - bw / 2 - 2} V{B_TOP}" />
	</g>
	<rect
		x={SX - sw / 2 - 8}
		y={S_TOP - 6}
		width={sw + 16}
		height="8"
		rx="2"
		fill="var(--hyd-steel)"
		stroke="var(--hyd-steel-edge)"
	/>
	<rect
		x={BX - bw / 2 - 8}
		y={B_TOP - 6}
		width={bw + 16}
		height="8"
		rx="2"
		fill="var(--hyd-steel)"
		stroke="var(--hyd-steel-edge)"
	/>

	<!-- the small piston, its rod and handle -->
	<rect
		x={SX - sw / 2}
		y={sFace - 14}
		width={sw}
		height="14"
		fill="var(--hyd-steel)"
		stroke="var(--hyd-steel-edge)"
	/>
	<rect
		x={SX - 3}
		y={handleY}
		width="6"
		height={sFace - 14 - handleY}
		fill="var(--hyd-rod)"
		stroke="var(--hyd-steel-edge)"
	/>
	<rect x={SX - 34} y={handleY - 10} width="68" height="12" rx="6" fill="var(--hyd-track)" />

	<!-- the hand's push -->
	<g opacity={pushing ? 1 : 0.55}>
		<line
			x1={SX}
			x2={SX}
			y1={handleY - 60}
			y2={handleY - 18}
			stroke="var(--hyd-push)"
			stroke-width="4"
			marker-end="url(#arrowhead)"
		/>
	</g>
	<Readout id="hyd-hand" order={1} label="Small piston" value={handLabel}>
		<Label x={SX + 44} y={handleY - 40} text={handLabel} anchor="start" size={15} weight={600} />
	</Readout>
	{#if phase !== 'same'}
		<Readout id="hyd-hand-moved" order={2} label="It moved down" value={fmtCm(pushCm)}>
			<Label x={SX + 44} y={handleY - 20} text="down {fmtCm(pushCm)}" anchor="start" muted />
		</Readout>
	{/if}
	{#if reader}
		<Handle
			x={SX}
			y={handleY - 4}
			label="Small piston"
			value={Math.round(pushCm)}
			min={0}
			max={HAND.stroke * 100}
			valuetext="pushed down {Math.round(pushCm)} centimetres"
			onmove={(p: Point) => setPush((p.y + 4 - (S_FACE0 - 52)) / KY)}
			onkey={(s: number | 'start' | 'end') =>
				setPush(s === 'start' ? 0 : s === 'end' ? 30 : pushCm + s)}
		/>
	{/if}

	<!-- the big piston (a ram) -->
	<rect
		x={BX - bw / 2}
		y={ramTop}
		width={bw}
		height={bFace - ramTop}
		fill="var(--hyd-rod)"
		stroke="var(--hyd-steel-edge)"
		stroke-width="1.5"
	/>

	<!-- the load on its plate -->
	{#if load}
		{@const pw = Math.max(bw + 20, 170)}
		<rect
			x={BX - pw / 2}
			y={ramTop - 8}
			width={pw}
			height="8"
			rx="2"
			fill="var(--hyd-steel)"
			stroke="var(--hyd-steel-edge)"
		/>
		<g transform="translate({BX} {ramTop - 8})">
			{#if load.kind === 'crate'}
				<rect
					x="-50"
					y="-70"
					width="100"
					height="70"
					rx="3"
					fill="var(--hyd-crate)"
					stroke="var(--hyd-paint-edge)"
				/>
				<path d="M-50 -70 L50 0 M50 -70 L-50 0" stroke="var(--hyd-paint-edge)" opacity="0.6" />
				<Label x={0} y={-30} text="100 kg" size={15} weight={700} />
			{:else if load.kind === 'car'}
				<path
					d="M-120 -22 Q-122 -46 -96 -48 L-62 -50 L-36 -80 L42 -80 L74 -50 L108 -46 Q122 -42 120 -22 Z"
					fill="var(--hyd-car)"
					stroke="var(--stage-ink)"
					stroke-width="1.2"
				/>
				<path
					d="M-28 -74 L-4 -74 L-4 -52 L-50 -52 Z M4 -74 L38 -74 L60 -52 L4 -52 Z"
					fill="var(--stage-bg)"
					opacity="0.8"
				/>
				<circle cx="-72" cy="-18" r="18" fill="var(--hyd-track)" stroke="var(--stage-ink)" />
				<circle cx="72" cy="-18" r="18" fill="var(--hyd-track)" stroke="var(--stage-ink)" />
				<Label x={0} y={-94} text="car: 1,200 kg" size={15} weight={700} />
			{:else}
				<path
					d="M-104 0 Q-118 -46 -80 -84 Q-30 -122 30 -110 Q96 -96 106 -40 Q112 -12 100 0 Z"
					fill="var(--hyd-rock)"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
				/>
				<Label x={0} y={-50} text="boulder: 3,000 kg" size={15} weight={700} />
			{/if}
		</g>
	{/if}

	<!-- what the big piston does -->
	<Readout id="hyd-big" order={4} label="Big piston" value={bigText}>
		<Label x={936} y={60} text={bigText} anchor="end" size={15} weight={600} />
	</Readout>
	{#if phase !== 'same'}
		{@const upText = strong
			? `up ${fmtCm(riseCm)}`
			: `it needs a push of ${fmtKg(needKg)} from your hand`}
		<Readout id="hyd-big-up" order={5} label="It rose" value={upText}>
			<Label x={936} y={82} text={upText} anchor="end" muted />
		</Readout>
	{/if}

	<!-- the swap, in counters -->
	{#if phase === 'trade' || phase === 'ten'}
		{@const n = ratio(bigCm / 100)}
		<Readout
			id="hyd-trade"
			order={6}
			label="The swap"
			value="{times(n)} the push, {times(n)} less far"
		>
			<g transform="translate(480 40)">
				<Label x={0} y={0} text="big face: {times(n)} as big" anchor="middle" size={14} />
				<Label
					x={0}
					y={24}
					text="{times(n)} the push"
					anchor="middle"
					size={16}
					weight={700}
					color="var(--hyd-push)"
				/>
				<Label
					x={0}
					y={48}
					text="{times(n)} less far"
					anchor="middle"
					size={16}
					weight={700}
					color="var(--hyd-oil-dark)"
				/>
			</g>
		</Readout>
	{/if}

	<!-- the faces seen from above, with a grid of 1 cm squares -->
	{#if phase === 'ten'}
		<Readout id="hyd-squares">
			<g>
				<g clip-path="url(#press-tv-small)">
					<rect
						x={TV.x - tvSmall}
						y={TV.y - tvSmall}
						width={tvSmall * 2}
						height={tvSmall * 2}
						fill="var(--hyd-steel)"
					/>
				</g>
				<g clip-path="url(#press-tv-big)">
					<rect
						x={TV.x + 140 - tvBig}
						y={TV.y - tvBig}
						width={tvBig * 2}
						height={tvBig * 2}
						fill="var(--hyd-steel)"
					/>
					{#each gridCells as c (`${c.i}:${c.j}`)}
						<rect
							x={TV.x + 140 + c.i * TV.k}
							y={TV.y + c.j * TV.k}
							width={TV.k}
							height={TV.k}
							fill="none"
							stroke="var(--hyd-steel-edge)"
							stroke-width="0.8"
						/>
					{/each}
				</g>
				<g clip-path="url(#press-tv-small)">
					{#each gridCells as c (`${c.i}:${c.j}`)}
						<rect
							x={TV.x + c.i * TV.k}
							y={TV.y + c.j * TV.k}
							width={TV.k}
							height={TV.k}
							fill="none"
							stroke="var(--hyd-steel-edge)"
							stroke-width="0.8"
						/>
					{/each}
				</g>
				<circle
					cx={TV.x}
					cy={TV.y}
					r={tvSmall}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<circle
					cx={TV.x + 140}
					cy={TV.y}
					r={tvBig}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<Label
					x={TV.x + 70}
					y={TV.y - tvBig - 30}
					text="the two faces, seen from above"
					anchor="middle"
					size={13}
					muted
				/>
				<Label x={TV.x} y={TV.y + tvBig + 22} text="about 3 squares" anchor="middle" size={13} />
				<Label
					x={TV.x + 140}
					y={TV.y + tvBig + 22}
					text="about 31 squares"
					anchor="middle"
					size={13}
				/>
				<Label
					x={TV.x + 70}
					y={TV.y + tvBig + 42}
					text="the same push on every square"
					anchor="middle"
					size={13}
					weight={600}
				/>
			</g>
		</Readout>
	{/if}

	<!-- full-push summaries -->
	{#if phase === 'car' || phase === 'boulder'}
		{@const perPush = strong
			? `one full push lifts ${load?.name} ${fmtCm(full.rise * 100)}`
			: `make the big piston wider: about ${(Math.ceil(4 * Math.sqrt(loadKg / HAND.pushKg)) / 2).toLocaleString('en-GB') + ' cm'} lifts it`}
		<Readout id="hyd-per-push" order={7} label="Each push" value={perPush}>
			<Label x={480} y={540} text={perPush} anchor="middle" size={15} weight={600} />
		</Readout>
	{/if}
	{#if phase === 'air'}
		{@const airText =
			airM3 > 0
				? `the first ${fmtCm(full.wasted * 100)} of each push only squash the air: the car rises ${fmtCm(full.rise * 100)}, not ${fmtCm(clean.rise * 100)}`
				: `no air: each push lifts the car ${fmtCm(clean.rise * 100)}`}
		<Readout id="hyd-spongy" order={8} label="Each push" value={airText}>
			<Label x={480} y={555} text={airText} anchor="middle" size={15} weight={600} />
		</Readout>
	{/if}

	<Readout id="hyd-labels">
		<Label x={SX} y={PIPE_BOT + 42} text="oil" size={14} color="var(--hyd-oil-dark)" weight={600} />
		<Label x={SX - 44} y={S_TOP + 110} text="small piston" anchor="end" size={13} muted />
		<Label
			x={BX - bw / 2 - 12}
			y={Math.min(B_TOP + 30, bFace - 10)}
			text="big piston"
			anchor="end"
			size={13}
			muted
		/>
	</Readout>
</g>
