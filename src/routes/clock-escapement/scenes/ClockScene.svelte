<script lang="ts">
	/**
	 * A grandfather clock with its door open, and a close-up of its escapement. On the left, the
	 * case: the face with its hands, the weight on its cord, the pendulum swinging from its pivot. In
	 * the middle, the escape wheel and the anchor seen close up: the anchor rocks with the pendulum
	 * and its two pallets take turns catching the wheel's teeth. On the right, a stopwatch counts
	 * real seconds against the clock's ticks.
	 *
	 * Everything that moves comes from the simulated clock (`../model`): the pendulum's angle, the
	 * wheel's position, the ticks and the pushes. The clock is advanced frame by frame (the scene
	 * guide's sanctioned accumulator: the pendulum is the integral of a motion that the controls
	 * change), from a fresh start at each step. Under reduced motion it is run afresh to the frozen
	 * time whenever a control changes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Clock,
		DEFAULT_WEIGHT,
		SECONDS_LENGTH,
		SINK_PER_TURN,
		TEETH,
		deg,
		gainPerDay,
		settledSwing,
		ticksPerMinute,
		type Settings
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'clock'));
	const settings = $derived.by((): Settings => ({
		length: phase === 'length' ? Number(params.length ?? 99) / 100 : SECONDS_LENGTH,
		weight: phase === 'weight' ? Number(params.weight ?? DEFAULT_WEIGHT) : DEFAULT_WEIGHT,
		anchor: phase === 'runaway' ? params.anchor === true : true,
		driven: phase === 'push' ? params.unhook !== true : true
	}));
	const slow = $derived(phase === 'catch' && params.slow === true);
	const rate = $derived(slow ? 0.1 : 1);

	// ---- the simulated clock (frame-to-frame accumulator) ------------------------------------
	let clock = new Clock(untrack(() => settings));
	let simT = 0;
	let lastT = 0;
	let key = '';
	let last: Settings = untrack(() => settings);
	const sim = $derived.by(() => {
		const s = settings;
		const k = reduced ? `${phase}:${rate}:${JSON.stringify(s)}` : phase;
		if (k !== key || t < lastT - 1e-6) {
			key = k;
			clock = new Clock(s);
			simT = 0;
			lastT = 0;
		} else if (JSON.stringify(s) !== JSON.stringify(last)) clock.set(s, true);
		last = s;
		const dt = t - lastT;
		if (dt > 0) simT += dt * rate;
		lastT = t;
		return { ...clock.run(simT), now: simT };
	});

	// ---- layout -------------------------------------------------------------------------------
	/** The face, the pendulum's pivot and its scale (px per metre), the weight's pulley. */
	const FX = 230;
	const FY = 112;
	const FR = 76;
	const PX = 230;
	const PY = 214;
	const PS = 345;
	const WX = 336;
	/** The close-up: the escape wheel's centre and the tips of its teeth, and the anchor's pivot. */
	const CX = 600;
	const CY = 372;
	const R = 150;
	const AY = CY - R * Math.SQRT2;
	const INSET = { x: 440, y: 16, w: 320, h: 392 };
	const PITCH = 360 / TEETH;
	/** The tooth that is caught by the left pallet when the wheel is at 0. */
	const LOCK = -47;

	const rad = (a: number) => (a * Math.PI) / 180;
	const onWheel = (a: number, r: number) => ({
		x: CX + r * Math.sin(rad(a)),
		y: CY - r * Math.cos(rad(a))
	});
	const f1 = (v: number) => v.toFixed(1);
	const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' ');

	/** The escape wheel's outline: teeth leaning forward (the wheel turns clockwise). */
	const wheelPath = (() => {
		let d = '';
		for (let k = 0; k < TEETH; k++) {
			const a = k * PITCH;
			const tip = onWheel(a, R);
			const front = onWheel(a + 1.5, R - 20);
			const back = onWheel(a - PITCH + 1.5, R - 20);
			d += `${k === 0 ? 'M' : 'L'}${f1(back.x)},${f1(back.y)} L${f1(tip.x)},${f1(tip.y)} L${f1(front.x)},${f1(front.y)} `;
		}
		// The rim's inner edge, so the spokes show through.
		const r = R - 34;
		return `${d}Z M${CX - r},${CY} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
	})();
	/** Spokes of the wheel, from the hub to the rim, drawn inside the clip. */
	const spokes = [0, 90, 180, 270].map((a) => ({ a, p: onWheel(a, R - 30) }));

	/**
	 * The two pallets, drawn with the anchor upright; the whole anchor then rocks with the pendulum
	 * about its pivot. Each covers the 5° a tooth slides across while it pushes, its locking face on
	 * the side the teeth come from, its end slanted.
	 */
	const pallet = (from: number) => {
		const to = from + 5;
		return pts([
			onWheel(from, R + 34),
			onWheel(from, R - 4),
			onWheel(to, R + 4),
			onWheel(to, R + 34)
		]);
	};
	const leftPallet = pallet(LOCK);
	const rightPallet = pallet(LOCK + 90);
	const armL = onWheel(LOCK + 2.5, R + 30);
	const armR = onWheel(LOCK + 92.5, R + 30);

	// ---- what moves ---------------------------------------------------------------------------
	const anchorOn = new Tween(
		untrack(() => (settings.anchor ? 1 : 0)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const on = settings.anchor ? 1 : 0;
		untrack(() => void anchorOn.set(on, reduced ? { duration: 0 } : undefined));
	});
	const hookOn = new Tween(
		untrack(() => (settings.driven ? 1 : 0)),
		{ duration: 600, easing: cubicInOut }
	);
	$effect(() => {
		const on = settings.driven ? 1 : 0;
		untrack(() => void hookOn.set(on, reduced ? { duration: 0 } : undefined));
	});
	const theta = $derived(sim.theta * anchorOn.current);
	/** SVG rotation of the pendulum and anchor: the bob to the right turns them anticlockwise. */
	const rot = $derived(-deg(theta));
	const wheelAngle = $derived(LOCK + sim.wheel * PITCH);
	/** Turns a second of the escape wheel when it runs free. */
	const turnsPerSecond = $derived(sim.spin / TEETH);
	const blur = $derived(Math.min(1, Math.max(0, (turnsPerSecond - 1) / 4)));
	const sinceTick = $derived(sim.now - sim.lastTick);
	/** The "tick" flash fades over a quarter of a second of clock time. */
	const tickFlash = $derived(sinceTick < 0.25 ? 1 - sinceTick / 0.25 : 0);
	const ticksText = $derived(`${sim.ticks} tick${sim.ticks === 1 ? '' : 's'}`);
	const pushDir = $derived(Math.sign(sim.omega) || 1);

	// The face: the second hand is on the escape wheel's arbor; the clock starts at 10:08.
	const turns = $derived(sim.wheel / TEETH);
	const secondHand = $derived(turns * 360);
	const minuteHand = $derived(((8 + turns) / 60) * 360);
	const hourHand = $derived(((10 + (8 + turns) / 60) / 12) * 360);
	const hand = (a: number, r: number) => ({
		x: FX + r * Math.sin(rad(a)),
		y: FY - r * Math.cos(rad(a))
	});
	const hh = $derived(hand(hourHand, 38));
	const mh = $derived(hand(minuteHand, 56));
	const sh = $derived(hand(secondHand, 62));

	// The weight: it sinks as the wheels turn.
	const kg = $derived(settings.weight);
	const wH = $derived(40 + 8 * kg);
	const wW = $derived(30 + 1.5 * kg);
	const wTop = $derived(232 + Math.min(120, turns * SINK_PER_TURN * 300));
	const length = $derived(settings.length);
	const bob = $derived({ x: PX, y: PY + PS * length });
	const swingNow = $derived(settledSwing(settings.weight, settings.length));

	// The stopwatch counts whole seconds of (simulated) time.
	const SWX = 862;
	const SWY = 104;
	const SWR = 62;
	const seconds = $derived(Math.floor(sim.now + 1e-9));

	// ---- what each step says -------------------------------------------------------------------
	const focus = $derived.by(() => {
		switch (phase) {
			case 'runaway':
				return { case: 0.55, inset: 1, watch: 0.5 };
			case 'catch':
				return { case: 0.45, inset: 1, watch: 0.45 };
			case 'length':
			case 'weight':
				return { case: 1, inset: 0.5, watch: 1 };
			default:
				return { case: 1, inset: 1, watch: 1 };
		}
	});
	const fCase = Tween.of(() => focus.case, { duration: 700 });
	const fInset = Tween.of(() => focus.inset, { duration: 700 });
	const fWatch = Tween.of(() => focus.watch, { duration: 700 });

	const tpm = $derived(ticksPerMinute(settings.length, swingNow));
	const ratio = $derived(tpm / 60);
	const ratioText = $derived(
		Math.abs(ratio - 1) < 0.02
			? 'in step with the stopwatch'
			: `${ratio.toFixed(1)} times as fast as the stopwatch`
	);
	/** A gain or loss a day, rounded to what a reader would say. */
	function perDay(s: number): string {
		const a = Math.abs(s);
		if (a < 90) return `${Math.round(a)} seconds`;
		if (a < 90 * 60) return `${Math.round(a / 60)} minutes`;
		return `${Math.round(a / 3600)} hours`;
	}
	const gain = $derived(gainPerDay(settings.length, swingNow));
	const lengthNote = $derived(
		Math.abs(gain) < 30
			? 'right to within seconds a day'
			: `${gain > 0 ? 'gains' : 'loses'} about ${perDay(gain)} a day`
	);
	const weightDiff = $derived(
		gainPerDay(SECONDS_LENGTH, swingNow) -
			gainPerDay(SECONDS_LENGTH, settledSwing(DEFAULT_WEIGHT, SECONDS_LENGTH))
	);
	const weightNote = $derived(
		kg === DEFAULT_WEIGHT
			? `the ${DEFAULT_WEIGHT} kg weight the page started with`
			: `${weightDiff > 0 ? 'gains' : 'loses'} ${perDay(weightDiff)} a day against ${DEFAULT_WEIGHT} kg`
	);
	const catchNote = $derived(
		tickFlash > 0
			? 'tick: the other pallet catches the next tooth'
			: sim.kicking
				? 'let go: the tooth slides off, pushing the pallet'
				: 'caught: the wheel stands still'
	);
	const runNote = $derived(
		settings.anchor
			? 'escape wheel: one turn a minute, step by step'
			: `escape wheel: about ${Math.round(turnsPerSecond)} turns a second`
	);
	const handsNote = $derived(
		settings.anchor ? 'hands: telling the time' : 'hands: racing, an hour every 3 seconds'
	);
	const pushNote = $derived(
		settings.driven
			? 'each tick, a tiny push keeps the pendulum swinging'
			: 'no weight: no ticks, the hands stand still'
	);
</script>

<g>
	<defs>
		<clipPath id="clock-escapement-inset">
			<rect x={INSET.x} y={INSET.y} width={INSET.w} height={INSET.h} rx="14" />
		</clipPath>
	</defs>

	<!-- ============================================================ the clock -->
	<g opacity={fCase.current}>
		<rect
			x="62"
			y="16"
			width="336"
			height="568"
			rx="14"
			fill="var(--ce-case)"
			stroke="var(--ce-case-edge)"
			stroke-width="1.5"
		/>
		<!-- the face -->
		<circle
			cx={FX}
			cy={FY}
			r={FR}
			fill="var(--ce-face)"
			stroke="var(--ce-face-edge)"
			stroke-width="2.5"
		/>
		{#each Array.from({ length: 60 }, (_, k) => k) as k (k)}
			{@const a = hand(k * 6, FR - 6)}
			{@const b = hand(k * 6, k % 5 === 0 ? FR - 16 : FR - 10)}
			<line
				x1={a.x}
				y1={a.y}
				x2={b.x}
				y2={b.y}
				stroke="var(--ce-hand)"
				stroke-width={k % 5 === 0 ? 2.5 : 1}
			/>
		{/each}
		<line
			x1={FX}
			y1={FY}
			x2={hh.x}
			y2={hh.y}
			stroke="var(--ce-hand)"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<line
			x1={FX}
			y1={FY}
			x2={mh.x}
			y2={mh.y}
			stroke="var(--ce-hand)"
			stroke-width="4"
			stroke-linecap="round"
		/>
		<line
			x1={FX}
			y1={FY}
			x2={sh.x}
			y2={sh.y}
			stroke="var(--ce-second)"
			stroke-width="2"
			stroke-linecap="round"
			opacity={1 - 0.7 * blur}
		/>
		<circle cx={FX} cy={FY} r="5" fill="var(--ce-second)" />

		<!-- the wheels behind the face: a little escape wheel, seen close up on the right -->
		<circle
			cx={PX}
			cy={PY - 14}
			r="12"
			fill="var(--ce-brass)"
			stroke="var(--ce-brass-edge)"
			stroke-width="1.5"
		/>
		<circle
			cx={PX}
			cy={PY - 14}
			r="18"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			stroke-dasharray="3 3"
			opacity={fInset.current}
		/>

		<!-- the weight on its cord -->
		<circle cx={WX} cy={PY - 14} r="9" fill="var(--ce-brass)" stroke="var(--ce-brass-edge)" />
		<line
			x1={WX + 9}
			y1={PY - 14}
			x2={WX + 9}
			y2={wTop}
			stroke="var(--ce-cord)"
			stroke-width="1.5"
		/>
		<g opacity={hookOn.current}>
			<rect
				x={WX + 9 - wW / 2}
				y={wTop}
				width={wW}
				height={wH}
				rx="5"
				fill="var(--ce-weight)"
				stroke="var(--ce-weight-edge)"
				stroke-width="1.5"
			/>
			<Readout id="weight" order={20} label="Weight" value="{kg} kg" opacity={hookOn.current}>
				<Label x={WX + 9} y={wTop + wH + 18} text="{kg} kg" size={14} weight={600} />
			</Readout>
		</g>
		{#if !settings.driven}
			<Readout id="noWeight" order={20} label="Weight" value="taken off">
				<Label x={WX + 9} y={wTop + 18} text="weight off" size={13} weight={600} />
			</Readout>
		{/if}

		<!-- the pendulum -->
		<g opacity={anchorOn.current}>
			{#if phase === 'weight' || phase === 'length'}
				<!-- how far it swings each side -->
				{#each [-1, 1] as s (s)}
					{@const e = {
						x: PX + PS * length * Math.sin(s * swingNow),
						y: PY + PS * length * Math.cos(swingNow)
					}}
					<line
						x1={PX}
						y1={PY}
						x2={e.x}
						y2={e.y}
						stroke="var(--stage-ink-muted)"
						stroke-width="1"
						stroke-dasharray="4 4"
					/>
				{/each}
			{/if}
			<g transform="rotate({f1(rot * 1)} {PX} {PY})">
				<line x1={PX} y1={PY} x2={PX} y2={bob.y} stroke="var(--ce-brass-edge)" stroke-width="3" />
				<circle
					cx={PX}
					cy={bob.y}
					r={length > 0.5 ? 22 : 16}
					fill="var(--ce-brass)"
					stroke="var(--ce-brass-edge)"
					stroke-width="2"
				/>
			</g>
			<circle cx={PX} cy={PY} r="4" fill="var(--ce-anchor)" />
			{#if sim.kicking && (phase === 'push' || phase === 'clock' || phase === 'catch')}
				{@const bx = PX + PS * length * Math.sin(theta)}
				{@const by = PY + PS * length * Math.cos(theta)}
				<line
					x1={bx + pushDir * 26}
					y1={by}
					x2={bx + pushDir * 60}
					y2={by}
					stroke="var(--ce-push)"
					stroke-width="4"
					marker-end="url(#arrowhead)"
					color="var(--ce-push)"
				/>
				<Readout id="pushLabel">
					<Label
						x={bx + pushDir * 44}
						y={by - 14}
						text="push"
						color="var(--ce-push)"
						weight={700}
					/>
				</Readout>
			{/if}
		</g>
	</g>

	{#if phase === 'clock'}
		<Readout id="kWeight" order={1} label="The weight" value="drives the wheels">
			<Label x={WX + 9} y={wTop + wH + 42} text="the weight:" anchor="middle" weight={700} />
			<Label x={WX + 9} y={wTop + wH + 58} text="drives the clock" anchor="middle" />
		</Readout>
		<Readout id="kPend" order={2} label="The pendulum" value="keeps the time">
			<Label x={PX - 40} y={bob.y - 48} text="the pendulum:" anchor="end" weight={700} />
			<Label x={PX - 40} y={bob.y - 32} text="keeps the time" anchor="end" />
		</Readout>
	{/if}

	<!-- ============================================================ the close-up -->
	<g opacity={fInset.current}>
		<rect
			x={INSET.x}
			y={INSET.y}
			width={INSET.w}
			height={INSET.h}
			rx="14"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<g clip-path="url(#clock-escapement-inset)">
			<!-- the escape wheel -->
			<g transform="rotate({f1(wheelAngle * 1)} {CX} {CY})">
				{#each spokes as s (s.a)}
					<line
						x1={CX}
						y1={CY}
						x2={s.p.x}
						y2={s.p.y}
						stroke="var(--ce-brass-edge)"
						stroke-width="6"
					/>
				{/each}
				<circle
					cx={CX}
					cy={CY}
					r={R - 30}
					fill="none"
					stroke="var(--ce-brass-edge)"
					stroke-width="6"
				/>
				<path
					d={wheelPath}
					fill-rule="evenodd"
					fill="var(--ce-brass)"
					fill-opacity={1 - 0.6 * blur}
					stroke="var(--ce-brass-edge)"
					stroke-width="1.5"
					stroke-opacity={1 - 0.6 * blur}
				/>
			</g>
			<circle
				cx={CX}
				cy={CY}
				r={R - 10}
				fill="none"
				stroke="var(--ce-blur)"
				stroke-width="22"
				opacity={blur}
			/>
			<!-- the anchor, rocking with the pendulum -->
			<g opacity={anchorOn.current} transform="rotate({f1(rot * 1)} {CX} {AY})">
				<line
					x1={CX}
					y1={AY}
					x2={CX}
					y2={INSET.y + INSET.h}
					stroke="var(--ce-brass-edge)"
					stroke-width="5"
				/>
				<polyline
					points={pts([armL, { x: CX, y: AY }, armR])}
					fill="none"
					stroke="var(--ce-anchor)"
					stroke-width="12"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
				<polygon
					points={leftPallet}
					fill="var(--ce-anchor)"
					stroke="var(--ce-anchor-edge)"
					stroke-width="1.5"
				/>
				<polygon
					points={rightPallet}
					fill="var(--ce-anchor)"
					stroke="var(--ce-anchor-edge)"
					stroke-width="1.5"
				/>
				<circle cx={CX} cy={AY} r="7" fill="var(--ce-anchor-edge)" />
			</g>
		</g>
		<Label x={INSET.x + 16} y={INSET.y + 26} text="close up" anchor="start" muted size={12} />
		{#if settings.anchor}
			{@const p = { x: CX + sim.lastTickSide * 125, y: 262 }}
			<Readout id="tick">
				<Label
					x={p.x}
					y={p.y}
					text="tick!"
					size={18}
					weight={800}
					color="var(--ce-tick)"
					opacity={tickFlash}
				/>
			</Readout>
		{/if}
		{#if phase === 'runaway' || phase === 'catch'}
			<Readout
				id="anchorLabel"
				order={4}
				label="Anchor"
				value={settings.anchor ? 'fitted' : 'taken out'}
			>
				<Label
					x={CX}
					y={AY - 16}
					text={settings.anchor ? 'the anchor' : 'no anchor'}
					weight={700}
					opacity={phase === 'catch' ? 1 : 0.9}
				/>
			</Readout>
			<Readout id="wheelLabel" order={5} label="Escape wheel" value="30 teeth">
				<Label x={CX} y={CY - 70} text="escape wheel" weight={700} />
			</Readout>
		{/if}
		{#if phase === 'catch'}
			<Readout id="palletL">
				<Label
					x={onWheel(LOCK, R + 40).x - 8}
					y={onWheel(LOCK, R + 40).y}
					text="pallet"
					anchor="end"
					muted
				/>
			</Readout>
			<Readout id="palletR">
				<Label
					x={onWheel(LOCK + 95, R + 40).x + 8}
					y={onWheel(LOCK + 95, R + 40).y}
					text="pallet"
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	</g>

	<!-- ============================================================ the stopwatch -->
	<g opacity={fWatch.current}>
		<circle
			cx={SWX}
			cy={SWY}
			r={SWR}
			fill="var(--surface)"
			stroke="var(--ce-watch)"
			stroke-width="3"
		/>
		<rect x={SWX - 8} y={SWY - SWR - 12} width="16" height="10" rx="3" fill="var(--ce-watch)" />
		{#each Array.from({ length: 12 }, (_, k) => k) as k (k)}
			{@const a = rad(k * 30)}
			<line
				x1={SWX + (SWR - 5) * Math.sin(a)}
				y1={SWY - (SWR - 5) * Math.cos(a)}
				x2={SWX + (SWR - 13) * Math.sin(a)}
				y2={SWY - (SWR - 13) * Math.cos(a)}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
			/>
		{/each}
		<line
			x1={SWX}
			y1={SWY}
			x2={SWX + (SWR - 10) * Math.sin(rad(seconds * 6))}
			y2={SWY - (SWR - 10) * Math.cos(rad(seconds * 6))}
			stroke="var(--ce-watch)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={SWX} cy={SWY} r="5" fill="var(--ce-watch)" />
		<Label x={SWX} y={SWY + SWR + 22} text="stopwatch" muted size={12} />
		<Readout id="seconds" order={1} label="Stopwatch" value="{seconds} s">
			<Label
				x={SWX}
				y={SWY + SWR + 50}
				text="{seconds} seconds"
				size={16}
				weight={700}
				tabular
				color="var(--ce-watch)"
			/>
		</Readout>
		<Readout id="ticks" order={2} label="The clock" value={ticksText}>
			<Label
				x={SWX}
				y={SWY + SWR + 74}
				text={ticksText}
				size={16}
				weight={700}
				tabular
				color="var(--ce-tick)"
			/>
		</Readout>
		{#if slow}
			<Label x={SWX} y={SWY + SWR + 98} text="slow motion: 10 times slower" muted size={12} />
		{/if}
	</g>

	<!-- ============================================================ the step's readouts -->
	<g>
		{#if phase === 'runaway'}
			<Readout
				id="run"
				order={6}
				label="Escape wheel"
				value={runNote.replace('escape wheel: ', '')}
			>
				<Label x={692} y={448} text={runNote} size={15} weight={600} />
			</Readout>
			<Readout id="hands" order={7} label="Hands" value={handsNote.replace('hands: ', '')}>
				<Label x={692} y={476} text={handsNote} size={15} />
			</Readout>
		{:else if phase === 'catch'}
			<Readout id="catch" order={6} label="Now" value={catchNote}>
				<Label x={692} y={448} text={catchNote} size={15} weight={600} />
			</Readout>
			<Readout id="half" order={7} label="Each swing" value="the wheel moves on half a tooth">
				<Label x={692} y={476} text="each swing: the wheel moves on half a tooth" size={13} muted />
			</Readout>
		{:else if phase === 'push'}
			<Readout id="push" order={6} label="The weight" value={pushNote}>
				<Label x={692} y={448} text={pushNote} size={15} weight={600} />
			</Readout>
			{#if !settings.driven}
				<Readout id="swings" order={7} label="The pendulum" value="swings on, slowly dying away">
					<Label x={692} y={476} text="the pendulum swings on, slowly dying away" size={13} muted />
				</Readout>
			{/if}
		{:else if phase === 'length'}
			<Readout
				id="len"
				order={6}
				label="Pendulum"
				value="{Math.round(settings.length * 100)} cm long"
			>
				<Label
					x={PX + 34}
					y={bob.y + 6}
					text="{Math.round(settings.length * 100)} cm"
					anchor="start"
					size={14}
					weight={700}
				/>
			</Readout>
			<Readout id="tpm" order={7} label="Ticks a minute" value={String(Math.round(tpm))}>
				<Label x={692} y={448} text="{Math.round(tpm)} ticks a minute" size={16} weight={700} />
			</Readout>
			<Readout id="ratio" order={8} label="Against the stopwatch" value={ratioText}>
				<Label x={692} y={476} text={ratioText} size={14} />
			</Readout>
			<Readout id="day" order={9} label="The clock" value={lengthNote}>
				<Label x={692} y={502} text="the clock {lengthNote}" size={13} muted />
			</Readout>
		{:else if phase === 'weight'}
			<Readout id="swing" order={6} label="Swing" value="{f1(deg(swingNow))}° each side">
				<Label
					x={692}
					y={448}
					text="swing: {f1(deg(swingNow))}° each side"
					size={16}
					weight={700}
				/>
			</Readout>
			<Readout id="tpmW" order={7} label="Ticks a minute" value={String(Math.round(tpm))}>
				<Label x={692} y={476} text="still {Math.round(tpm)} ticks a minute" size={14} />
			</Readout>
			<Readout id="dayW" order={8} label="The clock" value={weightNote}>
				<Label x={692} y={502} text="the clock {weightNote}" size={13} muted />
			</Readout>
		{:else if phase === 'next'}
			<Readout id="sum1" order={6} label="The weight" value="drives">
				<Label
					x={692}
					y={448}
					text="the weight drives; the pendulum keeps time"
					size={15}
					weight={600}
				/>
			</Readout>
			<Readout id="sum2" order={7} label="The length" value="sets the time">
				<Label x={692} y={476} text="the length of the pendulum sets the time" size={14} />
			</Readout>
		{/if}
	</g>
</g>
