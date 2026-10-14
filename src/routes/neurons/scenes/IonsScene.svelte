<script lang="ts">
	/**
	 * A patch of the squid axon's membrane between sea water (top) and
	 * axoplasm (bottom), with the measured ion concentrations as dots (one dot
	 * per 12 mM), and a voltmeter scale on the right.
	 *
	 * Modes (`step.hints.mode`):
	 *   nernst — channels for one ion open at t ≈ 0.6 s; ions flow down their
	 *            concentration difference and charge builds up on the
	 *            membrane until the voltage reaches that ion's Nernst
	 *            potential (an exponential approach, slowed down for the eye:
	 *            in reality it takes well under a millisecond). The outside
	 *            concentration of that ion follows the slider.
	 *   ghk    — channels for K⁺, Cl⁻ and Na⁺ are open with the
	 *            Hodgkin–Katz permeabilities; the voltage is the GHK value and
	 *            the arrows through the channels are the GHK currents of each
	 *            ion at that voltage, which cancel.
	 * Under reduced motion the finished balance is shown.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, clamp, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ION_INFO, P_REST, SQUID, ghk, ghkCurrent, nernstOf, type Ion } from '../ions';
	import { replayClock } from './replay';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'nernst'));
	const ion = $derived((['K', 'Na', 'Cl'].includes(String(params.ion)) ? params.ion : 'K') as Ion);
	const factor = $derived(10 ** Number(params.outside ?? 0));
	const pna = $derived(10 ** Number(params.pna ?? Math.log10(0.04)));

	/** Concentrations: sea water's value of the chosen ion scaled by the slider (nernst mode only). */
	const conc = $derived(
		mode === 'nernst'
			? { ...SQUID, [ion]: { inside: SQUID[ion].inside, outside: SQUID[ion].outside * factor } }
			: SQUID
	);
	const P = $derived({ ...P_REST, Na: pna });
	const target = $derived(mode === 'nernst' ? nernstOf(ion, conc) : ghk(P, conc));

	// The voltage follows the target smoothly when a control moves …
	const vT = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = target;
		untrack(() => vT.set(v, { duration: reduced ? 0 : 800 }));
	});
	// … and in nernst mode builds up from 0 each time a new ion's channels open.
	const since = replayClock();
	const sinceOpen = $derived(since(`${mode}|${ion}`, t));
	const OPEN = 0.6;
	const TAU = 0.9;
	const build = $derived(
		mode !== 'nernst' || reduced ? 1 : 1 - Math.exp(-Math.max(0, sinceOpen - OPEN) / TAU)
	);
	const V = $derived(vT.current * build);
	const channelsOpen = $derived(mode !== 'nernst' || reduced ? 1 : smoothstep(0, OPEN, sinceOpen));

	// ---- geometry -----------------------------------------------------------------
	const X0 = 24;
	const X1 = 584;
	const OUT = { y0: 56, y1: 246 };
	const MEM = { y0: 246, y1: 290 };
	const IN = { y0: 290, y1: 520 };
	const ions: Ion[] = ['K', 'Na', 'Cl'];
	const color: Record<Ion, string> = {
		K: 'var(--nr-k)',
		Na: 'var(--nr-na)',
		Cl: 'var(--nr-cl)'
	};

	/** Ion dots: one per 12 mM, at fixed random spots, jiggling a little. */
	const PER_DOT = 12;
	const MAX_DOTS = 60;
	/** Random spots in a compartment, clear of the band of labels along its far edge. */
	const spot = (i: number, salt: number, y0: number, y1: number, top: boolean) => ({
		x: X0 + 18 + hash(i, salt) * (X1 - X0 - 36),
		y: (top ? y0 + 50 : y0 + 16) + hash(i, salt + 7) * (y1 - y0 - 66)
	});
	const dots = $derived(
		ions.flatMap((k, j) =>
			(['outside', 'inside'] as const).flatMap((side) => {
				const n = Math.min(MAX_DOTS, Math.round(conc[k][side] / PER_DOT));
				const box = side === 'outside' ? OUT : IN;
				return Array.from({ length: n }, (_, i) => ({
					key: `${k}-${side}-${i}`,
					ion: k,
					...spot(
						i,
						31 * (j + 1) + (side === 'outside' ? 0 : 101),
						box.y0,
						box.y1,
						side === 'outside'
					),
					ph: hash(i, j + 13)
				}));
			})
		)
	);
	const jig = (ph: number) => ({
		dx: reduced ? 0 : 2.2 * Math.sin(t * 2.1 + ph * 40),
		dy: reduced ? 0 : 2.2 * Math.cos(t * 1.7 + ph * 31)
	});

	// ---- channels ----------------------------------------------------------------
	const channels = $derived(
		mode === 'nernst'
			? [140, 304, 468].map((x, i) => ({ key: `c${i}`, x, ion }))
			: [
					{ key: 'k1', x: 104, ion: 'K' as Ion },
					{ key: 'k2', x: 204, ion: 'K' as Ion },
					{ key: 'cl', x: 304, ion: 'Cl' as Ion },
					{ key: 'na1', x: 404, ion: 'Na' as Ion },
					{ key: 'na2', x: 504, ion: 'Na' as Ion }
				]
	);
	/**
	 * Net outward flow of each channel's ion (its current divided by its
	 * charge, so that chloride moves against its current), scaled for drawing. nernst: the
	 * ion's GHK current at the present voltage (it vanishes at the balance);
	 * ghk: each ion's GHK current at the resting voltage, shared by its channels.
	 */
	const flowOf = (k: Ion) => {
		const z = ION_INFO[k].z;
		if (mode === 'nernst') {
			const i0 = Math.abs(ghkCurrent(k, 1, 0, conc));
			return i0 > 0 ? ghkCurrent(k, 1, V, conc) / z / i0 : 0;
		}
		const share = k === 'Cl' ? 1 : 2;
		const iK = Math.abs(ghkCurrent('K', P.K, V, conc));
		return iK > 0 ? ghkCurrent(k, P[k], V, conc) / z / share / (iK / 2) : 0;
	};
	/** Moving ions through each pore: direction and speed from the flow; carried ions stop at the balance. */
	const crossers = $derived(
		channels.flatMap((c) => {
			const f = flowOf(c.ion) * channelsOpen;
			const strength = clamp(Math.abs(f));
			if (strength < 0.03) return [];
			const outward = f > 0;
			return [0, 1, 2].map((k) => {
				const u = cycle(t, 1.6, k / 3 + hash(c.x, 3));
				const y = outward ? MEM.y1 + 26 - u * 104 : MEM.y0 - 26 + u * 104;
				return {
					key: `${c.key}-${k}`,
					x: c.x,
					y,
					ion: c.ion,
					o: strength * smoothstep(0, 0.15, u) * (1 - smoothstep(0.85, 1, u))
				};
			});
		})
	);
	const arrows = $derived(
		channels.map((c) => {
			const f = flowOf(c.ion) * channelsOpen;
			return { key: c.key, x: c.x, ion: c.ion, f, w: 1.5 + 7 * clamp(Math.abs(f)) };
		})
	);

	// ---- charge on the membrane -----------------------------------------------------
	const nCharges = $derived(Math.round(clamp(Math.abs(V) / 100) * 14));
	const chargeXs = $derived(
		Array.from({ length: nCharges }, (_, i) => X0 + 20 + ((i + 0.5) * (X1 - X0 - 40)) / 14)
	);
	const outerSign = $derived(V < 0 ? '+' : '−');
	const innerSign = $derived(V < 0 ? '−' : '+');

	// ---- the voltmeter ----------------------------------------------------------------
	const SX = 700;
	const SY0 = 80;
	const SY1 = 520;
	const VTOP = 60;
	const VBOT = -100;
	const sy = (v: number) => SY0 + ((VTOP - clamp(v, VBOT, VTOP)) / (VTOP - VBOT)) * (SY1 - SY0);
	const ticks = [60, 40, 20, 0, -20, -40, -60, -80, -100];
	const marks = $derived(
		ions.map((k) => ({
			ion: k,
			v: nernstOf(k, conc),
			strong: mode === 'nernst' ? k === ion : k !== 'Cl',
			o: mode === 'nernst' ? (k === ion ? 1 : 0.35) : k === 'Cl' ? 0.55 : 1
		}))
	);
	const fmt = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))} mV`;
	const markLabel = (k: Ion) => `${ION_INFO[k].symbol} balance`;
	/** Permeability bars (ghk mode), log scale from 0.01 to 30. */
	const pBar = (p: number) => 150 * clamp((Math.log10(p) + 2) / Math.log10(3000));
	const winner = $derived(V < -20 ? 'potassium wins' : V > 20 ? 'sodium wins' : 'a close contest');
	const settled = $derived(build > 0.97);
</script>

<g class="ions">
	<!-- compartments -->
	<rect
		x={X0}
		y={OUT.y0}
		width={X1 - X0}
		height={OUT.y1 - OUT.y0}
		rx="10"
		fill="var(--nr-outside)"
	/>
	<rect x={X0} y={IN.y0} width={X1 - X0} height={IN.y1 - IN.y0} rx="10" fill="var(--nr-inside)" />
	<rect x={X0} y={MEM.y0} width={X1 - X0} height={MEM.y1 - MEM.y0} fill="var(--membrane)" />
	<line x1={X0} x2={X1} y1={MEM.y0} y2={MEM.y0} stroke="var(--membrane-edge)" />
	<line x1={X0} x2={X1} y1={MEM.y1} y2={MEM.y1} stroke="var(--membrane-edge)" />

	<!-- ions -->
	{#each dots as d (d.key)}
		{@const j = jig(d.ph)}
		<circle cx={d.x + j.dx} cy={d.y + j.dy} r="4.5" fill={color[d.ion]} opacity="0.8" />
	{/each}

	<!-- charge layers -->
	{#each chargeXs as x (x)}
		<text
			{x}
			y={MEM.y0 - 5}
			text-anchor="middle"
			font-size="15"
			font-weight="700"
			fill="var(--stage-ink)">{outerSign}</text
		>
		<text
			{x}
			y={MEM.y1 + 15}
			text-anchor="middle"
			font-size="15"
			font-weight="700"
			fill="var(--stage-ink)">{innerSign}</text
		>
	{/each}

	<!-- channels -->
	{#each channels as c (c.key)}
		{@const o = 0.35 + 0.65 * channelsOpen}
		<rect
			x={c.x - 17}
			y={MEM.y0 - 8}
			width="13"
			height={MEM.y1 - MEM.y0 + 16}
			rx="5"
			fill={color[c.ion]}
			opacity={o}
		/>
		<rect
			x={c.x + 4}
			y={MEM.y0 - 8}
			width="13"
			height={MEM.y1 - MEM.y0 + 16}
			rx="5"
			fill={color[c.ion]}
			opacity={o}
		/>
	{/each}
	{#each arrows as a (a.key)}
		{#if Math.abs(a.f) > 0.03}
			{@const up = a.f > 0}
			<path
				d="M{a.x} {up ? MEM.y1 + 30 : MEM.y0 - 30} L{a.x} {up ? MEM.y0 - 34 : MEM.y1 + 34}"
				stroke={color[a.ion]}
				stroke-width={a.w}
				stroke-linecap="round"
				opacity="0.35"
			/>
			<path
				d="M{a.x - 7} {up ? MEM.y0 - 28 : MEM.y1 + 28} L{a.x} {up
					? MEM.y0 - 38
					: MEM.y1 + 38} L{a.x + 7} {up ? MEM.y0 - 28 : MEM.y1 + 28}"
				fill="none"
				stroke={color[a.ion]}
				stroke-width="2.4"
				stroke-linejoin="round"
				opacity="0.8"
			/>
		{/if}
	{/each}
	{#each crossers as c (c.key)}
		<circle
			cx={c.x}
			cy={c.y}
			r="5"
			fill={color[c.ion]}
			stroke="var(--stage-bg)"
			stroke-width="1"
			opacity={c.o}
		/>
	{/each}

	<!-- compartment labels and legend -->
	<Readout
		id="outside"
		order={5}
		label={mode === 'nernst' ? 'Outside: sea water' : undefined}
		value={ions.map((k) => `${ION_INFO[k].symbol} ${Math.round(conc[k].outside)}`).join(' · ') +
			' mM'}
	>
		<Label x={X0 + 12} y={OUT.y0 + 20} anchor="start" text="outside: sea water" size={12} />
		<Label
			x={X0 + 12}
			y={OUT.y0 + 36}
			anchor="start"
			size={11}
			muted
			text={ions.map((k) => `${ION_INFO[k].symbol} ${Math.round(conc[k].outside)}`).join(' · ') +
				' mM'}
		/>
	</Readout>
	<Readout
		id="inside"
		order={6}
		label={mode === 'nernst' ? 'Inside: axoplasm' : undefined}
		value={ions.map((k) => `${ION_INFO[k].symbol} ${conc[k].inside}`).join(' · ') + ' mM'}
	>
		<Label x={X0 + 12} y={IN.y1 - 26} anchor="start" text="inside: axoplasm" size={12} />
		<Label
			x={X0 + 12}
			y={IN.y1 - 10}
			anchor="start"
			size={11}
			muted
			text={ions.map((k) => `${ION_INFO[k].symbol} ${conc[k].inside}`).join(' · ') + ' mM'}
		/>
	</Readout>
	<Readout id="legend">
		{#each ions as k, i (k)}
			<circle cx={X0 + 18 + i * 130} cy={548} r="5" fill={color[k]} />
			<Label
				x={X0 + 30 + i * 130}
				y={552}
				anchor="start"
				size={12}
				text="{ION_INFO[k].symbol} {ION_INFO[k].name}"
			/>
		{/each}
		<Label x={X0 + 400} y={552} anchor="start" size={11} muted text="one dot ≈ 12 mM" />
	</Readout>
	{#if mode === 'nernst'}
		<Readout id="open" order={4} label="Open channels" value="{ION_INFO[ion].symbol} only">
			<Label
				x={X1 - 12}
				y={OUT.y0 + 20}
				anchor="end"
				size={12}
				text="channels open for {ION_INFO[ion].symbol} only"
			/>
		</Readout>
	{/if}

	<!-- voltmeter -->
	<line x1={SX} x2={SX} y1={SY0} y2={SY1} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each ticks as v (v)}
		<line x1={SX - 5} x2={SX + 5} y1={sy(v)} y2={sy(v)} stroke="var(--stage-line)" />
		<text x={SX - 10} y={sy(v) + 4} text-anchor="end" font-size="11" fill="var(--stage-ink-muted)"
			>{v > 0 ? '+' : v < 0 ? '−' : ''}{Math.abs(v)}</text
		>
	{/each}
	<Readout id="scale-title">
		<Label x={SX} y={SY0 - 22} text="voltage inside (mV)" size={12} />
	</Readout>
	{#each marks as m (m.ion)}
		<g opacity={m.o}>
			<line
				x1={SX}
				x2={SX + 22}
				y1={sy(m.v)}
				y2={sy(m.v)}
				stroke={color[m.ion]}
				stroke-width={m.strong ? 3 : 2}
			/>
			<Readout
				id="mark-{m.ion}"
				order={2 + (m.ion === 'K' ? 0 : m.ion === 'Na' ? 0.1 : 0.2)}
				label={markLabel(m.ion)}
				value={fmt(m.v)}
				color={color[m.ion]}
				opacity={m.o > 0.5 ? 1 : 0}
			>
				<Label
					x={SX + 28}
					y={sy(m.v) + 4}
					anchor="start"
					size={12}
					color={color[m.ion]}
					text="{markLabel(m.ion)} {fmt(m.v)}"
				/>
			</Readout>
		</g>
	{/each}
	<!-- the needle -->
	<path d="M{SX - 52} {sy(V) - 9} L{SX - 2} {sy(V)} L{SX - 52} {sy(V) + 9} Z" fill="var(--nr-v)" />
	<Readout id="v" order={1} label="Voltage inside" value={fmt(V)} color="var(--nr-v)">
		<Label
			x={SX - 58}
			y={sy(V) + 5}
			anchor="end"
			size={15}
			weight={700}
			color="var(--nr-v)"
			text={fmt(V)}
		/>
	</Readout>

	{#if mode === 'ghk'}
		<!-- permeabilities -->
		<Readout id="ptitle">
			<Label x={790} y={196} anchor="start" size={12} text="permeability" />
			<Label x={790} y={212} anchor="start" size={11} muted text="relative to K⁺ (log scale)" />
		</Readout>
		{#each ions as k, i (k)}
			{@const p = P[k]}
			<rect
				x={790}
				y={226 + i * 30}
				width={pBar(p)}
				height="14"
				rx="4"
				fill={color[k]}
				opacity="0.85"
			/>
			<Readout
				id="p-{k}"
				order={7 + i}
				label={k === 'Na' ? 'Na⁺ permeability (K⁺ = 1)' : undefined}
				value={p < 0.1 ? p.toFixed(3) : p < 10 ? p.toFixed(2) : p.toFixed(0)}
			>
				<Label x={784} y={238 + i * 30} anchor="end" size={11} text={ION_INFO[k].symbol} />
				<Label
					x={794 + pBar(p)}
					y={238 + i * 30}
					anchor="start"
					size={11}
					muted
					text={p < 0.1 ? p.toFixed(3) : p < 10 ? p.toFixed(2) : p.toFixed(0)}
				/>
			</Readout>
		{/each}
		<Readout id="winner" order={3} label="Tug of war" value={winner}>
			<Label x={SX - 58} y={sy(V) + 24} anchor="end" size={11} muted text={winner} />
		</Readout>
	{:else}
		<Readout
			id="state"
			order={3}
			label="State"
			value={settled ? 'balanced: no net flow' : `${ION_INFO[ion].symbol} flowing`}
			opacity={channelsOpen}
		>
			<Label
				x={SX - 58}
				y={sy(V) + 24}
				anchor="end"
				size={11}
				muted
				opacity={channelsOpen}
				text={settled
					? 'balanced: no net flow'
					: `${ION_INFO[ion].symbol} flowing ${flowOf(ion) > 0 ? 'out' : 'in'}`}
			/>
		</Readout>
	{/if}
</g>
