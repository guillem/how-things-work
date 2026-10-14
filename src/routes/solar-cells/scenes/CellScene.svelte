<script lang="ts">
	/**
	 * Silicon in the light, in the band picture (energy up, position across), `step.hints.phase`:
	 * - absorb: plain silicon (flat bands). One photon at a time of wavelength `params.nm`
	 *   arrives; its energy is drawn as a vertical arrow from the valence band, to the same
	 *   scale as the 1.12 eV gap. At least the gap: an electron–hole pair appears. Less: the
	 *   arrow stops short and the photon goes on through.
	 * - heat: the same, and the electron steps down to the band edge giving off heat (orange
	 *   wiggles); the arrow's part above the gap is orange.
	 * - sweep: a p–n junction (bands bent by the built-in voltage of the semiconductors page)
	 *   joined by a wire through a lamp. Photons arrive at a rate set by `params.power` ÷ photon
	 *   energy; each pair is separated, the electron rolling down to the n side and the hole up
	 *   to the p side, and electrons circulate in the wire. Current density = power ÷ photon
	 *   energy (one electron per absorbed photon).
	 * Energy scale: 80 px per eV. The hole's share of the excess energy is not drawn.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		clamp,
		cycle,
		hash,
		lerp,
		smoothstep,
		wavelengthToColor,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bandStep, builtIn, depletionWidth } from '../../semiconductors/model';
	import { GAPS, monoCurrent, photonEnergy } from '../model';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'absorb'));
	const time = $derived(reduced ? 2.5 : t);
	const sweep = $derived(phase === 'sweep');
	const heatPhase = $derived(phase === 'heat');

	const GAP = GAPS.Si.gap;
	const nm = $derived(clamp(Number(params.nm ?? 550), 300, 1300));
	const E = $derived(photonEnergy(nm));
	const absorbed = $derived(E >= GAP);
	const watts = $derived(sweep ? clamp(Number(params.power ?? 600), 0, 1000) : 0);
	const current = $derived(monoCurrent(nm, watts, GAP) / 10); // mA/cm²
	const visible = $derived(nm >= 400 && nm <= 700);
	const photonColor = $derived(visible ? wavelengthToColor(nm) : 'var(--stage-ink-muted)');
	const colourName = $derived(
		nm < 400 ? 'ultraviolet' : nm <= 700 ? 'visible' : nm < 1107 ? 'infrared' : 'infrared'
	);

	// ---- bands ---------------------------------------------------------------------------------
	const PX_EV = 80;
	const XL = 116;
	const XR = 844;
	const XJ = 480;
	const EV_N = 470; // valence band edge on the n side (and of plain silicon)
	const GAP_PX = GAP * PX_EV;
	const VBI = builtIn();
	const HALF_W = depletionWidth(0) / 2; // µm
	const PX_PER_UM = 120 / HALF_W; // the depletion zone spans 240 px
	// Bands bend from flat (absorb, heat) into the junction (sweep).
	const bendTarget = $derived(sweep ? 1 : 0);
	const bend = new Tween(
		untrack(() => bendTarget),
		{ easing: cubicInOut }
	);
	$effect(() => {
		const target = bendTarget;
		const r = reduced;
		untrack(() => bend.set(target, { duration: r ? 0 : 900 }));
	});
	const b = $derived(bend.current);
	/** Valence-band edge (px) at position x: higher on the p side by the built-in voltage. */
	const evAt = (x: number) => EV_N - b * VBI * PX_EV * bandStep((x - XJ) / PX_PER_UM, 0);
	const xs = Array.from({ length: 97 }, (_, i) => XL + ((XR - XL) * i) / 96);
	const line = (f: (x: number) => number) =>
		xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${f(x).toFixed(1)}`).join('');
	const evPath = $derived(line(evAt));
	const ecPath = $derived(line((x) => evAt(x) - GAP_PX));
	const valenceFill = $derived(`${evPath}L${XR} ${EV_N + 44}L${XL} ${EV_N + 44}Z`);
	const conductionFill = $derived(`${ecPath}L${XR} 120L${XL} 120Z`);

	// ---- one photon at a time (absorb, heat) ---------------------------------------------------
	const PERIOD = 4.4;
	const XA = 480;
	const u = $derived(cycle(time, PERIOD));
	const evA = $derived(evAt(XA));
	const arrowTop = $derived(evA - E * PX_EV);
	const photonIn = (k: number, xa: number, yTarget: number) => {
		const p0: Point = { x: xa - 190, y: 58 };
		return { x: lerp(p0.x, xa, k), y: lerp(p0.y, yTarget, k) };
	};
	const single = $derived.by(() => {
		const arrive = smoothstep(0, 0.22, u);
		const grow = smoothstep(0.22, 0.34, u);
		const fadeAll = 1 - smoothstep(0.88, 0.98, u);
		// Photon: flies in to the valence band; below the gap it carries on and out.
		const through = absorbed ? 0 : smoothstep(0.42, 0.8, u);
		const pos = absorbed
			? photonIn(arrive, XA, evA)
			: {
					x: lerp(photonIn(arrive, XA, evA).x, XA + 190 * 0.55, through),
					y: lerp(photonIn(arrive, XA, evA).y, EV_N + 40, through)
				};
		const photonOpacity = absorbed
			? smoothstep(0, 0.04, u) * (1 - smoothstep(0.2, 0.25, u))
			: smoothstep(0, 0.04, u) * (1 - smoothstep(0.72, 0.8, u));
		// Thermalisation (heat phase): the electron steps down to the band edge.
		const excess = Math.max(0, E - GAP);
		const nSteps = clamp(Math.round(excess / 0.18), 1, 12);
		const f = heatPhase ? clamp((u - 0.42) / 0.26) : 0;
		const stepped = Math.min(
			1,
			(Math.floor(f * nSteps) + smoothstep(0.6, 1, (f * nSteps) % 1)) / nSteps
		);
		const eY = lerp(arrowTop, evA - GAP_PX, f >= 1 ? 1 : stepped);
		const wiggles = heatPhase
			? Array.from({ length: excess > 0.02 ? nSteps : 0 }, (_, j) => {
					const at = (j + 0.7) / nSteps; // when this step happens (fraction of f)
					const age = (f - at) * 3;
					const y = lerp(arrowTop, evA - GAP_PX, (j + 0.5) / nSteps);
					return {
						j,
						x: XA + 16 + Math.max(0, age) * 40,
						y,
						o: f >= at ? (1 - smoothstep(0.4, 1, age)) * fadeAll : 0
					};
				})
			: [];
		return {
			pos,
			photonOpacity,
			grow,
			pair: absorbed ? smoothstep(0.3, 0.36, u) * fadeAll : 0,
			arrowOpacity: absorbed ? fadeAll : 1 - smoothstep(0.62, 0.8, u),
			eY,
			wiggles
		};
	});

	// ---- many photons (sweep) ------------------------------------------------------------------
	const SLOTS = 24;
	const SWEEP_PERIOD = 3.2;
	/** Photons per second on the drawing: proportional to the photon flux (power ÷ energy). */
	const active = $derived(Math.round((SLOTS * watts) / E / (1000 / photonEnergy(1300))));
	const many = $derived(
		Array.from({ length: sweep ? SLOTS : 0 }, (_, k) => {
			// Offsets spread by the golden ratio, so any number of active slots is evenly spaced.
			const offset = (k * 0.618034) % 1;
			const v = cycle(time, SWEEP_PERIOD, offset);
			const round = Math.floor(time / SWEEP_PERIOD + offset);
			const on = k < active;
			const xa = lerp(XJ - 150, XJ + 150, hash(k * 13 + round, 2));
			const ev = evAt(xa);
			const arrive = smoothstep(0, 0.2, v);
			const pIn = photonIn(arrive, xa, ev);
			const go = smoothstep(0.3, 0.92, v);
			const ex = lerp(xa, XR - 6, go);
			const hx = lerp(xa, XL + 6, go);
			const fade = 1 - smoothstep(0.9, 1, v);
			const thermal = 1 - smoothstep(0.2, 0.3, v);
			return {
				k,
				on,
				photon: pIn,
				photonO: on ? smoothstep(0, 0.04, v) * (1 - smoothstep(0.18, 0.22, v)) : 0,
				passO: !absorbed && on ? smoothstep(0, 0.04, v) * (1 - smoothstep(0.5, 0.6, v)) : 0,
				pass: {
					x: lerp(xa - 190, xa + 120, smoothstep(0, 0.6, v)),
					y: lerp(58, EV_N + 40, smoothstep(0, 0.6, v))
				},
				pairO: on && absorbed ? smoothstep(0.2, 0.24, v) * fade : 0,
				e: { x: ex, y: evAt(ex) - GAP_PX - 7 - thermal * (E - GAP) * PX_EV },
				h: { x: hx, y: evAt(hx) + 8 }
			};
		})
	);

	// ---- the circuit ---------------------------------------------------------------------------
	const WY = 566;
	const wire = `M${XR + 6} 400 H${XR + 30} V${WY} H${XL - 30} V430 H${XL - 6}`;
	const wirePts: Point[] = [
		{ x: XR + 30, y: 430 },
		{ x: XR + 30, y: WY },
		{ x: XL - 30, y: WY },
		{ x: XL - 30, y: 440 }
	];
	const wireLen = wirePts
		.slice(1)
		.reduce((a, p, i) => a + Math.abs(p.x - wirePts[i].x) + Math.abs(p.y - wirePts[i].y), 0);
	const alongWire = (f: number): Point => {
		let d = f * wireLen;
		for (let i = 0; i + 1 < wirePts.length; i++) {
			const seg =
				Math.abs(wirePts[i + 1].x - wirePts[i].x) + Math.abs(wirePts[i + 1].y - wirePts[i].y);
			if (d <= seg) {
				const g = seg ? d / seg : 0;
				return {
					x: lerp(wirePts[i].x, wirePts[i + 1].x, g),
					y: lerp(wirePts[i].y, wirePts[i + 1].y, g)
				};
			}
			d -= seg;
		}
		return wirePts[wirePts.length - 1];
	};
	const flowTarget = $derived(sweep && current > 0 ? clamp(current / 80, 0.15, 1) : 0);
	const flow = Tween.of(() => flowTarget, { duration: 600 });
	const wireDots = $derived(
		Array.from({ length: 14 }, (_, k) => ({
			k,
			p: alongWire(cycle(time, 6, k / 14)),
			o: flow.current
		}))
	);
	const glow = $derived(clamp(current / 60));
	const LX = 480;
	const gx = XL + 24;
</script>

<g>
	<!-- bands -->
	<path d={conductionFill} fill="var(--semi-band)" opacity="0.7" />
	<path d={valenceFill} fill="var(--semi-filled)" opacity="0.55" />
	<path d={ecPath} fill="none" stroke="var(--semi-band-edge)" stroke-width="2" />
	<path d={evPath} fill="none" stroke="var(--semi-band-edge)" stroke-width="2" />
	<Readout id="cb">
		<T
			x={XL + 8}
			y={136}
			text="conduction band (empty: free electrons move here)"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="vb">
		<T x={XL + 8} y={EV_N + 34} text="valence band (full: electrons in bonds)" size={12} muted />
	</Readout>
	<!-- the gap, measured at the left -->
	<line
		x1={gx}
		x2={gx}
		y1={evAt(gx)}
		y2={evAt(gx) - GAP_PX}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>
	<line x1={gx - 5} x2={gx + 5} y1={evAt(gx)} y2={evAt(gx)} stroke="var(--stage-ink)" />
	<line
		x1={gx - 5}
		x2={gx + 5}
		y1={evAt(gx) - GAP_PX}
		y2={evAt(gx) - GAP_PX}
		stroke="var(--stage-ink)"
	/>
	<Readout id="gaplabel">
		<T x={gx + 10} y={evAt(gx) - GAP_PX / 2 - 2} text="gap" size={12} />
		<T x={gx + 10} y={evAt(gx) - GAP_PX / 2 + 13} text="1.12 eV" size={12} weight={700} />
	</Readout>

	{#if b > 0.02}
		<g opacity={b}>
			<rect
				x={XJ - 120}
				y={EV_N + 48}
				width="240"
				height="3"
				fill="var(--semi-field)"
				opacity="0.6"
			/>
			<Readout id="sides">
				<T
					x={(XL + XJ - 120) / 2}
					y={EV_N + 70}
					text="p side"
					size={14}
					weight={700}
					anchor="middle"
				/>
				<T
					x={XJ}
					y={EV_N + 70}
					text="junction: field pushes e⁻ → n, holes → p"
					size={12}
					anchor="middle"
					muted
				/>
				<T
					x={(XR + XJ + 120) / 2}
					y={EV_N + 70}
					text="n side"
					size={14}
					weight={700}
					anchor="middle"
				/>
			</Readout>
		</g>
	{/if}

	{#if !sweep}
		<!-- one photon -->
		{@const s = single}
		{#if s.photonOpacity > 0.01}
			<g transform="translate({s.pos.x} {s.pos.y}) rotate(41)" opacity={s.photonOpacity}>
				<path
					d="M-34 0 q4 -6 8 0 t8 0 t8 0 t8 0"
					fill="none"
					stroke={photonColor}
					stroke-width="2.4"
				/>
				<circle cx="0" cy="0" r="4" fill={photonColor} />
			</g>
		{/if}
		<!-- the photon's energy as an arrow from the valence band -->
		{#if s.grow > 0}
			{@const top = lerp(evA, arrowTop, s.grow)}
			{@const ec = evA - GAP_PX}
			<g opacity={s.arrowOpacity}>
				{#if heatPhase && absorbed}
					<line
						x1={XA}
						x2={XA}
						y1={evA}
						y2={Math.max(top, ec)}
						stroke="var(--sc-kept)"
						stroke-width="4"
					/>
					{#if top < ec}
						<line x1={XA} x2={XA} y1={ec} y2={top} stroke="var(--sc-heat)" stroke-width="4" />
					{/if}
				{:else}
					<line
						x1={XA}
						x2={XA}
						y1={evA}
						y2={top}
						stroke={photonColor}
						stroke-width="4"
						stroke-dasharray={absorbed ? undefined : '6 4'}
					/>
				{/if}
				<path
					d="M{XA - 7} {top + 9} L{XA} {top} L{XA + 7} {top + 9}"
					fill="none"
					stroke={heatPhase && absorbed && top < ec ? 'var(--sc-heat)' : photonColor}
					stroke-width="3"
				/>
			</g>
		{/if}
		{#each s.wiggles as w (w.j)}
			<path
				d="M{w.x} {w.y} q3 -5 6 0 t6 0 t6 0"
				fill="none"
				stroke="var(--sc-heat)"
				stroke-width="2"
				opacity={w.o}
			/>
		{/each}
		{#if s.pair > 0.01}
			<circle
				cx={XA}
				cy={(heatPhase ? s.eY : arrowTop) - 7}
				r="7"
				fill="var(--semi-electron)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
				opacity={s.pair}
			/>
			<circle
				cx={XA}
				cy={evA + 9}
				r="7"
				fill="var(--semi-p)"
				stroke="var(--semi-hole)"
				stroke-width="2.4"
				opacity={s.pair}
			/>
			<Readout id="pair">
				<T
					x={XA - 16}
					y={(heatPhase ? s.eY : arrowTop) - 3}
					text="electron"
					size={12}
					anchor="end"
					opacity={s.pair}
				/>
				<T x={XA - 16} y={evA + 13} text="hole" size={12} anchor="end" opacity={s.pair} />
			</Readout>
		{/if}
	{:else}
		<!-- many photons; pairs separated by the junction -->
		{#each many as m (m.k)}
			{#if absorbed && m.photonO > 0.01}
				<g transform="translate({m.photon.x} {m.photon.y}) rotate(41)" opacity={m.photonO}>
					<path
						d="M-26 0 q3 -5 6 0 t6 0 t6 0 t6 0"
						fill="none"
						stroke={photonColor}
						stroke-width="2"
					/>
					<circle cx="0" cy="0" r="3.4" fill={photonColor} />
				</g>
			{/if}
			{#if m.passO > 0.01}
				<g transform="translate({m.pass.x} {m.pass.y}) rotate(41)" opacity={m.passO}>
					<path
						d="M-26 0 q3 -5 6 0 t6 0 t6 0 t6 0"
						fill="none"
						stroke={photonColor}
						stroke-width="2"
					/>
					<circle cx="0" cy="0" r="3.4" fill={photonColor} />
				</g>
			{/if}
			{#if m.pairO > 0.01}
				<circle
					cx={m.e.x}
					cy={m.e.y}
					r="6"
					fill="var(--semi-electron)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
					opacity={m.pairO}
				/>
				<circle
					cx={m.h.x}
					cy={m.h.y}
					r="6"
					fill="var(--semi-p)"
					stroke="var(--semi-hole)"
					stroke-width="2.2"
					opacity={m.pairO}
				/>
			{/if}
		{/each}
	{/if}

	<!-- circuit -->
	{#if b > 0.02}
		<g opacity={b}>
			<rect
				x={XL - 12}
				y={evAt(XL) - GAP_PX - 20}
				width="10"
				height={GAP_PX + 64}
				rx="2"
				fill="var(--circ-copper)"
			/>
			<rect
				x={XR + 2}
				y={EV_N - GAP_PX - 20}
				width="10"
				height={GAP_PX + 64}
				rx="2"
				fill="var(--circ-copper)"
			/>
			<path d={wire} fill="none" stroke="var(--circ-wire)" stroke-width="2.5" />
			<!-- lamp -->
			<circle cx={LX} cy={WY} r={18 + 10 * glow} fill="var(--circ-glow)" opacity={0.35 * glow} />
			<circle
				cx={LX}
				cy={WY}
				r="12"
				fill="var(--stage-bg)"
				stroke="var(--circ-wire)"
				stroke-width="2"
			/>
			<path
				d="M{LX - 7} {WY + 1} q3.5 -9 7 0 t7 0"
				fill="none"
				stroke={glow > 0.02 ? 'var(--circ-glow)' : 'var(--stage-ink-muted)'}
				stroke-width="2"
			/>
			{#each wireDots as w (w.k)}
				<circle cx={w.p.x} cy={w.p.y} r="4" fill="var(--semi-electron)" opacity={w.o} />
			{/each}
		</g>
	{/if}

	<!-- readouts -->
	<Readout id="card">
		<Card x={640} y={20} w={300} h={sweep ? 112 : 92} />
	</Readout>
	<Readout
		id="photon"
		order={1}
		label="Photon"
		value="{nm} nm · {E.toFixed(2)} eV"
		color={visible ? photonColor : undefined}
	>
		<T x={656} y={46} text="photon: {nm} nm ({colourName})" size={13} weight={600} />
		<T x={656} y={66} text="energy {E.toFixed(2)} eV · gap 1.12 eV" size={13} />
	</Readout>
	{#if !sweep}
		<Readout
			id="verdict"
			order={2}
			label={absorbed ? (heatPhase ? 'Lost as heat' : 'Absorbed') : 'Passes through'}
			value={absorbed
				? heatPhase
					? `${(E - GAP).toFixed(2)} eV (${(((E - GAP) / E) * 100).toFixed(0)}% of the photon)`
					: 'makes an electron–hole pair'
				: `${(GAP - E).toFixed(2)} eV short of the gap`}
		>
			<T
				x={656}
				y={90}
				text={absorbed
					? heatPhase
						? `heat: ${(E - GAP).toFixed(2)} eV, ${(((E - GAP) / E) * 100).toFixed(0)}% of the photon`
						: 'absorbed: one electron–hole pair'
					: `passes through: ${(GAP - E).toFixed(2)} eV too weak`}
				size={13}
				weight={700}
				color={absorbed
					? heatPhase && E - GAP > 0.01
						? 'var(--sc-heat)'
						: 'var(--sc-kept)'
					: 'var(--stage-ink-muted)'}
			/>
		</Readout>
	{:else}
		<Readout id="power" order={2} label="Light on the cell" value="{watts} W/m²">
			<T x={656} y={90} text="light: {watts} W/m²" size={13} />
		</Readout>
		<Readout id="current" order={3} label="Current" value="{current.toFixed(1)} mA/cm²">
			<T x={656} y={116} text="current: {current.toFixed(1)} mA per cm²" size={15} weight={700} />
		</Readout>
	{/if}
</g>
