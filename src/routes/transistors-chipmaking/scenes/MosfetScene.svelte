<script lang="ts">
	/**
	 * A MOSFET in cross-section (`step.hints.phase`):
	 * - gate: an nMOS, gate voltage `params.vg`, drain at V_DD. The gate's charge (+) grows
	 *   with the voltage, the holes under the gate are pushed away (a depletion layer that
	 *   stops deepening at threshold), and electrons gather in a channel in proportion to
	 *   the model's inversion charge, C_ox(V_GS − V_t). When current flows, electrons
	 *   stream from source to drain, as many as √(I/I_max) × 10.
	 * - curve: the same cross-section, smaller, above the drain current against the gate
	 *   voltage (linear or log, `params.logScale`), with a handle on the curve.
	 * - pmos: the mirror image: n-type body, p⁺ source (at V_DD) and drain (0 V), gate
	 *   voltage `params.vgp`; the channel is made of holes and forms when the gate is low.
	 * The drawing is not to scale (the channel is a few nm deep, the islands far deeper).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Handle, clamp, cycle, hash, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import type { Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { amps, sup } from '../../semiconductors/model';
	import { NMOS, PMOS, SUBTHRESHOLD_SWING, VDD, channelDensity, drainCurrent } from '../model';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'gate'));
	const time = $derived(reduced ? 2.5 : t);
	const isP = $derived(phase === 'pmos');
	const dev = $derived(isP ? PMOS : NMOS);
	const paramId = $derived(isP ? 'vgp' : 'vg');
	const target = $derived(Number(params[paramId] ?? (isP ? VDD : 0)));
	const G = Tween.of(() => target, { duration: 300, easing: cubicInOut });
	const vg = $derived(reduced ? target : G.current);
	/** The voltage that controls the channel: V_GS for the nMOS, V_SG for the pMOS. */
	const drive = $derived(isP ? VDD - vg : vg);
	const current = $derived(drainCurrent(dev, drive, VDD));
	const IMAX = drainCurrent(NMOS, VDD, VDD);
	const density = $derived(channelDensity(dev, drive));
	const DMAX = channelDensity(NMOS, VDD);

	// ---- layout: big cross-section, or small above the curve ----
	const lay = Tween.of(() => (phase === 'curve' ? 1 : 0), { duration: 700, easing: cubicInOut });
	const L = $derived(reduced ? (phase === 'curve' ? 1 : 0) : lay.current);
	const s = $derived(lerp(1, 0.56, L));
	const ox = $derived(lerp(80, 256, L));
	const oy = $derived(lerp(84, 40, L));
	/** Font size in local units that renders at `n` px. */
	const fs = (n: number) => n / s;

	// ---- cross-section, local coordinates 800 × 320 ----
	const SURF = 130;
	const BOT = 320;
	const SRC = { x0: 30, x1: 240 };
	const DRN = { x0: 560, x1: 770 };
	const ISL_Y = 205;
	const GX0 = 250;
	const GX1 = 550;

	const depl = $derived(70 * clamp(Math.sqrt(Math.max(0, drive) / dev.vt), 0, 1));

	const bodyCarriers = Array.from({ length: 44 }, (_, i) => {
		const x = 18 + hash(i, 1) * 764;
		const yMin =
			x > SRC.x0 - 6 && x < SRC.x1 + 6
				? ISL_Y + 14
				: x > DRN.x0 - 6 && x < DRN.x1 + 6
					? ISL_Y + 14
					: SURF + 12;
		return { i, x, y: lerp(yMin, BOT - 12, hash(i, 2)) };
	});
	const islandCarriers = Array.from({ length: 24 }, (_, i) => {
		const left = i < 12;
		const k = i % 12;
		const isl = left ? SRC : DRN;
		return {
			i,
			x: lerp(isl.x0 + 22, isl.x1 - 22, (k % 6) / 5),
			y: SURF + 22 + Math.floor(k / 6) * 34
		};
	});
	/** Channel spots, filled in a scattered order as the channel charge grows. */
	const fillOrder = Array.from({ length: 40 }, (_, i) => i).sort((a, b) => hash(a, 7) - hash(b, 7));
	const channelSpots = Array.from({ length: 40 }, (_, i) => ({
		i,
		rank: fillOrder.indexOf(i),
		x: lerp(GX0 - 6, GX1 + 6, (i + 0.5) / 40) + (hash(i, 5) - 0.5) * 5,
		y: SURF + 5 + hash(i, 6) * 9
	}));
	const shownChannel = $derived(40 * Math.min(1, density / DMAX));

	/** Path of a carrier through the transistor: down the source island, across, up the drain. */
	const flowPath: Point[] = [
		{ x: 135, y: SURF - 6 },
		{ x: 200, y: SURF + 30 },
		{ x: GX0, y: SURF + 9 },
		{ x: GX1, y: SURF + 9 },
		{ x: 600, y: SURF + 30 },
		{ x: 665, y: SURF - 6 }
	];
	const at = (u: number): Point => {
		const segs = flowPath
			.slice(1)
			.map((p, i) => Math.hypot(p.x - flowPath[i].x, p.y - flowPath[i].y));
		let d = u * segs.reduce((a, b) => a + b, 0);
		for (let i = 0; i < segs.length; i++) {
			if (d <= segs[i]) {
				const f = d / segs[i];
				return {
					x: lerp(flowPath[i].x, flowPath[i + 1].x, f),
					y: lerp(flowPath[i].y, flowPath[i + 1].y, f)
				};
			}
			d -= segs[i];
		}
		return flowPath[flowPath.length - 1];
	};
	const streams = $derived(
		current > 3e-8 ? Math.max(1, Math.round(10 * Math.sqrt(current / IMAX))) : 0
	);
	const flow = $derived(
		Array.from({ length: streams }, (_, k) => {
			const u = cycle(time, 3, k / streams);
			const p = at(u);
			return {
				k,
				x: p.x,
				y: p.y + (hash(k, 9) - 0.5) * 6,
				o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u))
			};
		})
	);
	const gateCharges = $derived(Math.round((12 * clamp(drive, 0, VDD)) / VDD));

	const state = $derived(drive < dev.vt - 0.1 ? 'off' : drive < dev.vt + 0.1 ? 'edge' : 'on');
	const carrierName = $derived(isP ? 'holes' : 'electrons');
	const statusText = $derived(
		state === 'off'
			? 'OFF: no channel, no current'
			: state === 'edge'
				? 'At the threshold: a channel is forming'
				: `ON: a channel of ${carrierName} joins source and drain`
	);
	const densityText = $derived(
		density < 50
			? 'practically none'
			: `${Number(density.toPrecision(2)).toLocaleString('en-US')} per µm²`
	);

	// ---- curve ----
	const logScale = $derived(params.logScale === true);
	const PX0 = 150;
	const PX1 = 830;
	const PY0 = 290;
	const PY1 = 540;
	const sv = scale([0, VDD], [PX0, PX1]);
	const syLin = scale([0, 7e-4], [PY1, PY0]);
	const syLog = scale([-13, -3], [PY1, PY0]);
	const yOf = (I: number) =>
		logScale ? syLog(clamp(Math.log10(Math.max(I, 1e-13)), -13, -3)) : syLin(clamp(I, 0, 7e-4));
	const curvePath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 180; i++) {
			const v = (VDD * i) / 180;
			d += `${i ? 'L' : 'M'}${sv(v).toFixed(1)} ${yOf(drainCurrent(NMOS, v, VDD)).toFixed(1)}`;
		}
		return d;
	});
	const setV = (v: number) => setParam('vg', Math.round(clamp(v, 0, VDD) * 100) / 100);
	const onmove = (p: Point) => setV(sv.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setV(0) : k === 'end' ? setV(VDD) : setV(target + k * 0.01);
	const SW = SUBTHRESHOLD_SWING;
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
	<g transform="translate({ox} {oy}) scale({s})">
		<!-- terminals -->
		{#each [{ x: 135, y: 100, name: 'source', v: isP ? VDD : 0 }, { x: 400, y: 36, name: 'gate', v: vg }, { x: 665, y: 100, name: 'drain', v: isP ? 0 : VDD }] as w (w.name)}
			<line x1={w.x} x2={w.x} y1={w.y} y2={-6} stroke="var(--circ-wire)" stroke-width={2.5 / s} />
			<circle cx={w.x} cy={-6} r={4 / s} fill="var(--circ-wire)" />
			<Readout id="term-{w.name}">
				{@render txt(w.x, -16 / s, `${w.name} ${w.v.toFixed(2)} V`, fs(13), {
					weight: 700,
					color: w.name === 'gate' ? 'var(--explainer-accent, var(--accent))' : undefined
				})}
			</Readout>
		{/each}

		<!-- body -->
		<rect
			x="0"
			y={SURF}
			width="800"
			height={BOT - SURF}
			rx="6"
			fill={isP ? 'var(--semi-n)' : 'var(--semi-p)'}
			stroke="var(--semi-band-edge)"
		/>
		<!-- source and drain islands -->
		{#each [SRC, DRN] as isl (isl.x0)}
			<path
				d="M{isl.x0} {SURF} H{isl.x1} V{ISL_Y - 18} Q{isl.x1} {ISL_Y} {isl.x1 -
					18} {ISL_Y} H{isl.x0 + 18} Q{isl.x0} {ISL_Y} {isl.x0} {ISL_Y - 18} Z"
				fill={isP ? 'var(--semi-p)' : 'var(--semi-n)'}
				stroke={isP ? 'var(--semi-hole)' : 'var(--semi-electron)'}
				stroke-width={1.5}
			/>
		{/each}
		<!-- depletion layer under the gate -->
		{#if depl > 2}
			<rect
				x={GX0 - 10}
				y={SURF}
				width={GX1 - GX0 + 20}
				height={depl}
				fill="var(--stage-bg)"
				opacity="0.5"
			/>
			<line
				x1={GX0 - 10}
				x2={GX1 + 10}
				y1={SURF + depl}
				y2={SURF + depl}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="5 4"
				opacity="0.8"
			/>
		{/if}
		<!-- body carriers -->
		{#each bodyCarriers as c (c.i)}
			{@const under = c.x > GX0 - 14 && c.x < GX1 + 14}
			{@const o = under ? smoothstep(0, 14, c.y - SURF - depl) : 1}
			{@const jx = 3 * Math.sin(time * 1.7 + c.i * 2.1)}
			{@const jy = 3 * Math.sin(time * 2.1 + c.i * 1.3)}
			{#if o > 0.02}
				{#if isP}
					<circle
						cx={c.x + jx}
						cy={c.y + jy}
						r="5"
						fill="var(--semi-electron)"
						opacity={o * 0.85}
					/>
				{:else}
					<circle
						cx={c.x + jx}
						cy={c.y + jy}
						r="5"
						fill="var(--semi-p)"
						stroke="var(--semi-hole)"
						stroke-width="2"
						opacity={o * 0.85}
					/>
				{/if}
			{/if}
		{/each}
		<!-- island carriers -->
		{#each islandCarriers as c (c.i)}
			{@const jx = 3 * Math.sin(time * 2 + c.i * 1.9)}
			{#if isP}
				<circle
					cx={c.x + jx}
					cy={c.y}
					r="5"
					fill="var(--semi-p)"
					stroke="var(--semi-hole)"
					stroke-width="2"
				/>
			{:else}
				<circle cx={c.x + jx} cy={c.y} r="5" fill="var(--semi-electron)" />
			{/if}
		{/each}
		<!-- the channel -->
		{#each channelSpots as c (c.i)}
			{@const o = clamp(shownChannel - c.rank, 0, 1)}
			{#if o > 0.02}
				{@const jx = 2 * Math.sin(time * 2.4 + c.i * 1.1)}
				{#if isP}
					<circle
						cx={c.x + jx}
						cy={c.y}
						r="4.5"
						fill="var(--semi-p)"
						stroke="var(--semi-hole)"
						stroke-width="1.8"
						opacity={o}
					/>
				{:else}
					<circle cx={c.x + jx} cy={c.y} r="4.5" fill="var(--semi-electron)" opacity={o} />
				{/if}
			{/if}
		{/each}
		{#each flow as f (f.k)}
			{#if isP}
				<circle
					cx={f.x}
					cy={f.y}
					r="5.5"
					fill="var(--semi-p)"
					stroke="var(--semi-hole)"
					stroke-width="2.4"
					opacity={f.o}
				/>
			{:else}
				<circle
					cx={f.x}
					cy={f.y}
					r="5.5"
					fill="var(--semi-electron)"
					stroke="var(--stage-bg)"
					opacity={f.o}
				/>
			{/if}
		{/each}

		<!-- oxide and gate -->
		<rect
			x={GX0 - 14}
			y={SURF - 14}
			width={GX1 - GX0 + 28}
			height="14"
			fill="var(--tc-oxide)"
			stroke="var(--tc-oxide-edge)"
		/>
		<rect
			x={GX0}
			y="50"
			width={GX1 - GX0}
			height={SURF - 14 - 50}
			rx="4"
			fill="var(--tc-poly)"
			stroke="var(--tc-poly-edge)"
		/>
		<rect x="380" y="36" width="40" height="14" rx="2" fill="var(--circ-copper)" />
		<rect x="110" y="100" width="50" height="30" rx="2" fill="var(--circ-copper)" />
		<rect x="640" y="100" width="50" height="30" rx="2" fill="var(--circ-copper)" />
		{#each Array.from({ length: gateCharges }, (_, k) => k) as k (k)}
			<text
				x={GX0 + 20 + (k * (GX1 - GX0 - 40)) / 11}
				y={SURF - 22}
				text-anchor="middle"
				font-weight="800"
				font-size={fs(16)}
				style:fill="#fff">{isP ? '−' : '+'}</text
			>
		{/each}

		<!-- part labels -->
		<Readout id="parts">
			<text
				x="400"
				y="88"
				text-anchor="middle"
				font-weight="700"
				font-size={fs(13)}
				style:fill="#fff">gate</text
			>
			{#if L < 0.5}
				<line x1="238" y1="76" x2={GX0 - 4} y2={SURF - 9} stroke="var(--stage-ink-muted)" />
				{@render txt(236, 70, 'oxide, 4 nm', 12, { anchor: 'end', muted: true })}
				{@render txt(135, ISL_Y + 18, isP ? 'p⁺ source' : 'n⁺ source', 13, { weight: 700 })}
				{@render txt(665, ISL_Y + 18, isP ? 'p⁺ drain' : 'n⁺ drain', 13, { weight: 700 })}
				{@render txt(
					400,
					BOT - 14,
					isP ? 'n-type silicon: free electrons ●' : 'p-type silicon: holes ○',
					13,
					{ weight: 600 }
				)}
				{#if depl > 20}
					{@render txt(
						400,
						SURF + depl + 20,
						isP ? 'electrons pushed away' : 'holes pushed away',
						12,
						{ muted: true }
					)}
				{/if}
			{/if}
		</Readout>
	</g>

	{#if phase !== 'curve'}
		<Readout id="status" order={1} label="Transistor" value={statusText}>
			<g>
				<rect
					x="200"
					y="436"
					width="560"
					height="38"
					rx="19"
					fill="var(--surface)"
					stroke={state === 'on' ? 'var(--tc-on)' : 'var(--border)'}
					stroke-width={state === 'on' ? 2.5 : 1}
				/>
				{@render txt(480, 461, statusText, 15, {
					weight: 700,
					color: state === 'on' ? 'var(--tc-on)' : undefined
				})}
			</g>
		</Readout>
		<Readout id="current" order={2} label="Drain current" value={amps(current)}>
			{@render txt(320, 512, `drain current: ${amps(current)}`, 14, { weight: 700 })}
		</Readout>
		<Readout
			id="density"
			order={3}
			label="{isP ? 'Holes' : 'Electrons'} in the channel"
			value={densityText}
		>
			{@render txt(640, 512, `${carrierName} in the channel: ${densityText}`, 14, { weight: 700 })}
		</Readout>
		<Readout id="hint">
			{@render txt(
				480,
				548,
				isP
					? `source–gate voltage ${drive.toFixed(2)} V; the channel forms beyond ${dev.vt} V`
					: `gate–source voltage ${drive.toFixed(2)} V; the channel forms beyond the threshold, ${dev.vt} V`,
				12,
				{ muted: true }
			)}
		</Readout>
	{:else}
		{#if logScale}
			<Axes
				sx={sv}
				sy={syLog}
				xTicks={[0, 0.5, 1, 1.5]}
				yTicks={[-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3]}
				xFormat={(v: number) => `${v} V`}
				yFormat={(v: number) => `10${sup(v)} A`}
				yLabel="drain current"
			/>
		{:else}
			<Axes
				sx={sv}
				sy={syLin}
				xTicks={[0, 0.5, 1, 1.5]}
				yTicks={[0, 2e-4, 4e-4, 6e-4]}
				xFormat={(v: number) => `${v} V`}
				yFormat={(v: number) => `${Math.round(v * 1e6)} µA`}
				yLabel="drain current"
			/>
		{/if}
		<line
			x1={sv(NMOS.vt)}
			x2={sv(NMOS.vt)}
			y1={PY0}
			y2={PY1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<Readout id="vt">
			{@render txt(sv(NMOS.vt) + 6, PY0 + 14, 'threshold 0.5 V', 12, {
				anchor: 'start',
				weight: 600
			})}
		</Readout>
		<path d={curvePath} fill="none" stroke="var(--tc-curve)" stroke-width="3" />
		{#if logScale}
			{@const va = 0.1}
			{@const vb = va + SW}
			<path
				d="M{sv(va)} {yOf(drainCurrent(NMOS, va, VDD))} H{sv(vb)} V{yOf(
					drainCurrent(NMOS, vb, VDD)
				)}"
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.4"
			/>
			<Readout id="swing">
				{@render txt(
					sv(vb) + 8,
					(yOf(drainCurrent(NMOS, va, VDD)) + yOf(drainCurrent(NMOS, vb, VDD))) / 2 + 4,
					'×10',
					12,
					{ anchor: 'start', weight: 700 }
				)}
				{@render txt(
					sv((va + vb) / 2),
					yOf(drainCurrent(NMOS, va, VDD)) + 18,
					`${Math.round(SW * 1000)} mV`,
					12,
					{ weight: 600 }
				)}
			</Readout>
		{:else}
			<Readout id="labels">
				{@render txt(sv(0.25), syLin(0) - 12, 'off', 13, { weight: 700 })}
				{@render txt(sv(1.5), syLin(5.2e-4), 'on: grows as (V − 0.5 V)²', 12, {
					anchor: 'end',
					weight: 600
				})}
			</Readout>
		{/if}
		<text x={PX1} y={PY1 + 34} text-anchor="end" class="halo muted" font-size="11"
			>gate voltage</text
		>
		<Handle
			x={sv(vg)}
			y={yOf(current)}
			label="Gate voltage"
			value={target}
			min={0}
			max={VDD}
			valuetext="{target.toFixed(2)} volts, drain current {amps(current)}"
			color="var(--tc-curve)"
			{onmove}
			{onkey}
		/>
		<Readout
			id="readout"
			order={1}
			label="Gate voltage → drain current"
			value="{target.toFixed(2)} V → {amps(current)}"
		>
			{@render txt(728, 120, `${target.toFixed(2)} V → ${amps(current)}`, 15, {
				anchor: 'start',
				weight: 700
			})}
		</Readout>
		<Readout
			id="state"
			order={2}
			label="Transistor"
			value={state === 'off' ? 'off' : state === 'edge' ? 'at the threshold' : 'on'}
		>
			{@render txt(
				728,
				142,
				state === 'off' ? 'off' : state === 'edge' ? 'at the threshold' : 'on',
				13,
				{
					anchor: 'start',
					weight: 700,
					color: state === 'on' ? 'var(--tc-on)' : 'var(--stage-ink-muted)'
				}
			)}
		</Readout>
	{/if}
</g>
