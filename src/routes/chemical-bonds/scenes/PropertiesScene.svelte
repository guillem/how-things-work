<script lang="ts">
	/**
	 * Boiling points of four small molecules of almost the same mass (`BOILING` in
	 * ../model.ts, NIST WebBook), as bars on a kelvin axis that starts at absolute zero (so
	 * bar heights are honest), labelled in °C. Under each bar: the molecule (from
	 * `analyse()`, drawn small from a fixed viewpoint, with the charge-map tint), its molar
	 * mass (from the element data) and whether it is polar. On the right, two water
	 * molecules held by a hydrogen bond. Bars grow in at the start of the step.
	 *
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BOILING, analyse, celsius, molarMass, type Molecule, type Sym } from '../model';
	import { ATOM, NEG, POS, atomRadius, bondLength, projector } from '../look';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);

	const Y0 = 400; // 0 K
	const Y400 = 70; // 400 K
	const yOf = (k: number) => Y0 + (k / 400) * (Y400 - Y0);
	const ROOM = 293.15; // 20 °C

	const bars = [...BOILING]
		.sort((a, b) => a.kelvin - b.kelvin)
		.map((b, i) => {
			const r = analyse(b.molecule);
			return {
				i,
				x: 130 + i * 128,
				kelvin: b.kelvin,
				celsius: celsius(b.kelvin),
				formula: r.formula,
				name: r.name ?? '',
				polar: r.polar,
				mass: Math.round(molarMass(b.molecule)),
				molecule: b.molecule
			};
		});

	/** A molecule drawn small from a fixed viewpoint, tinted by the charge map. */
	function mini(m: Molecule, cx: number, cy: number) {
		const r = analyse(m);
		const project = projector(0.6, 0.25, cx, cy);
		const atoms: { k: string; x: number; y: number; r: number; s: Sym; q: number; d: number }[] = [
			{ k: 'c', x: cx, y: cy, r: atomRadius(m.centre, 0.55), s: m.centre, q: r.charges[0], d: 0 }
		];
		const bonds: { k: string; x2: number; y2: number }[] = [];
		for (const d of r.domains) {
			if (d.kind !== 'bond' || d.ligand === undefined) continue;
			const s = m.ligands[d.ligand];
			const L = bondLength(m.centre, s, 0.42);
			const p = project([d.dir[0] * L, d.dir[1] * L, d.dir[2] * L]);
			atoms.push({
				k: `l${d.ligand}`,
				x: p.x,
				y: p.y,
				r: atomRadius(s, 0.55),
				s,
				q: r.charges[d.ligand + 1],
				d: p.depth
			});
			bonds.push({ k: `b${d.ligand}`, x2: p.x, y2: p.y });
		}
		atoms.sort((a, b) => a.d - b.d);
		return { atoms, bonds };
	}
	const minis = bars.map((b) => mini(b.molecule, b.x, 470));

	// Phone readouts: the bars' labels in one row.
	const deg = (c: number) => `${c < 0 ? '−' : ''}${Math.abs(c)} °C`;
	const boilRow = bars.map((b) => `${b.formula} ${deg(b.celsius)}`).join(' · ');
	const masses = bars.map((b) => b.mass);
	const boilNote = `polar: ${bars
		.filter((b) => b.polar)
		.map((b) => b.formula)
		.join(', ')} · ${Math.min(...masses)}–${Math.max(...masses)} g/mol · NIST Chemistry WebBook`;
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
	<!-- <Readout>: on narrow screens these are listed as HTML under the stage -->
	<Readout
		id="boiling"
		order={1}
		label="Boiling point at normal pressure"
		value={boilRow}
		note={boilNote}
	>
		{@render txt(70, 40, 'Boiling point at normal pressure', 15, { anchor: 'start', weight: 700 })}
	</Readout>
	<!-- axis -->
	{#each [0, 100, 200, 300, 400] as k (k)}
		<line x1="70" y1={yOf(k)} x2="600" y2={yOf(k)} stroke="var(--stage-grid)" stroke-width="1.5" />
		{@render txt(62, yOf(k) + 4, `${k} K`, 11, { anchor: 'end', muted: true })}
	{/each}
	<line x1="70" y1={Y0} x2="600" y2={Y0} stroke="var(--stage-line)" stroke-width="1.5" />
	{@render txt(74, Y0 + 14, '0 K = absolute zero', 10, { anchor: 'start', muted: true })}

	<!-- bars -->
	{#each bars as b (b.i)}
		{@const grow = smoothstep(0, 1, clamp((time - 0.2 - b.i * 0.15) / 1.4))}
		{@const top = yOf(b.kelvin * grow)}
		<rect
			x={b.x - 34}
			y={top}
			width="68"
			height={Y0 - top}
			rx="4"
			fill={b.polar ? NEG : 'var(--stage-ink-muted)'}
			fill-opacity={b.polar ? 0.25 + 0.15 * b.i : 0.35}
			stroke={b.polar ? NEG : 'var(--stage-ink-muted)'}
		/>
		<Readout id="bar-{b.i}">
			<g opacity={smoothstep(0.85, 1, grow)}>
				{@render txt(b.x, top - 24, `${b.celsius < 0 ? '−' : ''}${Math.abs(b.celsius)} °C`, 16, {
					weight: 700
				})}
				{@render txt(b.x, top - 8, `${b.kelvin.toFixed(0)} K`, 11, { muted: true })}
			</g>
		</Readout>
	{/each}

	<!-- room temperature -->
	<line
		x1="70"
		y1={yOf(ROOM)}
		x2="600"
		y2={yOf(ROOM)}
		stroke="var(--focus)"
		stroke-width="1.5"
		stroke-dasharray="6 5"
	/>
	<Readout id="room">
		{@render txt(604, yOf(ROOM) + 4, 'room temp.', 11, { anchor: 'start', color: 'var(--focus)' })}
		{@render txt(604, yOf(ROOM) + 18, '(20 °C)', 11, { anchor: 'start', color: 'var(--focus)' })}
	</Readout>

	<!-- the molecules -->
	{#each bars as b (b.i)}
		{@const mm = minis[b.i]}
		{#each mm.bonds as bd (bd.k)}
			<line
				x1={b.x}
				y1="470"
				x2={bd.x2}
				y2={bd.y2}
				stroke="var(--stage-ink-muted)"
				stroke-width="4"
				stroke-linecap="round"
			/>
		{/each}
		{#each mm.atoms as at (at.k)}
			<circle
				cx={at.x}
				cy={at.y}
				r={at.r + 6}
				fill={at.q < 0 ? NEG : POS}
				fill-opacity={0.1 + 0.4 * clamp(Math.abs(at.q) / 1.4)}
			/>
			<circle cx={at.x} cy={at.y} r={at.r} fill={ATOM[at.s].fill} stroke={ATOM[at.s].edge} />
		{/each}
		{@render txt(b.x, 527, b.formula, 15, { weight: 700 })}
		<Readout id="mol-{b.i}">
			{@render txt(b.x, 545, `${b.name}, ${b.mass} g/mol`, 11, { muted: true })}
			{@render txt(b.x, 563, b.polar ? 'polar' : 'not polar', 12, {
				weight: 600,
				color: b.polar ? NEG : undefined
			})}
		</Readout>
	{/each}

	<!-- a hydrogen bond between two water molecules -->
	<g transform="translate(790 150)">
		<Readout id="why-title">
			{@render txt(0, -80, 'Why water boils so late', 14, { weight: 700 })}
		</Readout>
		<!-- left molecule: O with an H pointing right -->
		<line x1="-80" y1="0" x2="-38" y2="0" stroke="var(--stage-ink-muted)" stroke-width="4" />
		<line x1="-80" y1="0" x2="-100" y2="38" stroke="var(--stage-ink-muted)" stroke-width="4" />
		<circle cx="-80" cy="0" r="20" fill={ATOM.O.fill} stroke={ATOM.O.edge} />
		<circle cx="-38" cy="0" r="12" fill={ATOM.H.fill} stroke={ATOM.H.edge} />
		<circle cx="-100" cy="38" r="12" fill={ATOM.H.fill} stroke={ATOM.H.edge} />
		{@render txt(-38, -20, 'δ+', 14, { weight: 700, color: POS })}
		<!-- right molecule: a lone pair facing left -->
		<ellipse cx="34" cy="0" rx="13" ry="10" fill={NEG} fill-opacity="0.3" />
		<circle cx="30" cy="-4" r="2.5" fill="var(--stage-ink)" />
		<circle cx="30" cy="4" r="2.5" fill="var(--stage-ink)" />
		<line x1="66" y1="0" x2="96" y2="32" stroke="var(--stage-ink-muted)" stroke-width="4" />
		<line x1="66" y1="0" x2="96" y2="-32" stroke="var(--stage-ink-muted)" stroke-width="4" />
		<circle cx="66" cy="0" r="20" fill={ATOM.O.fill} stroke={ATOM.O.edge} />
		<circle cx="96" cy="32" r="12" fill={ATOM.H.fill} stroke={ATOM.H.edge} />
		<circle cx="96" cy="-32" r="12" fill={ATOM.H.fill} stroke={ATOM.H.edge} />
		{@render txt(66, -30, 'δ−', 14, { weight: 700, color: NEG })}
		<line
			x1="-24"
			y1="0"
			x2="18"
			y2="0"
			stroke="var(--stage-ink)"
			stroke-width="2"
			stroke-dasharray="3 4"
		/>
		<Readout id="hbond">
			{@render txt(0, 64, 'hydrogen bond: a δ+ hydrogen', 12, { weight: 600 })}
			{@render txt(0, 80, 'held by a lone pair next door', 12, { weight: 600 })}
		</Readout>
		<Readout
			id="why"
			order={3}
			label="Why water boils so late"
			value="hydrogen bonds: a δ+ H held by a lone pair next door"
			note="bent and polar, each water molecule clings to up to four neighbours; methane, non-polar and symmetric, hardly clings at all"
		>
			{@render txt(0, 112, 'Bent and polar, each water molecule', 12)}
			{@render txt(0, 128, 'clings to up to four neighbours.', 12)}
			{@render txt(0, 160, 'Methane, non-polar and symmetric,', 12)}
			{@render txt(0, 176, 'hardly clings at all.', 12)}
		</Readout>
		<Readout
			id="moral"
			order={4}
			label="Same size, different shape and polarity"
			value="different properties"
		>
			{@render txt(0, 214, 'Same size, different shape and', 13, { weight: 700 })}
			{@render txt(0, 231, 'polarity: different properties.', 13, { weight: 700 })}
		</Readout>
	</g>
	<Readout id="source">
		{@render txt(790, 584, 'Data: NIST Chemistry WebBook', 11, { muted: true })}
	</Readout>
</g>
