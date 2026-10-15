<script lang="ts">
	/**
	 * CMOS gates as circuits (`step.hints.phase`):
	 * - inverter: a pMOS from the supply to the output above an nMOS from the output to
	 *   ground, gates joined as the input `params.vin`. Each transistor glows in proportion
	 *   to how far its gate is past threshold; the output and the supply current are the
	 *   model's (`inverterOut`, `inverterCurrent`), and charges stream down through both
	 *   transistors only while both conduct. On the right, the transfer curve with a handle.
	 * - nand: two pMOS in parallel above two nMOS in series, inputs `params.a`, `params.b`;
	 *   the conducting network connects the output to the supply or to ground. On the right,
	 *   the truth table with the current row highlighted.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Handle, clamp, cycle, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import type { Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { amps } from '../../semiconductors/model';
	import { NMOS, VDD, inverterCurrent, inverterOut, nand, switchingPoint } from '../model';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'inverter'));
	const time = $derived(reduced ? 2.5 : t);

	// ---- inverter ----
	const target = $derived(Number(params.vin ?? 0));
	const V = Tween.of(() => target, { duration: 300, easing: cubicInOut });
	const vin = $derived(reduced ? target : V.current);
	const vout = $derived(inverterOut(vin));
	const supply = $derived(inverterCurrent(vin));
	const IPEAK = inverterCurrent(switchingPoint());
	const VM = switchingPoint();
	/** How strongly a transistor conducts, 0…1, from how far its gate is past threshold. */
	const strength = (drive: number) => smoothstep(NMOS.vt - 0.05, NMOS.vt + 0.45, drive);
	const nOn = $derived(strength(vin));
	const pOn = $derived(strength(VDD - vin));

	// ---- NAND ----
	const A = $derived(params.a === true);
	const B = $derived(params.b === true);
	const g = $derived(nand(A, B));

	const isInv = $derived(phase === 'inverter');
	const outHigh = $derived(isInv ? vout > VDD / 2 : g.out);
	const outV = $derived(isInv ? vout : g.out ? VDD : 0);

	// ---- geometry ----
	const X = 270;
	const RAIL = 78;
	const GND = 540;
	const OUT_Y = $derived(isInv ? 300 : 262);
	const OUT_X = 430;

	/** Charges flowing from the supply through both transistors to ground (inverter only). */
	const streams = $derived(
		isInv && supply > 1e-7 ? Math.max(1, Math.round(8 * Math.sqrt(supply / IPEAK))) : 0
	);
	const chargeDots = $derived(
		Array.from({ length: streams }, (_, k) => {
			const u = cycle(time, 2.6, k / streams);
			return {
				k,
				y: lerp(RAIL + 6, GND - 6, u),
				o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u))
			};
		})
	);

	// ---- transfer curve ----
	const sx = scale([0, VDD], [560, 900]);
	const sy = scale([0, 2], [440, 110]);
	const curve = (() => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const v = (VDD * i) / 120;
			d += `${i ? 'L' : 'M'}${sx(v).toFixed(1)} ${sy(inverterOut(v)).toFixed(1)}`;
		}
		return d;
	})();
	const setV = (v: number) => setParam('vin', Math.round(clamp(v, 0, VDD) * 100) / 100);
	const onmove = (p: Point) => setV(sx.invert(p.x));
	const onkey = (k: number | 'start' | 'end') =>
		k === 'start' ? setV(0) : k === 'end' ? setV(VDD) : setV(target + k * 0.01);

	const bit = (v: number) => (v > VDD - 0.4 ? '1' : v < 0.4 ? '0' : '?');
	const rows: [boolean, boolean][] = [
		[false, false],
		[false, true],
		[true, false],
		[true, true]
	];
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

<!-- A MOSFET symbol: channel from (x, y0) to (x, y1), gate plate on the left; a pMOS has a
     bubble on its gate. `on` (0…1) colours the channel. -->
{#snippet mos(x: number, y0: number, y1: number, p: boolean, on: number, name: string)}
	{@const ym = (y0 + y1) / 2}
	<line x1={x} x2={x} y1={y0} y2={y0 + 14} stroke="var(--circ-wire)" stroke-width="2.5" />
	<line x1={x} x2={x} y1={y1 - 14} y2={y1} stroke="var(--circ-wire)" stroke-width="2.5" />
	<line x1={x} x2={x - 18} y1={y0 + 14} y2={y0 + 14} stroke="var(--circ-wire)" stroke-width="2.5" />
	<line x1={x} x2={x - 18} y1={y1 - 14} y2={y1 - 14} stroke="var(--circ-wire)" stroke-width="2.5" />
	<line
		x1={x - 18}
		x2={x - 18}
		y1={y0 + 8}
		y2={y1 - 8}
		stroke={on > 0.5 ? 'var(--tc-on)' : 'var(--tc-off)'}
		stroke-width={2 + 3 * on}
		stroke-dasharray={on > 0.05 ? undefined : '5 4'}
	/>
	<line
		x1={x - 28}
		x2={x - 28}
		y1={y0 + 12}
		y2={y1 - 12}
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>
	{#if p}
		<circle
			cx={x - 35}
			cy={ym}
			r="6"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
	{/if}
	<Readout
		id="mos-{name}"
		order={5}
		label={name}
		value={on > 0.97 ? 'on' : on > 0.05 ? 'partly on' : 'off'}
	>
		{@render txt(x + 14, ym - 4, name, 13, { anchor: 'start', weight: 700 })}
		{@render txt(x + 14, ym + 14, on > 0.97 ? 'on' : on > 0.05 ? 'partly on' : 'off', 13, {
			anchor: 'start',
			weight: 700,
			color: on > 0.5 ? 'var(--tc-on)' : 'var(--stage-ink-muted)'
		})}
	</Readout>
{/snippet}

<g>
	<!-- supply rail and ground -->
	<line x1={X - 130} x2={X + 130} y1={RAIL} y2={RAIL} stroke="var(--circ-high)" stroke-width="3" />
	<Readout id="vdd">
		{@render txt(X, RAIL - 14, 'supply V_DD = 1.8 V', 13, {
			weight: 700,
			color: 'var(--circ-high)'
		})}
	</Readout>
	<line x1={X - 30} x2={X + 30} y1={GND} y2={GND} stroke="var(--circ-low)" stroke-width="3" />
	<line
		x1={X - 18}
		x2={X + 18}
		y1={GND + 8}
		y2={GND + 8}
		stroke="var(--circ-low)"
		stroke-width="2.5"
	/>
	<line
		x1={X - 8}
		x2={X + 8}
		y1={GND + 16}
		y2={GND + 16}
		stroke="var(--circ-low)"
		stroke-width="2"
	/>
	<Readout id="gnd">
		{@render txt(X + 44, GND + 6, 'ground 0 V', 13, {
			anchor: 'start',
			weight: 700,
			color: 'var(--circ-low)'
		})}
	</Readout>

	{#if isInv}
		<!-- pMOS on top, nMOS below -->
		<line x1={X} x2={X} y1={RAIL} y2={130} stroke="var(--circ-wire)" stroke-width="2.5" />
		{@render mos(X, 130, 230, true, pOn, 'pMOS')}
		<line x1={X} x2={X} y1={230} y2={370} stroke="var(--circ-wire)" stroke-width="2.5" />
		{@render mos(X, 370, 470, false, nOn, 'nMOS')}
		<line x1={X} x2={X} y1={470} y2={GND} stroke="var(--circ-wire)" stroke-width="2.5" />
		<!-- input joins both gates -->
		<path
			d="M{X - 41} 180 H140 V420 H{X - 28}"
			fill="none"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="2.5"
		/>
		<line
			x1="90"
			x2="140"
			y1="300"
			y2="300"
			stroke="var(--explainer-accent, var(--accent))"
			stroke-width="2.5"
		/>
		<circle cx="90" cy="300" r="5" fill="var(--explainer-accent, var(--accent))" />
		<Readout id="in" order={1} label="Input" value="{vin.toFixed(2)} V ({bit(vin)})">
			{@render txt(84, 280, `input ${vin.toFixed(2)} V`, 13, {
				anchor: 'start',
				weight: 700,
				color: 'var(--explainer-accent, var(--accent))'
			})}
			{@render txt(84, 326, `= ${bit(vin)}`, 13, {
				anchor: 'start',
				weight: 700,
				color: 'var(--explainer-accent, var(--accent))'
			})}
		</Readout>
		{#each chargeDots as c (c.k)}
			<circle cx={X} cy={c.y} r="4.5" fill="var(--circ-charge)" opacity={c.o} />
		{/each}
	{:else}
		<!-- two pMOS in parallel -->
		{#each [{ x: X - 90, on: g.pA, name: 'pMOS A' }, { x: X + 90, on: g.pB, name: 'pMOS B' }] as m (m.name)}
			<line x1={m.x} x2={m.x} y1={RAIL} y2={110} stroke="var(--circ-wire)" stroke-width="2.5" />
			{@render mos(m.x, 110, 200, true, m.on ? 1 : 0, m.name)}
			<line x1={m.x} x2={m.x} y1={200} y2={OUT_Y} stroke="var(--circ-wire)" stroke-width="2.5" />
			<line
				x1={m.x - 41}
				x2={m.x - 60}
				y1={155}
				y2={155}
				stroke="var(--explainer-accent, var(--accent))"
				stroke-width="2.5"
			/>
		{/each}
		<line
			x1={X - 90}
			x2={X + 90}
			y1={OUT_Y}
			y2={OUT_Y}
			stroke="var(--circ-wire)"
			stroke-width="2.5"
		/>
		<!-- two nMOS in series -->
		<line x1={X} x2={X} y1={OUT_Y} y2={310} stroke="var(--circ-wire)" stroke-width="2.5" />
		{@render mos(X, 310, 400, false, g.nA ? 1 : 0, 'nMOS A')}
		<line x1={X} x2={X} y1={400} y2={430} stroke="var(--circ-wire)" stroke-width="2.5" />
		{@render mos(X, 430, 520, false, g.nB ? 1 : 0, 'nMOS B')}
		<line x1={X} x2={X} y1={520} y2={GND} stroke="var(--circ-wire)" stroke-width="2.5" />
		{#each [{ x: X - 150, y: 155, l: 'A', v: A }, { x: X + 30, y: 155, l: 'B', v: B }, { x: X - 60, y: 355, l: 'A', v: A }, { x: X - 60, y: 475, l: 'B', v: B }] as gi, i (i)}
			{#if i >= 2}
				<line
					x1={X - 28}
					x2={gi.x + 8}
					y1={gi.y}
					y2={gi.y}
					stroke="var(--explainer-accent, var(--accent))"
					stroke-width="2.5"
				/>
			{/if}
			<Readout id="in-{i}">
				{@render txt(gi.x, gi.y + 5, `${gi.l} = ${gi.v ? 1 : 0}`, 13, {
					anchor: 'end',
					weight: 700,
					color: 'var(--explainer-accent, var(--accent))'
				})}
			</Readout>
		{/each}
	{/if}

	<!-- output -->
	<circle cx={X} cy={OUT_Y} r="5" fill="var(--circ-wire)" />
	<line x1={X} x2={OUT_X} y1={OUT_Y} y2={OUT_Y} stroke="var(--circ-wire)" stroke-width="2.5" />
	<circle
		cx={OUT_X + 16}
		cy={OUT_Y}
		r="14"
		fill={outHigh ? 'var(--circ-glow)' : 'var(--surface)'}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Readout
		id="out"
		order={2}
		label="Output"
		value="{outV.toFixed(2)} V ({isInv ? bit(outV) : g.out ? '1' : '0'})"
	>
		{@render txt(OUT_X - 4, OUT_Y - 24, `output ${outV.toFixed(2)} V`, 13, {
			anchor: 'start',
			weight: 700
		})}
		{@render txt(OUT_X + 36, OUT_Y + 5, `= ${isInv ? bit(outV) : g.out ? '1' : '0'}`, 14, {
			anchor: 'start',
			weight: 700
		})}
	</Readout>

	{#if isInv}
		<!-- transfer curve -->
		<Axes
			{sx}
			{sy}
			xTicks={[0, 0.5, 1, 1.5]}
			yTicks={[0, 0.5, 1, 1.5]}
			xFormat={(v: number) => `${v} V`}
			yFormat={(v: number) => `${v} V`}
			yLabel="output"
		/>
		<line
			x1={sx(VM)}
			x2={sx(VM)}
			y1={sy(0)}
			y2={sy(VDD)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<path d={curve} fill="none" stroke="var(--tc-curve)" stroke-width="3" />
		<Readout id="vm">
			{@render txt(sx(VM) + 8, sy(VDD) + 26, `switches at ${VM.toFixed(2)} V`, 12, {
				anchor: 'start',
				weight: 600
			})}
		</Readout>
		<text x={sx(VDD)} y={sy(0) + 34} text-anchor="end" class="halo muted" font-size="11">input</text
		>
		<Handle
			x={sx(vin)}
			y={sy(vout)}
			label="Input voltage"
			value={target}
			min={0}
			max={VDD}
			valuetext="input {target.toFixed(2)} volts, output {vout.toFixed(2)} volts"
			color="var(--tc-curve)"
			{onmove}
			{onkey}
		/>
		<Readout id="supply" order={3} label="Current from supply to ground" value={amps(supply)}>
			<rect
				x="560"
				y="486"
				width="340"
				height="34"
				rx="17"
				fill="var(--surface)"
				stroke={supply > 1e-6 ? 'var(--circ-glow)' : 'var(--border)'}
				stroke-width={supply > 1e-6 ? 2.5 : 1}
			/>
			{@render txt(730, 508, `supply → ground: ${amps(supply)}`, 14, { weight: 700 })}
		</Readout>
		<Readout id="why">
			{@render txt(
				730,
				546,
				supply > 1e-6
					? 'both transistors partly on: current flows'
					: 'one transistor is off: practically no current',
				12,
				{ muted: true }
			)}
		</Readout>
	{:else}
		<!-- truth table -->
		<g>
			<rect
				x="600"
				y="140"
				width="280"
				height="250"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{#each ['A', 'B', 'output'] as h, i (h)}
				{@render txt(650 + i * 80, 176, h, 14, { weight: 700 })}
			{/each}
			<line x1="616" x2="864" y1="190" y2="190" stroke="var(--border)" />
			{#each rows as [ra, rb], r (r)}
				{@const cur = ra === A && rb === B}
				{#if cur}
					<rect
						x="612"
						y={200 + r * 44}
						width="256"
						height="36"
						rx="6"
						fill="var(--explainer-accent, var(--accent))"
						opacity="0.18"
					/>
				{/if}
				{@render txt(650, 224 + r * 44, ra ? '1' : '0', 15, { weight: cur ? 800 : 500 })}
				{@render txt(730, 224 + r * 44, rb ? '1' : '0', 15, { weight: cur ? 800 : 500 })}
				{@render txt(810, 224 + r * 44, nand(ra, rb).out ? '1' : '0', 15, {
					weight: cur ? 800 : 500
				})}
			{/each}
		</g>
		<Readout
			id="path"
			order={3}
			label="Output connected to"
			value={g.out ? 'the supply, through a pMOS' : 'ground, through both nMOS'}
		>
			{@render txt(
				740,
				430,
				g.out ? 'output connected to the supply' : 'output connected to ground',
				14,
				{ weight: 700 }
			)}
			{@render txt(
				740,
				452,
				g.out
					? 'through at least one pMOS; the nMOS chain is broken'
					: 'through both nMOS; both pMOS are off',
				12,
				{ muted: true }
			)}
		</Readout>
	{/if}
</g>
