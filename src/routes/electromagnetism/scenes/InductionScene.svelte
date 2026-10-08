<script lang="ts">
	/**
	 * Induction, seen from the side at 25 px per cm: a pickup coil (2 cm radius,
	 * `params.turns` turns, 10 Ω with its meter) with a zero-centre meter and a
	 * trace of its current over the last 8 s.
	 *
	 * Phases (`step.hints.phase`):
	 *   magnet — a 4 cm, 1.2 T bar magnet (north pole to the right) on the
	 *            coil's axis. `params.motion` 'swing': it swings through the
	 *            coil and back (`swing`, top speed `params.speed`), a pure
	 *            function of t. 'hand': the reader drags it (or uses the arrow
	 *            keys); its position is `params['em:magnetZ']` (m).
	 *   coils  — coil A, `params.gap` cm to the left (500 turns), carries 2 A
	 *            alternating at `params.acFreq` Hz (0 = steady), or, with
	 *            `params.drive` 'hand', the current the reader sets with
	 *            `params.currentA`; the meter shows the current induced in the
	 *            pickup (−M dI/dt, `neighbour`).
	 *
	 * The current is emf / R with emf = −dΦ/dt from the model (`linkageTable`).
	 * Around the coil, the induced electric field (dashed) and the induced
	 * current's direction (⊙ out of the page, ⊗ into it) and poles (Lenz).
	 *
	 * Sanctioned exception (scene guide): when the reader drives the change, the
	 * magnet's speed (or the rate of change of coil A's current) is the
	 * frame-to-frame change of its position (current) over the change of t, smoothed
	 * over ~0.08 s, and the trace is a short history of those values. Both
	 * ignore dt ≤ 0 (pause, step reset) and stay still under reduced motion
	 * (t is frozen there, so the hand-moved magnet induces nothing; the swing
	 * mode shows the full pulses).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp } from '#lib/draw/index.ts';
	import { startDrag } from '#lib/draw/pointer.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { PICKUP, R_PICKUP, linkageTable, neighbour, swing } from '../em';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const S = 2500; // px per metre
	const AX = 175; // y of the axis
	const CX = 480; // x of the pickup coil's centre
	const ZMAX = 0.14; // how far the magnet can be dragged, m
	const WIN = 8; // s of trace
	const PLOT = { x0: 110, x1: 900, top: 450, bottom: 560 };
	const METER = { x: 480, y: 392, r: 74 };
	const I0 = 2; // A in coil A

	const phase = $derived(String(step.hints?.phase ?? 'magnet'));
	const isMagnet = $derived(phase === 'magnet');
	const turns = $derived(Number(params.turns ?? 200));
	const hand = $derived(isMagnet && String(params.motion ?? 'swing') === 'hand');
	const setA = $derived(!isMagnet && String(params.drive ?? 'ac') === 'hand');
	/** The reader drives the change (drags the magnet or coil A's current). */
	const manual = $derived(hand || setA);
	const vMax = $derived(Number(params.speed ?? 0.3));
	const f = $derived(Number(params.acFreq ?? 1));
	const gapCm = $derived(Number(params.gap ?? 4));
	const table = $derived(linkageTable(turns));
	/** Mutual inductance of coil A and the pickup (H), for the pickup's turns. */
	const M = $derived((neighbour(0, 0, gapCm / 100).M * turns) / PICKUP.turns);
	const unit = $derived(isMagnet ? 'mA' : 'µA');
	const toUnit = $derived(isMagnet ? 1e3 : 1e6);
	// Meter range: the smallest round range that holds the predicted peak (a fixed
	// range while the reader drives the change by hand).
	const peakSlope = $derived.by(() => {
		let m = 0;
		for (let z = -0.06; z <= 0.06; z += 0.001) m = Math.max(m, Math.abs(table.slope(z)));
		return m;
	});
	const SCALE = $derived.by(() => {
		if (isMagnet) {
			if (hand) return 40;
			const peak = ((peakSlope * vMax) / R_PICKUP) * 1e3;
			return [10, 20, 40, 100].find((r) => r >= peak * 1.1) ?? 100;
		}
		if (setA) return 200;
		const peak = ((M * I0 * 2 * Math.PI * f) / R_PICKUP) * 1e6;
		return [100, 200, 500, 1000, 2000].find((r) => r >= peak * 1.1) ?? 2000;
	});

	// ---- what the reader moves -----------------------------------------------------------------
	const zHand = $derived(clamp(Number(params['em:magnetZ'] ?? -0.1), -ZMAX, ZMAX));
	const aHand = $derived(clamp(Number(params.currentA ?? 0), -I0, I0));
	// Moving coil A's current slider while it alternates switches to setting it by hand.
	let seenA = untrack(() => params.currentA);
	$effect(() => {
		const v = params.currentA;
		if (v === seenA) return;
		seenA = v;
		untrack(() => {
			if (!isMagnet && !setA) setParam('drive', 'hand');
		});
	});
	// Reduced motion: a frozen frame just as the magnet enters the coil (or 6.2 s
	// into the alternating current), so the still picture shows a pulse.
	const tau = $derived(
		reduced ? (isMagnet ? (Math.acos(0.2) + 6 * Math.PI) / (vMax / 0.1) : 6.2) : t
	);

	// By hand: the rate of change from frame-to-frame motion (see header), and a
	// history for the trace.
	let last = { t: -1, x: 0, rate: 0 };
	let history: { t: number; I: number; a: number }[] = [];
	const rate = $derived.by(() => {
		const x = hand ? zHand : aHand;
		if (!manual) {
			last = { t: -1, x, rate: 0 };
			history = [];
			return 0;
		}
		const now = t;
		if (last.t < 0 || now < last.t) {
			last = { t: now, x, rate: 0 };
			history = [];
			return 0;
		}
		const dt = now - last.t;
		if (dt <= 0 || reduced) return last.rate;
		const raw = dt > 0.5 ? 0 : (x - last.x) / dt;
		const r = last.rate + (raw - last.rate) * Math.min(1, dt / 0.08);
		last = { t: now, x, rate: Math.abs(r) < 1e-4 ? 0 : r };
		const emf = hand ? -table.slope(x) * last.rate : -M * last.rate;
		history.push({ t: now, I: emf / R_PICKUP, a: hand ? 0 : x });
		while (history.length && history[0].t < now - WIN) history.shift();
		return last.rate;
	});

	const sim = $derived.by(() => {
		if (setA) {
			const r = rate;
			return { z: 0, v: 0, I1: aHand, emf: -M * r };
		}
		if (!isMagnet) {
			const n = neighbour(tau, f, gapCm / 100, I0);
			return { z: 0, v: 0, I1: n.I1, emf: (n.emf * turns) / PICKUP.turns };
		}
		if (hand) {
			const v = rate;
			return { z: zHand, v, I1: 0, emf: -table.slope(zHand) * v };
		}
		const s = swing(tau, vMax);
		return { z: s.z, v: s.v, I1: 0, emf: -table.slope(s.z) * s.v };
	});
	const I = $derived(sim.emf / R_PICKUP);
	const Iu = $derived(I * toUnit);
	const level = $derived(clamp(Math.abs(Iu) / SCALE, 0, 1));

	// ---- trace -------------------------------------------------------------------------------------
	const sx = $derived((s: number) => PLOT.x1 - ((tau - s) / WIN) * (PLOT.x1 - PLOT.x0));
	const mid = (PLOT.top + PLOT.bottom) / 2;
	const half = (PLOT.bottom - PLOT.top) / 2 - 4;
	const sy = (v: number) => mid - clamp(v, -1.08, 1.08) * half;
	const currentAt = (s: number) => {
		if (!isMagnet) {
			const n = neighbour(s, f, gapCm / 100, I0);
			return { a: n.I1 / I0, b: (((n.emf * turns) / PICKUP.turns / R_PICKUP) * 1e6) / SCALE };
		}
		const w = swing(s, vMax);
		return { a: 0, b: (((-table.slope(w.z) * w.v) / R_PICKUP) * 1e3) / SCALE };
	};
	const traces = $derived.by(() => {
		let b = '';
		let a = '';
		if (manual) {
			void rate;
			history.forEach((h, i) => {
				const x = sx(h.t).toFixed(1);
				b += `${i ? 'L' : 'M'}${x} ${sy((h.I * toUnit) / SCALE).toFixed(1)}`;
				if (setA) a += `${i ? 'L' : 'M'}${x} ${sy(h.a / I0).toFixed(1)}`;
			});
			return { a, b, n: history.length };
		}
		const start = Math.max(0, tau - WIN);
		const n = 240;
		for (let i = 0; i <= n; i++) {
			const s = start + ((tau - start) * i) / n;
			const c = currentAt(s);
			b += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(c.b).toFixed(1)}`;
			if (!isMagnet) a += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(c.a).toFixed(1)}`;
		}
		return { a, b, n };
	});

	// ---- drawing ------------------------------------------------------------------------------------
	const COIL_R = PICKUP.a * S; // 50 px
	const COIL_L = 36;
	const coilA_x = $derived(CX - gapCm * 25);
	const magX = $derived(CX + sim.z * S);
	const MAG = { w: 0.04 * S, h: 26 };

	// Induced current direction: + emf circulates the right-hand way about +z
	// (to the right): out of the page at the top (⊙), into it at the bottom.
	const showInduced = $derived(level > 0.04);
	const dirSign = $derived(Math.sign(sim.emf));
	// Its own field points −z (left) for a negative emf: north face on the left.
	const leftPole = $derived(dirSign < 0 ? 'N' : 'S');
	const rightPole = $derived(dirSign < 0 ? 'S' : 'N');

	// Meter needle (zero in the middle, ±60°).
	const needle = $derived(clamp(Iu / SCALE, -1.05, 1.05) * (Math.PI / 3));

	// ---- interaction: drag the magnet ----------------------------------------------------------------
	let dragging = $state(false);
	function grab(event: PointerEvent) {
		if (!isMagnet) return;
		const z0 = sim.z;
		let first: number | null = null;
		dragging = true;
		if (!hand) setParam('motion', 'hand');
		startDrag(
			event,
			(p) => {
				if (first === null) first = p.x;
				setParam(
					'em:magnetZ',
					Math.round(clamp(z0 + (p.x - first) / S, -ZMAX, ZMAX) * 2000) / 2000
				);
			},
			() => (dragging = false)
		);
	}
	function onkeydown(event: KeyboardEvent) {
		const big = event.shiftKey ? 0.02 : 0.005;
		const d: Record<string, number> = {
			ArrowLeft: -big,
			ArrowDown: -big,
			ArrowRight: big,
			ArrowUp: big
		};
		if (d[event.key] === undefined) return;
		event.preventDefault();
		if (!hand) setParam('motion', 'hand');
		setParam('em:magnetZ', clamp((hand ? zHand : sim.z) + d[event.key], -ZMAX, ZMAX));
	}

	// ---- cross-fade between phases ----------------------------------------------------------------------
	const mOn = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const v = isMagnet ? 1 : 0;
		untrack(() => mOn.set(v, { duration: reduced ? 0 : 600 }));
	});

	const fmt = (v: number) => {
		const a = Math.abs(v);
		return `${v < 0 && a >= 0.05 ? '−' : ''}${a >= 10 ? a.toFixed(0) : a.toFixed(1)} ${unit}`;
	};
	const cards = $derived(
		isMagnet
			? [
					{ id: 'v', label: 'magnet’s speed', value: `${Math.abs(sim.v).toFixed(2)} m/s` },
					{
						id: 'e',
						label: 'voltage induced',
						value: `${(Math.abs(sim.emf) * 1000).toFixed(0)} mV`,
						color: 'var(--em-field)'
					},
					{ id: 'i', label: 'current', value: fmt(Iu), color: 'var(--em-current)' }
				]
			: [
					{
						id: 'a',
						label: 'current in coil A',
						value: `${sim.I1.toFixed(2)} A`,
						color: 'var(--em-drive)'
					},
					{
						id: 'e',
						label: 'voltage induced in B',
						value: `${(Math.abs(sim.emf) * 1000).toFixed(2)} mV`,
						color: 'var(--em-field)'
					},
					{ id: 'i', label: 'current in B', value: fmt(Iu), color: 'var(--em-current)' }
				]
	);
	const CARD = { x: 16, y: 16, w: 560, h: 66 };
	const ringXs = (x: number) =>
		Array.from({ length: 7 }, (_, i) => x - COIL_L / 2 + (i / 6) * COIL_L);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet dot(x: number, y: number, out: boolean, color: string, r = 6)}
	<circle cx={x} cy={y} {r} fill="var(--stage-bg)" stroke={color} stroke-width="1.6" />
	{#if out}
		<circle cx={x} cy={y} r="1.8" fill={color} />
	{:else}
		<path
			d="M{x - r * 0.5} {y - r * 0.5} L{x + r * 0.5} {y + r * 0.5} M{x + r * 0.5} {y -
				r * 0.5} L{x - r * 0.5} {y + r * 0.5}"
			stroke={color}
			stroke-width="1.6"
		/>
	{/if}
{/snippet}

{#snippet coil(x: number, color: string, part: 'back' | 'front')}
	{#each ringXs(x) as rx (rx)}
		<path
			d={part === 'back'
				? `M${rx} ${AX - COIL_R} A9 ${COIL_R} 0 0 0 ${rx} ${AX + COIL_R}`
				: `M${rx} ${AX - COIL_R} A9 ${COIL_R} 0 0 1 ${rx} ${AX + COIL_R}`}
			fill="none"
			stroke={color}
			stroke-width={part === 'back' ? 2 : 3}
			opacity={part === 'back' ? 0.45 : 1}
		/>
	{/each}
{/snippet}

<g>
	<line x1="60" x2="900" y1={AX} y2={AX} stroke="var(--stage-grid)" stroke-dasharray="6 6" />

	<!-- induced electric field circling the coil (dashed), strength ∝ emf -->
	{#if showInduced}
		<g opacity={0.25 + 0.75 * level}>
			<ellipse
				cx={CX}
				cy={AX}
				rx="16"
				ry={COIL_R + 26}
				fill="none"
				stroke="var(--em-field)"
				stroke-width="2"
				stroke-dasharray="5 5"
			/>
			{@render dot(CX, AX - COIL_R - 26, dirSign > 0, 'var(--em-field)', 7)}
			{@render dot(CX, AX + COIL_R + 26, dirSign < 0, 'var(--em-field)', 7)}
		</g>
	{/if}

	<!-- pickup coil, back half -->
	{@render coil(CX, 'var(--em-copper)', 'back')}

	<!-- the magnet -->
	{#if mOn.current > 0.01}
		<g
			opacity={mOn.current}
			class="magnet"
			class:dragging
			role="slider"
			tabindex={isMagnet ? 0 : -1}
			aria-label="Bar magnet: drag it, or use the arrow keys, to move it through the coil"
			aria-valuenow={Math.round(sim.z * 100)}
			aria-valuemin={-14}
			aria-valuemax={14}
			aria-valuetext="{(sim.z * 100).toFixed(1)} cm from the coil"
			onpointerdown={grab}
			{onkeydown}
		>
			<rect
				x={magX - MAG.w / 2 - 6}
				y={AX - MAG.h / 2 - 14}
				width={MAG.w + 12}
				height={MAG.h + 28}
				fill="transparent"
			/>
			<rect
				class="ring"
				x={magX - MAG.w / 2 - 4}
				y={AX - MAG.h / 2 - 4}
				width={MAG.w + 8}
				height={MAG.h + 8}
				rx="7"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
			/>
			<rect
				x={magX - MAG.w / 2}
				y={AX - MAG.h / 2}
				width={MAG.w / 2}
				height={MAG.h}
				rx="4"
				fill="var(--em-south)"
			/>
			<rect
				x={magX}
				y={AX - MAG.h / 2}
				width={MAG.w / 2}
				height={MAG.h}
				rx="4"
				fill="var(--em-north)"
			/>
			<text
				x={magX - MAG.w / 4}
				y={AX + 5}
				text-anchor="middle"
				font-weight="800"
				style:font-size="14px"
				style:fill="#fff">S</text
			>
			<text
				x={magX + MAG.w / 4}
				y={AX + 5}
				text-anchor="middle"
				font-weight="800"
				style:font-size="14px"
				style:fill="#fff">N</text
			>
		</g>
		{#if hand && Math.abs(sim.v) < 1e-3}
			{@render txt(magX, AX - MAG.h / 2 - 12, 'still: no current', 12, {
				anchor: 'middle',
				weight: 600,
				opacity: mOn.current
			})}
		{/if}
	{/if}

	<!-- coil A, its supply and its field -->
	{#if mOn.current < 0.99}
		<g opacity={1 - mOn.current}>
			<path
				d="M{coilA_x - 12} {AX + COIL_R} V{AX + COIL_R + 40} H{coilA_x - 110} V{AX + 30}"
				fill="none"
				stroke="var(--em-drive)"
				stroke-width="1.5"
			/>
			<path
				d="M{coilA_x + 12} {AX - COIL_R} V{AX - COIL_R - 20} H{coilA_x - 110} V{AX - 30}"
				fill="none"
				stroke="var(--em-drive)"
				stroke-width="1.5"
			/>
			{@render coil(coilA_x, 'var(--em-drive)', 'back')}
			{#if Math.abs(sim.I1) > 0.05}
				{@const len = (sim.I1 / I0) * 70}
				<line
					x1={coilA_x}
					x2={CX + len}
					y1={AX}
					y2={AX}
					stroke="var(--em-bfield)"
					stroke-width="3"
					opacity="0.8"
				/>
				<path
					d="M{CX + len + Math.sign(len) * 9} {AX} L{CX + len - Math.sign(len) * 3} {AX - 6} L{CX +
						len -
						Math.sign(len) * 3} {AX + 6} Z"
					fill="var(--em-bfield)"
				/>
			{/if}
			{@render coil(coilA_x, 'var(--em-drive)', 'front')}
			{@render txt(coilA_x - 22, AX + COIL_R + 22, 'coil A', 13, {
				anchor: 'end',
				weight: 700,
				color: 'var(--em-drive)'
			})}
			<circle
				cx={coilA_x - 110}
				cy={AX}
				r="30"
				fill="var(--surface)"
				stroke="var(--em-drive)"
				stroke-width="2"
			/>
			{#if setA}
				<text
					x={coilA_x - 110}
					y={AX + 7}
					text-anchor="middle"
					font-weight="700"
					style:font-size="20px"
					style:fill="var(--em-drive)">±</text
				>
			{:else}
				<path
					d="M{coilA_x - 126} {AX} q8 -14 16 0 t16 0"
					fill="none"
					stroke="var(--em-drive)"
					stroke-width="2.5"
				/>
			{/if}
			{@render txt(
				coilA_x - 110,
				AX + 52,
				setA
					? `you set it: ${aHand.toFixed(1)} A`
					: f === 0
						? 'steady 2 A'
						: `2 A, ${f.toFixed(2)} Hz`,
				11,
				{
					anchor: 'middle',
					muted: true
				}
			)}
		</g>
	{/if}

	<!-- pickup coil, front half, with the induced current's direction and poles -->
	{@render coil(CX, 'var(--em-copper)', 'front')}
	{#if showInduced}
		{@render dot(CX + COIL_L / 2 + 10, AX - COIL_R, dirSign > 0, 'var(--em-current)')}
		{@render dot(CX + COIL_L / 2 + 10, AX + COIL_R, dirSign < 0, 'var(--em-current)')}
		{#if isMagnet}
			{@render txt(CX - COIL_L / 2 - 12, AX - COIL_R - 6, leftPole, 15, {
				anchor: 'end',
				weight: 800,
				color: leftPole === 'N' ? 'var(--em-north)' : 'var(--em-south)'
			})}
			{@render txt(CX + COIL_L / 2 + 22, AX - COIL_R - 6, rightPole, 15, {
				anchor: 'start',
				weight: 800,
				color: rightPole === 'N' ? 'var(--em-north)' : 'var(--em-south)'
			})}
		{/if}
		{@render txt(CX + 40, AX - COIL_R - 34, 'induced electric field', 11, {
			color: 'var(--em-field)',
			weight: 600
		})}
	{/if}
	{@render txt(
		CX + 40,
		AX + COIL_R + 20,
		isMagnet ? `${turns} turns` : `coil B · ${turns} turns`,
		12,
		{
			anchor: 'start',
			weight: 600
		}
	)}

	<!-- leads to the meter -->
	<path
		d="M{CX - 8} {AX + COIL_R} V{METER.y - 100} H{METER.x - METER.r - 30} V{METER.y + 6}"
		fill="none"
		stroke="var(--em-copper)"
		stroke-width="1.5"
	/>
	<path
		d="M{CX + 8} {AX + COIL_R} V{METER.y - 100} H{METER.x + METER.r + 30} V{METER.y + 6}"
		fill="none"
		stroke="var(--em-copper)"
		stroke-width="1.5"
	/>

	<!-- zero-centre meter -->
	<g style:pointer-events="none">
		<path
			d="M{METER.x - METER.r - 14} {METER.y + 10} A{METER.r + 14} {METER.r + 14} 0 0 1 {METER.x +
				METER.r +
				14} {METER.y + 10} Z"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each [-1, -0.5, 0, 0.5, 1] as k (k)}
			{@const a = k * (Math.PI / 3)}
			<line
				x1={METER.x + Math.sin(a) * (METER.r - 8)}
				y1={METER.y - Math.cos(a) * (METER.r - 8)}
				x2={METER.x + Math.sin(a) * METER.r}
				y2={METER.y - Math.cos(a) * METER.r}
				stroke="var(--stage-ink-muted)"
				stroke-width={k === 0 ? 2 : 1.2}
			/>
		{/each}
		{@render txt(METER.x - 50, METER.y - 4, `−${SCALE}`, 10, { anchor: 'middle', muted: true })}
		{@render txt(METER.x + 50, METER.y - 4, `+${SCALE}`, 10, { anchor: 'middle', muted: true })}
		<line
			x1={METER.x}
			y1={METER.y}
			x2={METER.x + Math.sin(needle) * (METER.r - 4)}
			y2={METER.y - Math.cos(needle) * (METER.r - 4)}
			stroke="var(--em-current)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx={METER.x} cy={METER.y} r="5" fill="var(--stage-ink)" />
		{@render txt(METER.x, METER.y - 26, unit, 11, { anchor: 'middle', muted: true })}
	</g>

	<!-- trace -->
	<g style:pointer-events="none">
		<line x1={PLOT.x0} x2={PLOT.x1} y1={mid} y2={mid} stroke="var(--stage-line)" />
		<line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.top} y2={PLOT.bottom} stroke="var(--stage-line)" />
		<line x1={PLOT.x0} x2={PLOT.x1} y1={sy(1)} y2={sy(1)} stroke="var(--stage-grid)" />
		<line x1={PLOT.x0} x2={PLOT.x1} y1={sy(-1)} y2={sy(-1)} stroke="var(--stage-grid)" />
		{@render txt(PLOT.x0 - 8, mid + 4, '0', 11, { anchor: 'end', muted: true })}
		{@render txt(PLOT.x0 - 8, sy(1) + 4, `+${SCALE}`, 11, { anchor: 'end', muted: true })}
		{@render txt(PLOT.x0 - 8, sy(-1) + 4, `−${SCALE}`, 11, { anchor: 'end', muted: true })}
		{#if traces.a}
			<path d={traces.a} fill="none" stroke="var(--em-drive)" stroke-width="2" opacity="0.85" />
		{/if}
		{#if traces.b}
			<path d={traces.b} fill="none" stroke="var(--em-current)" stroke-width="2.2" />
		{/if}
		{@render txt(PLOT.x1, PLOT.top - 12, `last ${WIN} seconds`, 11, { anchor: 'end', muted: true })}
		{@render txt(
			PLOT.x0,
			PLOT.top - 12,
			isMagnet ? `current in the coil (${unit})` : `current in B (${unit})`,
			12,
			{ weight: 600, color: 'var(--em-current)' }
		)}
		{#if !isMagnet}
			{@render txt(PLOT.x0 + 170, PLOT.top - 12, `current in A (±${I0} A)`, 12, {
				weight: 600,
				color: 'var(--em-drive)'
			})}
		{/if}
		{#if manual && traces.n < 2}
			{@render txt(
				(PLOT.x0 + PLOT.x1) / 2,
				mid - 14,
				reduced
					? 'Reduced motion is on: choose “Swings through” to see the pulses'
					: hand
						? 'Drag the magnet through the coil'
						: 'Move the slider for coil A’s current',
				13,
				{ anchor: 'middle', muted: true }
			)}
		{/if}
	</g>

	<!-- readout card -->
	<g style:pointer-events="none">
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each cards as c, i (c.id)}
			{@const w = CARD.w / cards.length}
			{@const x = CARD.x + 16 + i * w}
			{#if i > 0}
				<line
					x1={CARD.x + i * w}
					x2={CARD.x + i * w}
					y1={CARD.y + 14}
					y2={CARD.y + CARD.h - 14}
					stroke="var(--border)"
				/>
			{/if}
			<text {x} y={CARD.y + 25} class="muted" style:font-size="12px">{c.label}</text>
			<text {x} y={CARD.y + 51} font-weight="700" style:font-size="19px" style:fill={c.color}
				>{c.value}</text
			>
		{/each}
	</g>
</g>

<style>
	.magnet {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.magnet.dragging {
		cursor: grabbing;
	}
	.ring {
		opacity: 0;
	}
	.magnet:focus-visible .ring {
		opacity: 1;
	}
</style>
