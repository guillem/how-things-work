<script lang="ts">
	/**
	 * A toilet cut in half, seen from the side: the bowl at the front (left), the bend behind it
	 * climbing to its hump and dropping to the drain in the floor, and the tank on top at the back
	 * with its lever, flapper, overflow pipe and float valve. A card on the right reads out what the
	 * water is doing.
	 *
	 * Everything that moves comes from the simulated toilet (`../model`): the tank's and the bowl's
	 * water, the spill over the hump, the bend filling and running full, the gurgle, the float. The
	 * toilet is advanced frame by frame (the scene guide's sanctioned accumulator: the levels are
	 * integrals of flows that the controls change), from a fresh start at each step and each press
	 * of a button. Under reduced motion it is run afresh to the moment of each step that tells its
	 * story (the siphon running, the bucket's end, the tank refilling), not to 2.5 s: a flush frozen
	 * before it starts would show nothing.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BOWLS,
		DEFAULTS,
		FLUSH_LITRES,
		OVERFLOW_TOP,
		RIM,
		SEAL,
		Toilet,
		WATER_LINE,
		bowlLevel,
		outcome,
		tankLevel,
		type Settings
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'toilet'));
	const levers = $derived(Number(params.lever ?? 0));
	const jugs = $derived(Number(params.jug ?? 0));
	const pourSeconds = $derived(Number(params.pour ?? 2));
	const wash = $derived(phase === 'washdown' && params.washdown === true);
	const held = $derived(phase === 'refill' && params.hold === true);
	const usesLever = $derived(['flush', 'siphon', 'next', 'washdown', 'refill'].includes(phase));
	/** Water poured in from a bucket (the bucket step) or a jug (the first step). */
	const BUCKET_START = 1;
	const settings = $derived.by((): Settings => {
		const lever = usesLever ? (levers > 0 && phase !== 'washdown' ? 0.3 : 1) : null;
		const pours =
			phase === 'bucket'
				? [{ start: BUCKET_START, litres: FLUSH_LITRES, seconds: pourSeconds }]
				: phase === 'toilet' && jugs > 0
					? [{ start: 0.3, litres: 1, seconds: 3 }]
					: [];
		return { ...DEFAULTS, bowl: wash ? 'washdown' : 'siphonic', lever, pours, floatHeld: held };
	});
	/** The siphon step plays four times slower. */
	const rate = $derived(phase === 'siphon' ? 0.25 : 1);
	/** A restart: each step, each press of a button, each change of bowl or bucket. */
	const restart = $derived(
		`${phase}:${phase === 'toilet' ? jugs : levers}:${wash}:${phase === 'bucket' ? pourSeconds : ''}`
	);

	/** The moment of each step that a frozen (reduced-motion) frame shows, s of toilet time. */
	const bucketOutcome = $derived(
		phase === 'bucket' ? outcome(settings, BUCKET_START + pourSeconds + 8) : null
	);
	const frozenAt = $derived.by(() => {
		const lever = settings.lever ?? 0;
		switch (phase) {
			case 'toilet':
				return 2.5;
			case 'bucket':
				return bucketOutcome?.primedAt != null
					? bucketOutcome.primedAt + 0.6
					: BUCKET_START + pourSeconds - 0.2;
			case 'washdown':
				return lever + 2;
			case 'refill':
				return held ? 90 : 18;
			default:
				return lever + 2.6;
		}
	});

	// ---- the simulated toilet (frame-to-frame accumulator) ------------------------------------
	let toilet = new Toilet(untrack(() => settings));
	let simT = 0;
	let lastT = 0;
	let key = '';
	const sim = $derived.by(() => {
		const s = settings;
		const k = reduced ? `${restart}:${held}:${frozenAt}` : restart;
		if (k !== key || t < lastT - 1e-6) {
			key = k;
			toilet = new Toilet(s);
			simT = reduced ? frozenAt : 0;
			lastT = t;
		}
		// Holding the float down doesn't restart the flush: the valve just can't close.
		toilet.s = s;
		const dt = t - lastT;
		if (dt > 0 && !reduced) simT += dt * rate;
		lastT = t;
		const st = toilet.run(simT);
		return { ...st, level: bowlLevel(st.bowl) };
	});

	// ---- layout -------------------------------------------------------------------------------
	/** The bowl and the bend: px per metre, and the hump's inside bottom (the crest) at Y0. */
	const K = 650;
	const Y0 = 340;
	const yB = (h: number) => Y0 - h * K;
	/** The tank: px per metre and the flapper's seat. */
	const KT = 520;
	const SEAT = 196;
	const yT = (h: number) => SEAT - h * KT;
	const FLOOR = 548;
	const RIM_Y = yB(RIM);
	const INLET_TOP = yB(-SEAL);
	const BEND_X = 490;
	const f1 = (v: number) => v.toFixed(1);

	const bore = Tween.of(() => BOWLS[wash ? 'washdown' : 'siphonic'].bore * K, {
		duration: 700,
		easing: cubicInOut
	});
	const b = $derived(bore.current);
	const sump = $derived(INLET_TOP + b + 8);
	const bowlPath = $derived(
		`M118,${RIM_Y} C118,${f1(RIM_Y + 110)} 190,${f1(sump)} 270,${f1(sump)} L346,${f1(sump)} ` +
			`L346,${f1(INLET_TOP)} C352,${f1(INLET_TOP - 50)} 372,${f1(RIM_Y + 50)} 372,${RIM_Y} Z`
	);
	/** The china: the bowl's rim, the shelf the tank sits on, the pedestal down to the floor. */
	const bodyPath =
		`M100,${RIM_Y - 14} Q100,${RIM_Y - 20} 108,${RIM_Y - 20} L396,${RIM_Y - 20} L396,206 ` +
		`L580,206 L580,250 Q552,290 544,360 L544,${FLOOR} L270,${FLOOR} Q262,470 210,452 Q112,420 100,300 Z`;
	const inC = $derived(INLET_TOP + b / 2);
	const topC = $derived(Y0 - b / 2);
	const upPath = $derived(`M340,${f1(inC)} C400,${f1(inC)} 386,${f1(topC)} 436,${f1(topC)}`);
	const downPath = $derived(
		`M436,${f1(topC)} C474,${f1(topC)} ${BEND_X},${f1(topC + 26)} ${BEND_X},${f1(topC + 76)} L${BEND_X},584`
	);
	const bendPath = $derived(
		`M340,${f1(inC)} C400,${f1(inC)} 386,${f1(topC)} 436,${f1(topC)} C474,${f1(topC)} ${BEND_X},${f1(topC + 26)} ${BEND_X},${f1(topC + 76)} L${BEND_X},584`
	);

	// ---- what the water does ------------------------------------------------------------------
	const level = $derived(sim.level);
	const yLevel = $derived(yB(level));
	const tankY = $derived(yT(tankLevel(sim.tank)));
	const primed = $derived(sim.primed);
	/** Water comes over the hump faster than the bend can carry it away: it backs up. */
	const filling = $derived(!primed && sim.spill > BOWLS[settings.bowl].primeFlow);
	const sinceBreak = $derived(sim.brokeAt === null ? Infinity : sim.t - sim.brokeAt);
	const gurgle = $derived(sinceBreak < 1.6);
	/** Width of the water running down the long side: a thin spill, thickening as the bend fills. */
	const streamW = $derived(
		primed ? b : Math.min(b, Math.max(sim.spill > 0.01 ? 3 + sim.spill * 5 : 0, sim.bend * b))
	);
	const inflow = $derived(sim.tankFlow + sim.fillFlow * 0.25 + sim.overflow);
	const flapperOpen = new Tween(0, { duration: 350, easing: cubicInOut });
	const isOpen = $derived(sim.flapperOpen);
	$effect(() => {
		const open = isOpen ? 1 : 0;
		untrack(() => void flapperOpen.set(open, reduced ? { duration: 0 } : undefined));
	});
	/** The lever's arm inside the tank, and the flapper's free end that its chain lifts. */
	const tipY = $derived(94 - 22 * flapperOpen.current);
	const flapA = $derived((62 * flapperOpen.current * Math.PI) / 180);
	const fx = $derived(548 - 74 * Math.cos(flapA));
	const fy = $derived(194 - 74 * Math.sin(flapA));
	/** Dashes in the full bend run with the water. */
	const dash = $derived(-(sim.run * K) % 40);

	// The float rides on the water up to the line where it shuts the valve; held, it stays low.
	const floatHeld = Tween.of(() => (held ? 1 : 0), { duration: 500, easing: cubicInOut });
	const floatY = $derived(
		(1 - floatHeld.current) * Math.max(yT(WATER_LINE), tankY) + floatHeld.current * 168
	);

	// The bucket (or jug): upright, pouring, then empty.
	const pourNow = $derived(settings.pours[0]);
	const pourDone = $derived(
		pourNow ? Math.min(1, Math.max(0, (sim.t - pourNow.start) / pourNow.seconds)) : 0
	);
	const pouring = $derived(sim.pourFlow > 0);
	const tilt = Tween.of(() => (pouring ? 1 : pourDone >= 1 ? 1.15 : 0), {
		duration: 400,
		easing: cubicInOut
	});
	const showPourer = $derived(phase === 'bucket' || (phase === 'toilet' && jugs > 0));
	const isJug = $derived(phase === 'toilet');

	// ---- what each step shows --------------------------------------------------------------------
	const focus = $derived.by(() => {
		switch (phase) {
			case 'toilet':
				return { tank: 0.5, bowl: 1, labels: 1 };
			case 'refill':
				return { tank: 1, bowl: 0.6, labels: 0 };
			case 'bucket':
				return { tank: 0.4, bowl: 1, labels: 0 };
			default:
				return { tank: 1, bowl: 1, labels: 0 };
		}
	});
	const fTank = Tween.of(() => focus.tank, { duration: 700 });
	const fBowl = Tween.of(() => focus.bowl, { duration: 700 });
	const fLabels = Tween.of(() => focus.labels, { duration: 700 });
	const showPushes = $derived(phase === 'siphon' || phase === 'next');
	const pushes = Tween.of(() => (showPushes && primed ? 1 : 0), { duration: 300 });

	const litres = (v: number) => {
		const r = Math.round(v);
		return `${r} litre${r === 1 ? '' : 's'}`;
	};
	const status = $derived.by(() => {
		if (primed) return 'the bend is full: the bowl drains itself';
		if (gurgle) return 'air gets into the bend: gurgle!';
		if (filling) return 'the bend is filling up';
		if (sim.overflow > 0.01) return 'the tank overflows into the bowl';
		if (sim.spill > 0.02) return 'water spills over the hump';
		if (sim.brokeAt !== null && level < -0.002)
			return sim.fillFlow > 0 ? 'the bowl fills back up' : 'the bowl is nearly empty';
		if (sim.tankFlow > 0 || sim.pourFlow > 0) return 'the bowl’s water climbs';
		return 'still: level with the top of the bend';
	});
	const bendText = $derived(
		primed
			? 'full of water from end to end'
			: filling
				? `filling up, ${Math.min(90, Math.round(sim.bend * 10) * 10)}% full`
				: sim.spill > 0.02
					? 'a stream runs down it, air gets past'
					: 'empty, with water at the bottom'
	);
	const drainText = $derived(
		primed
			? `about ${Math.round(sim.siphonFlow)} litres a second`
			: sim.spill > 0.02
				? sim.spill >= 0.95
					? `about ${Math.round(sim.spill)} litre${Math.round(sim.spill) === 1 ? '' : 's'} a second`
					: 'a trickle'
				: 'nothing'
	);
	const valveText = $derived(
		held
			? 'held open: the float is down'
			: sim.valve >= 0.99
				? 'open: water comes in'
				: sim.valve > 0
					? 'closing, as the float rises'
					: 'shut: the float is up'
	);
	const extra = $derived.by(() => {
		switch (phase) {
			case 'bucket':
				return {
					label: 'Bucket',
					value: `6 litres in ${pourSeconds} second${pourSeconds === 1 ? '' : 's'}`
				};
			case 'washdown':
				return {
					label: 'Bowl',
					value: wash ? 'washdown: a wide bend' : 'siphonic: a narrow bend'
				};
			case 'refill':
				return { label: 'Fill valve', value: valveText };
			case 'toilet':
				return { label: 'Bowl', value: jugs > 0 ? 'a jug of water poured in' : 'at rest' };
			default:
				return { label: 'The bend', value: bendText };
		}
	});
	const rows = $derived([
		{ id: 'tank', label: 'Left to flush', value: litres(sim.tank) },
		{ id: 'drain', label: 'Down the drain', value: drainText },
		{ id: 'gone', label: 'Gone so far', value: litres(sim.drained) },
		{ id: 'extra', ...extra }
	]);

	const air = [168, 218, 268];
	const bubbles = [0, 1, 2, 3];
</script>

<g>
	<defs>
		<clipPath id="toilet-bowl">
			<path d={bowlPath} />
		</clipPath>
		<clipPath id="toilet-up">
			<rect x="300" y={Math.max(yLevel, topC - b)} width="160" height="300" />
		</clipPath>
		<clipPath id="toilet-tank">
			<rect x="424" y="72" width="272" height="124" />
		</clipPath>
	</defs>

	<!-- ============================================================ the floor and the drain -->
	<rect x="16" y={FLOOR} width="928" height="36" rx="4" fill="var(--tf-floor)" />
	<line x1="16" y1={FLOOR} x2="944" y2={FLOOR} stroke="var(--tf-ceramic-edge)" stroke-width="1.5" />

	<!-- ============================================================ the china body and the bowl -->
	<g opacity={fBowl.current}>
		<path
			d={bodyPath}
			fill="var(--tf-ceramic)"
			stroke="var(--tf-ceramic-edge)"
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
		<!-- the bowl's inside and its water -->
		<path d={bowlPath} fill="var(--tf-air)" stroke="var(--tf-ceramic-edge)" stroke-width="1.5" />
		<rect
			x="110"
			y={yLevel}
			width="270"
			height={Math.max(0, sump - yLevel + 4)}
			fill="var(--tf-water)"
			clip-path="url(#toilet-bowl)"
		/>
		<line
			x1="110"
			y1={yLevel}
			x2="380"
			y2={yLevel}
			stroke="var(--tf-water-edge)"
			stroke-width="2"
			clip-path="url(#toilet-bowl)"
		/>

		<!-- the bend: its wall, the air inside, the water -->
		<path
			d={bendPath}
			fill="none"
			stroke="var(--tf-ceramic-edge)"
			stroke-width={b + 6}
			stroke-linejoin="round"
		/>
		<path d={bendPath} fill="none" stroke="var(--tf-air)" stroke-width={b} />
		{#if primed}
			<path d={bendPath} fill="none" stroke="var(--tf-water)" stroke-width={b} />
			<path
				d={bendPath}
				fill="none"
				stroke="var(--tf-flow)"
				stroke-width="3"
				stroke-dasharray="10 30"
				stroke-dashoffset={dash}
				stroke-linecap="round"
			/>
		{:else}
			<path
				d={upPath}
				fill="none"
				stroke="var(--tf-water)"
				stroke-width={b}
				clip-path="url(#toilet-up)"
			/>
			{#if streamW > 0}
				<path
					d={downPath}
					fill="none"
					stroke="var(--tf-water)"
					stroke-width={streamW}
					stroke-linecap="round"
				/>
				<path
					d={downPath}
					fill="none"
					stroke="var(--tf-flow)"
					stroke-width="2"
					stroke-dasharray="8 26"
					stroke-dashoffset={dash}
					opacity={Math.min(1, streamW / 8)}
				/>
			{/if}
		{/if}
		<!-- where the bowl meets the bend: no wall across the opening -->
		<rect
			x="340"
			y={INLET_TOP}
			width="8"
			height={b}
			fill={primed || level >= -SEAL ? 'var(--tf-water)' : 'var(--tf-air)'}
		/>

		<!-- the gurgle: air bubbling back into the bend -->
		{#if gurgle}
			{#each bubbles as k (k)}
				{@const u = (sinceBreak * 1.6 + k / 4) % 1}
				<circle
					cx={352 + 16 * k + 6 * Math.sin(u * 9)}
					cy={inC + 10 - u * 40}
					r={4 + k}
					fill="var(--tf-air)"
					stroke="var(--tf-water-edge)"
					stroke-width="1.5"
					opacity={1 - sinceBreak / 1.6}
				/>
			{/each}
			<Label
				x={330}
				y={500}
				text="gurgle!"
				size={20}
				weight={800}
				anchor="middle"
				color="var(--tf-gurgle)"
				opacity={1 - sinceBreak / 1.6}
			/>
		{/if}

		<!-- the water coming in under the rim, down the bowl's sides -->
		{#if inflow > 0.02}
			{@const w = 2 + inflow * 3}
			<path
				d="M124,{RIM_Y + 4} C124,{RIM_Y + 60} 140,{RIM_Y + 100} 170,{RIM_Y + 130}"
				fill="none"
				stroke="var(--tf-water)"
				stroke-width={w}
				stroke-linecap="round"
				clip-path="url(#toilet-bowl)"
			/>
			<path
				d="M366,{RIM_Y + 4} C364,{RIM_Y + 50} 356,{RIM_Y + 90} 350,{RIM_Y + 130}"
				fill="none"
				stroke="var(--tf-water)"
				stroke-width={w}
				stroke-linecap="round"
				clip-path="url(#toilet-bowl)"
			/>
		{/if}
	</g>

	<!-- ============================================================ the tank -->
	<g opacity={fTank.current}>
		<rect
			x="416"
			y="60"
			width="288"
			height="146"
			rx="8"
			fill="var(--tf-ceramic)"
			stroke="var(--tf-ceramic-edge)"
			stroke-width="1.5"
		/>
		<rect x="410" y="54" width="300" height="12" rx="4" fill="var(--tf-ceramic-edge)" />
		<rect x="424" y="72" width="272" height="124" fill="var(--tf-air)" />
		<rect
			x="424"
			y={tankY}
			width="272"
			height={Math.max(0, SEAT - tankY)}
			fill="var(--tf-water)"
			clip-path="url(#toilet-tank)"
		/>
		<line
			x1="424"
			y1={tankY}
			x2="696"
			y2={tankY}
			stroke="var(--tf-water-edge)"
			stroke-width="2"
			clip-path="url(#toilet-tank)"
		/>
		<!-- the water line the float is set to -->
		<line
			x1="590"
			y1={yT(WATER_LINE)}
			x2="640"
			y2={yT(WATER_LINE)}
			stroke="var(--tf-ink-soft)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
		/>
		<!-- the way down to the bowl, under the flapper -->
		<path
			d="M505,196 L505,222 Q505,230 497,230 L380,230"
			fill="none"
			stroke="var(--tf-ceramic-edge)"
			stroke-width="14"
			stroke-linejoin="round"
		/>
		<path
			d="M505,196 L505,222 Q505,230 497,230 L380,230"
			fill="none"
			stroke="var(--tf-air)"
			stroke-width="10"
			stroke-linejoin="round"
		/>
		{#if inflow > 0.02}
			<path
				d="M505,196 L505,222 Q505,230 497,230 L380,230"
				fill="none"
				stroke="var(--tf-water)"
				stroke-width={Math.min(10, 2 + inflow * 3)}
				stroke-linejoin="round"
			/>
		{/if}
		<!-- the overflow pipe -->
		<rect
			x="553"
			y={yT(OVERFLOW_TOP)}
			width="14"
			height={SEAT - yT(OVERFLOW_TOP)}
			fill="var(--tf-air)"
			stroke="var(--tf-pipe)"
			stroke-width="2"
		/>
		{#if sim.overflow > 0.01 || (sim.fillFlow > 0.01 && !held)}
			<line
				x1="560"
				y1={yT(OVERFLOW_TOP) + 2}
				x2="560"
				y2={SEAT}
				stroke="var(--tf-water)"
				stroke-width={sim.overflow > 0.01 ? 8 : 3}
			/>
		{/if}
		<!-- the flapper on its seat, hinged on the overflow pipe -->
		<line x1="476" y1="198" x2="534" y2="198" stroke="var(--tf-pipe)" stroke-width="4" />
		<g transform="rotate({62 * flapperOpen.current} 548 194)">
			<rect x="474" y="188" width="74" height="10" rx="4" fill="var(--tf-flapper)" />
		</g>
		<!-- the lever and its chain -->
		<line
			x1="440"
			y1="94"
			x2="500"
			y2={tipY}
			stroke="var(--tf-pipe)"
			stroke-width="4"
			stroke-linecap="round"
		/>
		<line
			x1="500"
			y1={tipY}
			x2={fx + 4}
			y2={fy}
			stroke="var(--tf-chain)"
			stroke-width="1.5"
			stroke-dasharray="3 2"
		/>
		<rect x="398" y="86" width="26" height="12" rx="5" fill="var(--tf-pipe)" />
		<!-- the fill valve and its float -->
		<rect x="666" y="96" width="8" height="100" fill="var(--tf-pipe)" />
		<rect x="656" y="84" width="28" height="14" rx="4" fill="var(--tf-pipe)" />
		<path
			d="M684,90 C700,90 700,66 650,66 C590,66 566,74 562,{yT(OVERFLOW_TOP) - 2}"
			fill="none"
			stroke="var(--tf-pipe)"
			stroke-width="3"
		/>
		{#if sim.fillFlow > 0.01}
			<path
				d="M684,90 C700,90 700,66 650,66 C590,66 566,74 562,{yT(OVERFLOW_TOP) - 2}"
				fill="none"
				stroke="var(--tf-water)"
				stroke-width="2"
				stroke-dasharray="6 6"
				stroke-dashoffset={-(sim.t * 30) % 12}
			/>
			<line
				x1="660"
				y1="98"
				x2="660"
				y2={tankY}
				stroke="var(--tf-water)"
				stroke-width={1 + 3 * sim.valve}
				stroke-dasharray="6 4"
				stroke-dashoffset={-(sim.t * 40) % 10}
			/>
		{/if}
		<rect
			x="646"
			y={floatY - 12}
			width="48"
			height="24"
			rx="6"
			fill="var(--tf-float)"
			stroke="var(--tf-float-edge)"
			stroke-width="1.5"
		/>
		{#if floatHeld.current > 0.01}
			<g opacity={floatHeld.current}>
				<line
					x1="694"
					y1={floatY - 12}
					x2="760"
					y2="40"
					stroke="var(--tf-hand)"
					stroke-width="6"
					stroke-linecap="round"
				/>
				<Label x={768} y={46} text="held down" weight={700} color="var(--tf-hand)" />
			</g>
		{/if}
	</g>

	<!-- ============================================================ the bucket or jug -->
	{#if showPourer && pourNow}
		{@const s = isJug ? 0.6 : 1}
		{@const ang = -100 * tilt.current}
		{@const px = 230}
		{@const py = 120}
		{@const lipA = (ang * Math.PI) / 180}
		{@const lx = px + s * (-40 * Math.cos(lipA) + 30 * Math.sin(lipA))}
		{@const ly = py + s * (-40 * Math.sin(lipA) - 30 * Math.cos(lipA))}
		<g transform="translate({px} {py}) rotate({ang}) scale({s})">
			<path
				d="M-40,-30 L40,-30 L32,40 L-32,40 Z"
				fill="var(--tf-bucket)"
				stroke="var(--tf-bucket-edge)"
				stroke-width="2"
			/>
			<rect
				x="-34"
				y={-26 + 62 * pourDone}
				width="68"
				height={Math.max(0, 62 * (1 - pourDone))}
				fill="var(--tf-water)"
				opacity={0.85 * Math.max(0, 1 - tilt.current)}
			/>
		</g>
		{#if pouring}
			<path
				d="M{f1(lx)},{f1(ly)} Q{f1(lx - 10)},{f1(ly + 40)} {f1(lx - 14)},{f1(yLevel)}"
				fill="none"
				stroke="var(--tf-water)"
				stroke-width={2 + sim.pourFlow * 4}
				stroke-linecap="round"
			/>
		{/if}
		<Readout id="pourer">
			<Label
				x={px - 56}
				y={py + 50}
				text={isJug ? 'a jug: 1 litre' : 'a bucket: 6 litres'}
				anchor="end"
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- ============================================================ gravity and the air -->
	{#if pushes.current > 0.01}
		<g opacity={pushes.current}>
			<line
				x1={BEND_X + b / 2 + 26}
				y1="410"
				x2={BEND_X + b / 2 + 26}
				y2="500"
				stroke="var(--tf-gravity)"
				stroke-width="4"
				marker-end="url(#arrowhead)"
				style:color="var(--tf-gravity)"
			/>
			<Readout
				id="gravity"
				order={10}
				label="Gravity"
				value="pulls the long side’s water down"
				color="var(--tf-gravity)"
			>
				<Label
					x={BEND_X + b / 2 + 40}
					anchor="start"
					y={500}
					text="gravity pulls"
					weight={700}
					color="var(--tf-gravity)"
				/>
				<Label
					x={BEND_X + b / 2 + 40}
					anchor="start"
					y={518}
					text="this water down"
					color="var(--tf-gravity)"
				/>
			</Readout>
			{#each air as x (x)}
				<line
					x1={x}
					y1={yLevel - 62}
					x2={x}
					y2={yLevel - 12}
					stroke="var(--tf-air-push)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
					style:color="var(--tf-air-push)"
				/>
			{/each}
			<Readout
				id="airpush"
				order={11}
				label="The air"
				value="presses on the bowl’s water"
				color="var(--tf-air-push)"
			>
				<Label
					x={218}
					y={RIM_Y - 34}
					text="the air presses on the bowl’s water"
					anchor="middle"
					weight={700}
					color="var(--tf-air-push)"
				/>
			</Readout>
		</g>
	{/if}

	<!-- ============================================================ names of the parts -->
	{#if phase === 'toilet' || fLabels.current > 0.01}
		<Readout id="kTank" order={1} label="Tank" marker={1} at={[560, 40]} opacity={fLabels.current}>
			<Label x={560} y={40} text="tank" anchor="middle" weight={700} opacity={fLabels.current} />
		</Readout>
		<Readout
			id="kBowl"
			order={2}
			label="Bowl"
			marker={2}
			at={[200, RIM_Y - 32]}
			opacity={fLabels.current}
		>
			<Label
				x={200}
				y={RIM_Y - 28}
				text="bowl"
				anchor="middle"
				weight={700}
				opacity={fLabels.current * (showPourer ? 0 : 1)}
			/>
		</Readout>
		<Readout
			id="kBend"
			order={3}
			label="The bend"
			marker={3}
			at={[436, topC - b / 2 - 16]}
			opacity={fLabels.current}
		>
			<Label
				x={436}
				y={topC - b / 2 - 12}
				text="the hump of the bend"
				anchor="middle"
				weight={700}
				opacity={fLabels.current}
			/>
		</Readout>
		<Readout
			id="kSeal"
			order={4}
			label="Water seal"
			marker={4}
			at={[240, INLET_TOP + 2]}
			opacity={fLabels.current}
		>
			<Label
				x={240}
				y={INLET_TOP + 6}
				text="water seal"
				anchor="middle"
				opacity={fLabels.current}
			/>
		</Readout>
	{/if}
	<Readout id="kDrain">
		<Label
			x={BEND_X + b / 2 + 12}
			y={FLOOR + 24}
			anchor="start"
			text="to the drain"
			weight={600}
			opacity={0.4 + 0.6 * fLabels.current}
		/>
	</Readout>
	{#if phase === 'flush' || phase === 'refill'}
		<Readout id="kParts">
			<Label x={404} y={78} text="lever" anchor="end" muted />
			<Label x={468} y={196} text="flapper" anchor="end" muted />
			<Label x={700} y={floatY + 4} text="float" anchor="start" weight={700} />
			<Label x={615} y={yT(WATER_LINE) - 7} text="water line" size={11} anchor="middle" muted />
			<Label x={574} y={188} text="overflow pipe" size={11} anchor="start" muted />
		</Readout>
	{/if}

	<!-- ============================================================ the read-out card -->
	<g>
		<Readout id="card">
			<rect
				x="600"
				y="262"
				width="344"
				height="136"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
				stroke-width="1"
			/>
		</Readout>
		<Readout id="status" order={0} label="Now" value={status}>
			<Label x={616} y={290} text={status} size={16} weight={700} anchor="start" halo={false} />
		</Readout>
		{#each rows as r, i (r.id)}
			<Readout
				id={r.id}
				order={20 + i}
				label={r.id === 'gone' ? undefined : r.label}
				value={r.value}
			>
				<Label
					x={616}
					y={318 + i * 22}
					text="{r.label.toLowerCase()}: {r.value}"
					anchor="start"
					size={13}
					tabular
					halo={false}
				/>
			</Readout>
		{/each}
	</g>
</g>
