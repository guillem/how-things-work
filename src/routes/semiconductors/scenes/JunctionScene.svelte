<script lang="ts">
	/**
	 * The p–n junction (`step.hints.phase`), p-type on the left, n-type on the right, both
	 * doped 10¹⁷ cm⁻³; the cross-section is to scale (740 px per µm).
	 * - join: `params.joined` brings the two pieces together. Carriers near the boundary
	 *   meet at the junction and recombine (nearest first), leaving the depletion zone of
	 *   uncovered ions (B⁻ on the p side, P⁺ on the n side) and its field (n → p). Below,
	 *   the bands of the two pieces, first side by side with their own Fermi levels, bend
	 *   by the built-in voltage until the Fermi level is flat.
	 * - bias: a battery across the junction, voltage `params[hints.param]` (vf: 0…0.8 V
	 *   forward, + on the p side; vr: −2…0 V reverse). The depletion width and the band
	 *   step follow the model (depletion approximation, `bandStep`), the quasi-Fermi levels
	 *   split by qV, and the current is the ideal diode's. Forward, electrons (from the n
	 *   side) and holes (from the p side) stream across and recombine, as many dots as the
	 *   current's order of magnitude, and electrons circulate in the wires.
	 * - curve: the same cross-section above the current–voltage curve, with a handle on
	 *   the curve that sets `params.v`; `params.logScale` plots |I| on a log scale.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		clamp,
		cycle,
		hash,
		lerp,
		scale,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		GAPS,
		JUNCTION_DOPING,
		KT,
		NI_SI,
		amps,
		bandStep,
		builtIn,
		depletionWidth,
		diodeCurrent,
		sup
	} from '../model';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'bias'));
	const time = $derived(reduced ? 2.5 : t);
	const paramId = $derived(String(step.hints?.param ?? 'v'));
	const targetV = $derived(phase === 'join' ? 0 : Number(params[paramId] ?? 0));
	const V = Tween.of(() => targetV, { duration: 350, easing: cubicInOut });
	const volts = $derived(reduced ? targetV : V.current);

	// Joining: a tween driven by the toggle (instant under reduced motion).
	const joinedTarget = $derived(phase !== 'join' || params.joined === true ? 1 : 0);
	const join = new Tween(
		untrack(() => joinedTarget),
		{ easing: cubicInOut }
	);
	$effect(() => {
		const target = joinedTarget;
		const r = reduced;
		untrack(() => join.set(target, { duration: r ? 0 : 2200 }));
	});
	const j = $derived(join.current);

	const VBI = builtIn();
	const PHI = KT * Math.log(JUNCTION_DOPING / NI_SI); // Fermi level's distance from midgap (eV)
	const current = $derived(diodeCurrent(volts));

	// ---- cross-section geometry ----------------------------------------------------------------
	const XL = 110;
	const XR = 850;
	const XJ = 480;
	const PX_PER_UM = (XR - XL) / 1.0;
	const BAR_Y0 = 72;
	const BAR_Y1 = 200;
	const W = $derived(depletionWidth(volts));
	/** Half the depletion zone, in px; while joining it opens up as the carriers recombine. */
	const hw = $derived((W / 2) * PX_PER_UM);
	const gapOpen = $derived((1 - j) * 18);
	const pieceShift = (x: number) => (x < XJ ? -gapOpen : gapOpen);

	const COLS = 22;
	const ROWS = 4;
	const cellW = (XR - XL) / COLS;
	const rowY = (r: number) => BAR_Y0 + 18 + r * ((BAR_Y1 - BAR_Y0 - 36) / (ROWS - 1));
	const grid = Array.from({ length: COLS * ROWS }, (_, i) => {
		const c = i % COLS;
		const r = Math.floor(i / COLS);
		const x = XL + (c + 0.5) * cellW;
		return { i, c, r, x, y: rowY(r), nSide: x > XJ };
	});
	/** Mobile carriers: holes on the p side, electrons on the n side. */
	const carriers = $derived(
		grid.map((g) => {
			const d = Math.abs(g.x - XJ);
			const jitterX = 4 * Math.sin(time * 1.9 + g.i * 1.7);
			const jitterY = 3.5 * Math.sin(time * 2.3 + g.i * 2.9);
			const hw0 = (depletionWidth(0) / 2) * PX_PER_UM;
			let x = g.x + cellW * 0.25 * (g.r % 2 ? 1 : -1);
			let opacity = 1;
			if (phase === 'join') {
				if (d < hw0 + 4) {
					const start = (d / (hw0 + 4)) * 0.55;
					const k = smoothstep(start, start + 0.4, j);
					x = lerp(x, XJ, k);
					opacity = 1 - smoothstep(0.75, 1, k);
				}
			} else {
				opacity = smoothstep(hw - 2, hw + 12, Math.abs(x - XJ));
			}
			return {
				i: g.i,
				nSide: g.nSide,
				x: x + pieceShift(g.x) + jitterX,
				y: g.y + jitterY,
				opacity
			};
		})
	);
	const ions = grid.map((g) => ({
		i: g.i,
		nSide: g.nSide,
		x: g.x + cellW * 0.25 * (g.r % 2 ? -1 : 1),
		y: g.y + 1
	}));
	const uncovered = (x: number) =>
		phase === 'join'
			? j * (Math.abs(x - XJ) < (depletionWidth(0) / 2) * PX_PER_UM ? 1 : 0)
			: Math.abs(x - XJ) < hw
				? 1
				: 0;

	// ---- current flow ----------------------------------------------------------------------
	/** Pairs of streaming carriers: one per factor of ~5 in the forward current above 1 nA. */
	const streams = $derived(
		phase === 'join' || current < 1e-9
			? 0
			: clamp(Math.round((Math.log10(current) + 9) * 1.4), 1, 14)
	);
	const flow = $derived(
		Array.from({ length: streams }, (_, k) => {
			const u = cycle(time, 3.4, k / streams);
			const inP = k % 2 === 0;
			const meetX = inP
				? lerp(XL + 30, XJ - hw - 20, hash(k, 3))
				: lerp(XJ + hw + 20, XR - 30, hash(k, 3));
			const y = rowY(k % ROWS) + (k % 2 ? 8 : -8);
			const fade = smoothstep(0, 0.08, u) * (1 - smoothstep(0.88, 1, u));
			return {
				k,
				e: { x: lerp(XR + 6, meetX, u), y },
				h: { x: lerp(XL - 6, meetX, u), y: y + 4 },
				fade
			};
		})
	);
	// Electrons in the wires: from the battery's − (n side) round to its + (p side).
	const WIRE_Y = 36;
	const loopN: Point[] = [
		{ x: 506, y: WIRE_Y },
		{ x: XR + 34, y: WIRE_Y },
		{ x: XR + 34, y: 136 },
		{ x: XR + 6, y: 136 }
	];
	const loopP: Point[] = [
		{ x: XL - 6, y: 136 },
		{ x: XL - 34, y: 136 },
		{ x: XL - 34, y: WIRE_Y },
		{ x: 454, y: WIRE_Y }
	];
	const pathD = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
	const along = (pts: Point[], u: number): Point => {
		const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
		let d = u * segs.reduce((a, b) => a + b, 0);
		for (let i = 0; i < segs.length; i++) {
			if (d <= segs[i]) {
				const f = segs[i] ? d / segs[i] : 0;
				return { x: lerp(pts[i].x, pts[i + 1].x, f), y: lerp(pts[i].y, pts[i + 1].y, f) };
			}
			d -= segs[i];
		}
		return pts[pts.length - 1];
	};
	const wireDots = $derived(
		streams === 0
			? []
			: Array.from({ length: 10 }, (_, k) => {
					const u = cycle(time, 3.4, k / 10);
					return { k, a: along(loopN, u), b: along(loopP, u) };
				})
	);

	// ---- bands -------------------------------------------------------------------------------
	const PX_PER_EV = 60;
	const EC_N = 485;
	const EG = GAPS.Si.gap * PX_PER_EV;
	/** Electron energy step from n to p (eV): grows with joining, then follows the bias. */
	const stepEV = $derived(phase === 'join' ? VBI * j : VBI - volts);
	const ecAt = (x: number) => {
		const um = (x - XJ) / PX_PER_UM;
		const shape =
			phase === 'join' && j < 1
				? (x < XJ ? 1 : 0) * (1 - j) + bandStep(um, 0) * j
				: bandStep(um, volts);
		return EC_N - PX_PER_EV * stepEV * shape;
	};
	const bandXs = Array.from({ length: 120 }, (_, i) => XL + ((XR - XL) * i) / 119);
	const ecPath = $derived(
		bandXs
			.map((x, i) => `${i ? 'L' : 'M'}${(x + pieceShift(x)).toFixed(1)} ${ecAt(x).toFixed(1)}`)
			.join('')
	);
	const evPath = $derived(
		bandXs
			.map(
				(x, i) => `${i ? 'L' : 'M'}${(x + pieceShift(x)).toFixed(1)} ${(ecAt(x) + EG).toFixed(1)}`
			)
			.join('')
	);
	/** Fermi levels: electrons' (n side, flat from the right) and holes' (p side, from the left). */
	const offset = (GAPS.Si.gap / 2 - PHI) * PX_PER_EV;
	const efN = $derived(EC_N + offset);
	const efP = $derived(ecAt(XL) + EG - offset);
	const barrierTop = $derived(ecAt(XL));
	const bandFlow = $derived(
		flow.map((f) => ({
			k: f.k,
			e: { x: f.e.x, y: ecAt(clamp(f.e.x, XL, XR)) - 7 },
			h: { x: f.h.x, y: ecAt(clamp(f.h.x, XL, XR)) + EG + 7 },
			fade: f.fade
		}))
	);
	const bandCarriers = Array.from({ length: 9 }, (_, k) => ({ k, f: (k + 0.5) / 9 }));

	// ---- I–V curve -------------------------------------------------------------------------
	const logScale = $derived(params.logScale === true);
	const PX0 = 150;
	const PX1 = 820;
	const PY0 = 300;
	const PY1 = 540;
	const sv = scale([-2, 0.8], [PX0, PX1]);
	const IMAX = 0.03;
	const syLin = scale([-0.002, IMAX], [PY1, PY0]);
	const syLog = scale([-16, -1], [PY1, PY0]);
	const yOf = (I: number) =>
		logScale
			? syLog(clamp(Math.log10(Math.max(Math.abs(I), 1e-16)), -16, -1))
			: syLin(clamp(I, -0.002, IMAX));
	const ivPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 280; i++) {
			const v = -2 + (2.8 * i) / 280;
			d += `${i ? 'L' : 'M'}${sv(v).toFixed(1)} ${yOf(diodeCurrent(v)).toFixed(1)}`;
		}
		return d;
	});
	const handleY = $derived(yOf(diodeCurrent(volts)));
	const setV = (v: number) => setParam('v', Math.round(clamp(v, -2, 0.8) * 100) / 100);
	const onmove = (p: Point) => setV(sv.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setV(-2) : k === 'end' ? setV(0.8) : setV(Number(params.v ?? 0.7) + k * 0.01);

	const forward = $derived(volts > 0.005);
	const reverse = $derived(volts < -0.005);
	const showCircuit = $derived(phase !== 'join');
	const currentText = $derived(
		Math.abs(current) < 1e-12 && !forward ? `${amps(current)}: practically none` : amps(current)
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- ===================== circuit ===================== -->
	{#if showCircuit}
		<path d={pathD(loopN)} fill="none" stroke="var(--circ-wire)" stroke-width="2.5" />
		<path d={pathD(loopP)} fill="none" stroke="var(--circ-wire)" stroke-width="2.5" />
		<!-- battery: the long plate is + -->
		{@const plusLeft = volts >= 0}
		<line
			x1="472"
			x2="472"
			y1={WIRE_Y - (plusLeft ? 16 : 8)}
			y2={WIRE_Y + (plusLeft ? 16 : 8)}
			stroke="var(--stage-ink)"
			stroke-width={plusLeft ? 2 : 5}
		/>
		<line
			x1="488"
			x2="488"
			y1={WIRE_Y - (plusLeft ? 8 : 16)}
			y2={WIRE_Y + (plusLeft ? 8 : 16)}
			stroke="var(--stage-ink)"
			stroke-width={plusLeft ? 5 : 2}
		/>
		<line x1="454" x2="472" y1={WIRE_Y} y2={WIRE_Y} stroke="var(--circ-wire)" stroke-width="2.5" />
		<line x1="488" x2="506" y1={WIRE_Y} y2={WIRE_Y} stroke="var(--circ-wire)" stroke-width="2.5" />
		{@render txt(458, WIRE_Y - 12, plusLeft ? '+' : '−', 15, {
			weight: 700,
			color: plusLeft ? 'var(--circ-high)' : 'var(--circ-low)'
		})}
		{@render txt(502, WIRE_Y - 12, plusLeft ? '−' : '+', 15, {
			weight: 700,
			color: plusLeft ? 'var(--circ-low)' : 'var(--circ-high)'
		})}
		<Readout id="battery">
			{@render txt(
				480,
				WIRE_Y + 34,
				`${Math.abs(targetV).toFixed(2)} V ${forward ? 'forward' : reverse ? 'reverse' : ''}`,
				13,
				{ weight: 700 }
			)}
		</Readout>
		{#each wireDots as w (w.k)}
			<circle cx={w.a.x} cy={w.a.y} r="3.5" fill="var(--semi-electron)" />
			<circle cx={w.b.x} cy={w.b.y} r="3.5" fill="var(--semi-electron)" />
		{/each}
		<!-- ammeter readout -->
		<Readout
			id="current"
			order={1}
			label="Current at {Math.abs(targetV).toFixed(2)} V{forward
				? ' forward'
				: reverse
					? ' reverse'
					: ''}"
			value={currentText}
			color="var(--semi-electron)"
		>
			<g>
				<rect
					x="600"
					y={WIRE_Y - 17}
					width="230"
					height="30"
					rx="15"
					fill="var(--surface)"
					stroke={forward && current > 1e-6 ? 'var(--circ-glow)' : 'var(--border)'}
					stroke-width={forward && current > 1e-6 ? 2.5 : 1}
				/>
				{@render txt(715, WIRE_Y + 3, `current: ${currentText}`, 13, { weight: 700 })}
			</g>
		</Readout>
	{:else}
		<Readout
			id="state"
			order={1}
			label={j < 0.02 ? 'Two separate pieces' : j < 0.98 ? 'Joining' : 'Joined'}
			value={j < 0.02
				? 'each electrically neutral'
				: j < 0.98
					? 'carriers spread across the boundary…'
					: 'a depletion zone has formed'}
		>
			{@render txt(
				XJ,
				40,
				j < 0.02
					? 'Two separate pieces, each electrically neutral'
					: j < 0.98
						? 'Joining: carriers spread across the boundary…'
						: 'Joined: a depletion zone has formed',
				15,
				{ weight: 700 }
			)}
		</Readout>
	{/if}

	<!-- ===================== cross-section ===================== -->
	<rect
		x={XL - gapOpen}
		y={BAR_Y0}
		width={XJ - XL}
		height={BAR_Y1 - BAR_Y0}
		rx="6"
		fill="var(--semi-p)"
		stroke="var(--semi-band-edge)"
	/>
	<rect
		x={XJ + gapOpen}
		y={BAR_Y0}
		width={XR - XJ}
		height={BAR_Y1 - BAR_Y0}
		rx="6"
		fill="var(--semi-n)"
		stroke="var(--semi-band-edge)"
	/>
	{#if j > 0.02}
		<rect
			x={XJ - hw}
			y={BAR_Y0 + 1}
			width={2 * hw}
			height={BAR_Y1 - BAR_Y0 - 2}
			fill="var(--stage-bg)"
			opacity={0.55 * j}
		/>
		<line
			x1={XJ - hw}
			x2={XJ - hw}
			y1={BAR_Y0}
			y2={BAR_Y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 3"
			opacity={j}
		/>
		<line
			x1={XJ + hw}
			x2={XJ + hw}
			y1={BAR_Y0}
			y2={BAR_Y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 3"
			opacity={j}
		/>
	{/if}
	<!-- contacts -->
	<rect
		x={XL - gapOpen - 8}
		y={BAR_Y0 + 20}
		width="8"
		height={BAR_Y1 - BAR_Y0 - 40}
		rx="2"
		fill="var(--circ-copper)"
	/>
	<rect
		x={XR + gapOpen}
		y={BAR_Y0 + 20}
		width="8"
		height={BAR_Y1 - BAR_Y0 - 40}
		rx="2"
		fill="var(--circ-copper)"
	/>

	{#each ions as ion (ion.i)}
		{@const u = uncovered(ion.x)}
		<text
			x={ion.x + pieceShift(ion.x)}
			y={ion.y + 5}
			text-anchor="middle"
			font-weight={u > 0.5 ? 800 : 600}
			font-size={u > 0.5 ? 17 : 14}
			style:fill={ion.nSide ? 'var(--semi-donor)' : 'var(--semi-acceptor)'}
			opacity={0.4 + 0.6 * u}>{ion.nSide ? '+' : '−'}</text
		>
	{/each}
	{#each carriers as c (c.i)}
		{#if c.opacity > 0.01}
			{#if c.nSide}
				<circle cx={c.x} cy={c.y} r="5" fill="var(--semi-electron)" opacity={c.opacity} />
			{:else}
				<circle
					cx={c.x}
					cy={c.y}
					r="5"
					fill="var(--semi-p)"
					stroke="var(--semi-hole)"
					stroke-width="2"
					opacity={c.opacity}
				/>
			{/if}
		{/if}
	{/each}
	{#each flow as f (f.k)}
		<circle
			cx={f.e.x}
			cy={f.e.y}
			r="5.5"
			fill="var(--semi-electron)"
			stroke="var(--stage-bg)"
			opacity={f.fade}
		/>
		<circle
			cx={f.h.x}
			cy={f.h.y}
			r="5.5"
			fill="var(--semi-p)"
			stroke="var(--semi-hole)"
			stroke-width="2.2"
			opacity={f.fade}
		/>
	{/each}

	<!-- labels under the bar -->
	<Readout id="key-p" order={10} label="p-type: holes ○, B⁻ ions" color="var(--semi-hole)">
		{@render txt(XL - gapOpen, BAR_Y1 + 20, 'p-type: holes ○, fixed B⁻ ions', 12, {
			anchor: 'start',
			weight: 600
		})}
	</Readout>
	<Readout id="key-n" order={11} label="n-type: electrons ●, P⁺ ions" color="var(--semi-electron)">
		{@render txt(XR + gapOpen, BAR_Y1 + 20, 'n-type: electrons ●, fixed P⁺ ions', 12, {
			anchor: 'end',
			weight: 600
		})}
	</Readout>
	{#if j > 0.3}
		{@const fz = smoothstep(0.3, 0.8, j)}
		<g opacity={fz}>
			{#if hw > 14}
				<line
					x1={XJ + hw - 3}
					x2={XJ - hw + 3}
					y1={BAR_Y1 + 38}
					y2={BAR_Y1 + 38}
					stroke="var(--semi-field)"
					stroke-width="2"
					marker-end="url(#arrowhead)"
				/>
			{/if}
			<Readout
				id="zone"
				order={2}
				label="Depletion zone"
				value="{W.toFixed(2)} µm"
				note={hw > 14 ? 'field from n to p' : undefined}
				opacity={fz}
			>
				{@render txt(
					XJ,
					BAR_Y1 + 58,
					`depletion zone ${W.toFixed(2)} µm` + (hw > 14 ? ' · field from n to p' : ''),
					12,
					{ weight: 600 }
				)}
			</Readout>
		</g>
	{/if}

	{#if phase !== 'curve'}
		<!-- ===================== bands ===================== -->
		<line
			x1="70"
			y1="560"
			x2="70"
			y2="300"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="energy-axis">
			{@render txt(78, 296, 'electron energy', 11, { anchor: 'start', muted: true })}
		</Readout>
		<path d={ecPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.4" />
		<path d={evPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.4" />
		<Readout id="cb" order={12} label="Conduction band" marker={1} at={[XR + 30, EC_N - 22]}>
			{@render txt(XR + 4, EC_N + 4, 'conduction band', 11, { anchor: 'start', weight: 600 })}
		</Readout>
		<Readout id="vb" order={13} label="Valence band" marker={2} at={[XR + 30, EC_N + EG + 22]}>
			{@render txt(XR + 4, EC_N + EG + 4, 'valence band', 11, { anchor: 'start', weight: 600 })}
		</Readout>
		<!-- resting carriers in the bands -->
		{#each bandCarriers as b (b.k)}
			{@const xn = lerp(XJ + hw + 14, XR - 10, b.f) + gapOpen}
			{@const xp = lerp(XL + 10, XJ - hw - 14, b.f) - gapOpen}
			<circle
				cx={xn + 3 * Math.sin(time * 2 + b.k)}
				cy={EC_N - 7}
				r="4"
				fill="var(--semi-electron)"
			/>
			<circle
				cx={xp + 3 * Math.sin(time * 2.2 + b.k)}
				cy={ecAt(XL) + EG + 7}
				r="4"
				fill="var(--stage-bg)"
				stroke="var(--semi-hole)"
				stroke-width="1.8"
			/>
		{/each}
		{#each bandFlow as f (f.k)}
			<circle cx={f.e.x} cy={f.e.y} r="4.5" fill="var(--semi-electron)" opacity={f.fade} />
			<circle
				cx={f.h.x}
				cy={f.h.y}
				r="4.5"
				fill="var(--stage-bg)"
				stroke="var(--semi-hole)"
				stroke-width="2"
				opacity={f.fade}
			/>
		{/each}
		<!-- Fermi levels -->
		{#if phase === 'join' && j < 0.98}
			<line
				x1={XL - gapOpen}
				x2={XJ - gapOpen}
				y1={efP}
				y2={efP}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="6 4"
				stroke-width="1.4"
			/>
			<line
				x1={XJ + gapOpen}
				x2={XR + gapOpen}
				y1={efN}
				y2={efN}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="6 4"
				stroke-width="1.4"
			/>
			<Readout id="fermi-pn" order={14} label="Dashed: the Fermi levels of p and n">
				{@render txt(XL - gapOpen + 4, efP - 6, 'Fermi level (p)', 11, {
					anchor: 'start',
					muted: true
				})}
				{@render txt(XR + gapOpen - 4, efN + 16, 'Fermi level (n)', 11, {
					anchor: 'end',
					muted: true
				})}
			</Readout>
		{:else if Math.abs(volts) < 0.005}
			<line
				x1={XL}
				x2={XR}
				y1={efN}
				y2={efN}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="6 4"
				stroke-width="1.4"
			/>
			<Readout id="fermi-flat" order={14} label="Dashed: the Fermi level, flat">
				{@render txt(XR - 4, efN + 16, 'Fermi level: flat', 11, { anchor: 'end', muted: true })}
			</Readout>
		{:else}
			<line
				x1={XJ - hw}
				x2={XR}
				y1={efN}
				y2={efN}
				stroke="var(--semi-electron)"
				stroke-dasharray="6 4"
				stroke-width="1.4"
			/>
			<line
				x1={XL}
				x2={XJ + hw}
				y1={efP}
				y2={efP}
				stroke="var(--semi-hole)"
				stroke-dasharray="6 4"
				stroke-width="1.4"
			/>
			<Readout
				id="fermi-split"
				order={14}
				label="Dashed: the two Fermi levels, {Math.abs(volts).toFixed(2)} eV apart"
			>
				{@render txt(XL + 4, efP - 6, "holes' Fermi level", 11, {
					anchor: 'start',
					color: 'var(--semi-hole)'
				})}
				{@render txt(XJ + hw + 10, efN + 15, "electrons' Fermi level", 11, {
					anchor: 'start',
					color: 'var(--semi-electron)'
				})}
			</Readout>
			<line
				x1={XR - 30}
				x2={XR - 30}
				y1={efN}
				y2={efP}
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				marker-end="url(#arrowhead)"
				marker-start="url(#arrowhead)"
				opacity={Math.abs(efN - efP) > 14 ? 1 : 0}
			/>
			<Readout id="qv">
				{@render txt(
					XR - 38,
					Math.abs(efN - efP) > 30 ? (efN + efP) / 2 + 4 : Math.max(efN, efP) + 16,
					`qV = ${Math.abs(volts).toFixed(2)} eV`,
					11,
					{
						anchor: 'end',
						weight: 600
					}
				)}
			</Readout>
		{/if}
		<!-- barrier -->
		{#if stepEV > 0.02}
			<line
				x1={XJ + hw + 20}
				x2={XJ + hw + 64}
				y1={EC_N}
				y2={EC_N}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
			/>
			<line
				x1={XJ - hw - 40}
				x2={XJ + hw + 50}
				y1={barrierTop}
				y2={barrierTop}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
			/>
			<line
				x1={XJ + hw + 50}
				x2={XJ + hw + 50}
				y1={EC_N - 2}
				y2={barrierTop + 2}
				stroke="var(--semi-field)"
				stroke-width="1.8"
				marker-end="url(#arrowhead)"
				opacity={stepEV > 0.2 ? 1 : 0}
			/>
			<Readout
				id="hill"
				order={3}
				label="Hill for electrons"
				value="{stepEV.toFixed(2)} eV"
				color="var(--semi-field)"
			>
				{@render txt(
					XJ + hw + 58,
					stepEV > 0.3 ? (EC_N + barrierTop) / 2 + 4 : barrierTop - 14,
					`hill for electrons: ${stepEV.toFixed(2)} eV`,
					12,
					{ anchor: 'start', weight: 700, color: 'var(--semi-field)' }
				)}
			</Readout>
		{/if}
		<Readout
			id="caption"
			order={4}
			label="Bands"
			value={phase === 'join'
				? j < 0.02
					? 'the Fermi level, the top of the sea of electrons, is higher in the n piece'
					: `bent by the built-in voltage, ${VBI.toFixed(2)} V, until the Fermi level is flat`
				: forward
					? 'the hill drops by qV: electrons and holes stream over it'
					: reverse
						? 'the hill grows by qV: no majority carrier can climb it'
						: 'no voltage: the hill stops the flow'}
		>
			{@render txt(
				480,
				588,
				phase === 'join'
					? j < 0.02
						? 'Separate: the Fermi level, the top of the sea of electrons, is higher in the n piece.'
						: `Joined: the bands bend by the built-in voltage, ${VBI.toFixed(2)} V, until the Fermi level is flat.`
					: forward
						? 'Forward: the hill drops by qV, and electrons and holes stream over it.'
						: reverse
							? 'Reverse: the hill grows by qV; no majority carrier can climb it.'
							: 'No voltage: the hill stops the flow.',
				13,
				{ weight: 600 }
			)}
		</Readout>
	{:else}
		<!-- ===================== I–V curve ===================== -->
		{#if logScale}
			<Axes
				sx={sv}
				sy={syLog}
				xTicks={[-2, -1.5, -1, -0.5, 0, 0.5]}
				yTicks={[-15, -12, -9, -6, -3]}
				xFormat={(v: number) => `${v} V`}
				yFormat={(v: number) => `10${sup(v)} A`}
				yLabel="|current| (A)"
			/>
		{:else}
			<Axes
				sx={sv}
				sy={syLin}
				xTicks={[-2, -1.5, -1, -0.5, 0, 0.5]}
				yTicks={[0, 0.01, 0.02, 0.03]}
				xFormat={(v: number) => `${v} V`}
				yFormat={(v: number) => `${Math.round(v * 1000)} mA`}
				yLabel="current (mA)"
			/>
		{/if}
		<line x1={sv(0)} x2={sv(0)} y1={PY0} y2={PY1} stroke="var(--stage-line)" />
		<path d={ivPath} fill="none" stroke="var(--semi-electron)" stroke-width="3" />
		{#if logScale}
			{@const va = 0.4}
			{@const vb = va + KT * Math.log(10)}
			<path
				d="M{sv(va)} {yOf(diodeCurrent(va))} H{sv(vb)} V{yOf(diodeCurrent(vb))}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.4"
			/>
			<Readout
				id="shape-log"
				order={3}
				label="Forward"
				value="×10 for every 60 mV"
				note="reverse: stuck at 10⁻¹⁵ A"
			>
				{@render txt(
					sv(vb) + 8,
					(yOf(diodeCurrent(va)) + yOf(diodeCurrent(vb))) / 2 + 4,
					'×10',
					12,
					{
						anchor: 'start',
						weight: 700
					}
				)}
				{@render txt(sv((va + vb) / 2), yOf(diodeCurrent(va)) + 18, '60 mV', 12, { weight: 600 })}
				{@render txt(sv(-1), syLog(-15) - 12, 'reverse: stuck at 10⁻¹⁵ A', 12, { weight: 600 })}
			</Readout>
		{:else}
			<Readout
				id="shape-lin"
				order={3}
				label="Forward"
				value="shoots up"
				note="reverse: practically zero"
			>
				{@render txt(sv(-1), syLin(0) - 12, 'reverse: practically zero', 12, { weight: 600 })}
				{@render txt(sv(0.72), syLin(0.02), 'forward: shoots up', 12, {
					anchor: 'end',
					weight: 600
				})}
			</Readout>
		{/if}
		<Readout id="v-axis">
			{@render txt(PX1 + 6, PY1 + 30, 'voltage', 11, { anchor: 'end', muted: true })}
		</Readout>
		<Handle
			x={sv(volts)}
			y={handleY}
			label="Voltage across the diode"
			value={targetV}
			min={-2}
			max={0.8}
			valuetext="{targetV.toFixed(2)} volts, current {amps(current)}"
			color="var(--semi-electron)"
			{onmove}
			{onkey}
		/>
		<Readout id="iv-now">
			{@render txt(PX0 + 14, PY0 + 6, `${targetV.toFixed(2)} V → ${amps(current)}`, 15, {
				anchor: 'start',
				weight: 700
			})}
		</Readout>
	{/if}
</g>
