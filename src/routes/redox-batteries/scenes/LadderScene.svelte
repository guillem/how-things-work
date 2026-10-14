<script lang="ts">
	/**
	 * The ladder of standard reduction potentials (`potentials.ts`): a rung per couple at
	 * its E°, the band where water is stable (0 to 1.23 V at pH 0), and the two electrodes
	 * chosen with `metalA` / `metalB`. Whichever sits higher is reduced (the cathode), the
	 * lower one is oxidised (the anode), whatever control it came from; the bracket between
	 * them is the cell voltage, E°cathode − E°anode. Electrons (dots) climb from the lower
	 * rung to the higher one. Labels are spread apart where rungs crowd (around 0 V) and
	 * joined to their rungs by short leaders.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { COUPLES, E0_HYDROGEN, E0_OXYGEN } from '../potentials';
	import { pairing } from '../model';
	import { fmtV } from '../look';

	/** An E° as the table prints it, with a true minus sign. */
	const e0s = (v: number) => (v < 0 ? `−${-v}` : v > 0 ? `+${v}` : '0');

	let { t, params, reduced }: StageProps = $props();

	const p = $derived(pairing(String(params.metalA ?? 'zn'), String(params.metalB ?? 'cu')));
	const same = $derived(p.anode.id === p.cathode.id);

	const Y0 = 70;
	const Y1 = 545;
	const sy = scale([-3.3, 1.7], [Y1, Y0]);
	const AX = 92;
	const R0 = 100;
	const R1 = 250;
	const LX = 280;
	const BX = 520;

	// The metals plus the hydrogen electrode (0 V by definition), bottom to top.
	const RUNGS = [
		...COUPLES.map((c) => ({ id: c.id, name: `${c.ion} / ${c.symbol}`, e0: c.e0 })),
		{ id: 'h', name: '2H⁺ / H₂', e0: E0_HYDROGEN }
	].sort((a, b) => a.e0 - b.e0);

	// Label positions: the rungs' own heights, pushed apart to at least 21 units.
	const labelY = (() => {
		const ys = RUNGS.map((c) => sy(c.e0));
		const out = ys.slice();
		// COUPLES run from the bottom (most negative, largest y) upwards.
		for (let i = 0; i < out.length - 1; i++) {
			if (out[i] - out[i + 1] < 21) out[i + 1] = out[i] - 21;
		}
		return out;
	})();

	const opts = { duration: 700, easing: cubicInOut };
	const yA = Tween.of(() => sy(p.anode.e0), opts);
	const yC = Tween.of(() => sy(p.cathode.e0), opts);
	const ya = $derived(reduced ? sy(p.anode.e0) : yA.current);
	const yc = $derived(reduced ? sy(p.cathode.e0) : yC.current);

	const electrons = $derived(
		same
			? []
			: Array.from({ length: 4 }, (_, i) => {
					const u = cycle(t, 3, i / 4);
					return {
						i,
						y: ya + (yc - ya) * u,
						o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.88, 1, u))
					};
				})
	);
	const vText = $derived(fmtV(p.voltage, 3));
	const sum = $derived(
		same
			? 'same metal on both sides: no step, 0 V'
			: `${e0s(p.cathode.e0)} − (${e0s(p.anode.e0)}) = ${vText}`
	);
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- water's stability window at pH 0 -->
	<rect
		x={R0}
		y={sy(E0_OXYGEN)}
		width={BX - 40 - R0}
		height={sy(0) - sy(E0_OXYGEN)}
		fill="var(--rb-water)"
		opacity="0.55"
	/>
	<Readout id="water">
		<Label
			x={R0 + 8}
			y={sy(E0_OXYGEN) + 16}
			text="water is stable here"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- axis -->
	<line x1={AX} x2={AX} y1={Y0} y2={Y1} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each [-3, -2, -1, 0, 1] as v (v)}
		<line x1={AX - 5} x2={AX} y1={sy(v)} y2={sy(v)} stroke="var(--stage-line)" />
		<text x={AX - 9} y={sy(v) + 4} text-anchor="end" style:font-size="11px" class="muted"
			>{v} V</text
		>
	{/each}
	<Readout id="axis">
		<Label x={AX} y={Y0 - 26} text="E°: pull on electrons" size={12} anchor="start" />
		<Label
			x={AX}
			y={Y0 - 10}
			text="(volts vs the hydrogen electrode)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- rungs -->
	{#each RUNGS as c, i (c.id)}
		{@const chosen = c.id === p.anode.id || c.id === p.cathode.id}
		{@const color =
			c.id === p.cathode.id
				? 'var(--rb-cathode)'
				: c.id === p.anode.id
					? 'var(--rb-li)'
					: 'var(--stage-ink-muted)'}
		<g opacity={chosen ? 1 : 0.55}>
			<line
				x1={R0}
				x2={R1}
				y1={sy(c.e0)}
				y2={sy(c.e0)}
				stroke={color}
				stroke-width={chosen ? 3.5 : 1.5}
				stroke-linecap="round"
			/>
			<path d="M{R1} {sy(c.e0)} L{LX - 8} {labelY[i]}" stroke="var(--stage-line)" fill="none" />
			<text
				x={LX}
				y={labelY[i] + 4}
				style:font-size="12px"
				font-weight={chosen ? 700 : 400}
				style:fill={chosen ? color : undefined}>{c.name}</text
			>
			<text
				x={LX + 150}
				y={labelY[i] + 4}
				text-anchor="end"
				style:font-size="12px"
				font-weight={chosen ? 700 : 400}
				style:fill={chosen ? color : undefined}>{e0s(c.e0)}</text
			>
		</g>
	{/each}

	<!-- the step between the two chosen rungs -->
	{#if !same}
		<line
			x1={LX + 160}
			x2={BX}
			y1={ya}
			y2={ya}
			stroke="var(--rb-li)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		<line
			x1={LX + 160}
			x2={BX}
			y1={yc}
			y2={yc}
			stroke="var(--rb-cathode)"
			stroke-dasharray="4 4"
			opacity="0.7"
		/>
		<line
			x1={BX}
			x2={BX}
			y1={ya}
			y2={yc}
			stroke="var(--rb-gap)"
			stroke-width="10"
			stroke-linecap="round"
			opacity="0.85"
		/>
		{#each electrons as e (e.i)}
			<circle
				cx={BX}
				cy={e.y}
				r="5"
				fill="var(--rb-electron)"
				stroke="var(--stage-bg)"
				opacity={e.o}
			/>
		{/each}
		<Readout id="gap" order={1} label="Cell voltage, E°cathode − E°anode" value={vText}>
			<text x={BX + 16} y={(ya + yc) / 2 + 9} style:font-size="26px" font-weight="700">{vText}</text
			>
		</Readout>
		<Readout id="eup">
			<Label
				x={BX + 16}
				y={(ya + yc) / 2 + 30}
				text="electrons climb"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	<!-- panel -->
	<Readout
		id="cath"
		order={2}
		label="Reduced (cathode, +)"
		value={same ? '—' : p.cathode.reaction}
		color="var(--rb-cathode)"
	>
		<Label x={700} y={110} text="reduced, at the cathode (+):" size={12} anchor="start" muted />
		<Label
			x={700}
			y={132}
			text={same ? '—' : p.cathode.reaction}
			size={14}
			anchor="start"
			weight={600}
			color="var(--rb-cathode)"
		/>
	</Readout>
	<Readout
		id="an"
		order={3}
		label="Oxidised (anode, −)"
		value={same ? '—' : p.anode.reaction.split(' → ').reverse().join(' → ')}
		color="var(--rb-li)"
	>
		<Label x={700} y={170} text="oxidised, at the anode (−):" size={12} anchor="start" muted />
		<Label
			x={700}
			y={192}
			text={same ? '—' : p.anode.reaction.split(' → ').reverse().join(' → ')}
			size={14}
			anchor="start"
			weight={600}
			color="var(--rb-li)"
		/>
	</Readout>
	<Readout id="sum" order={4} label="E°cell" value={sum}>
		<Label x={700} y={236} text="E°cell = E°cathode − E°anode" size={12} anchor="start" muted />
		<Label x={700} y={258} text={sum} size={13} anchor="start" weight={600} />
	</Readout>
</g>
