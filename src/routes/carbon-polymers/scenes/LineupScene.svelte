<script lang="ts">
	/**
	 * Molecules side by side, drawn flat (StructureView).
	 * - `isomers` (step `isomers`): a pair with the same formula (`params.pair`), each with its
	 *   name and measured boiling point (NIST), and both boiling points on one thermometer
	 *   with room temperature marked: the same atoms, a gas and a liquid.
	 * - `gallery` (step `everything`): a fuel, a plastic, a drug and two molecules of life as
	 *   line drawings, each with the formula counted from its drawing.
	 * Cards fade in one after another at the start of the step (a pure function of t; all
	 * shown in the reduced-motion frame).
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { key, name, type Build } from '../molecule';
	import { BUILDS, COMPOUNDS, EXTRAS, type Compound } from '../compounds';
	import { DRAWN, layout, structureFormula, withHydrogens, type Structure } from '../structures';
	import { celsius } from '../look';
	import StructureView from './StructureView.svelte';

	let { step, t, params }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'isomers'));
	const B = (n: number, feature: Build['feature'], at = 1): Build => ({
		n,
		ring: false,
		aromatic: false,
		feature,
		at
	});

	interface Item {
		id: string;
		title: string;
		structure: Structure;
		compound: Compound | undefined;
		note: string;
	}
	const fromBuild = (b: Build, note: string): Item => ({
		id: name(b),
		title: name(b),
		structure: layout(b),
		compound: COMPOUNDS[BUILDS[key(b)]],
		note
	});
	const fromDrawn = (id: string, title: string, note: string): Item => ({
		id,
		title,
		structure: DRAWN[id],
		compound: COMPOUNDS[EXTRAS[id]],
		note
	});
	const PAIRS: Record<string, [Item, Item]> = {
		ether: [
			fromDrawn('ethanol', 'ethanol', 'O at the end, with an H: –OH'),
			fromDrawn('dimethyl ether', 'dimethyl ether', 'O between the carbons, no H on it')
		],
		butane: [
			fromDrawn('butane', 'butane', 'a straight chain'),
			fromDrawn('isobutane', '2-methylpropane (isobutane)', 'a branched chain')
		],
		propanol: [
			fromBuild(B(3, 'OH', 1), '–OH on an end carbon'),
			fromBuild(B(3, 'OH', 2), '–OH on the middle carbon')
		],
		carbonyl: [
			fromBuild(B(3, 'CO', 1), '=O at the end: an aldehyde'),
			fromBuild(B(3, 'CO', 2), '=O in the middle: a ketone (acetone)')
		]
	};
	const pair = $derived(PAIRS[String(params.pair ?? 'ether')] ?? PAIRS.ether);
	const COL = ['var(--cp-chain)', 'var(--cp-chain-2)'];

	const fit = (s: Structure, w: number, h: number, cap: number) => {
		const atoms = withHydrogens(s).atoms;
		const xs = atoms.map((a) => a.x);
		const ys = atoms.map((a) => a.y);
		const bw = Math.max(1, Math.max(...xs) - Math.min(...xs));
		const bh = Math.max(1, Math.max(...ys) - Math.min(...ys));
		const unit = Math.min(cap, w / bw, h / bh);
		return {
			unit,
			dx: -((Math.max(...xs) + Math.min(...xs)) / 2) * unit,
			dy: -((Math.max(...ys) + Math.min(...ys)) / 2) * unit
		};
	};

	// ---- the thermometer (isomers)
	const T = { x0: 90, x1: 870, y: 500 };
	const range = $derived.by(() => {
		const vs = pair.map((p) => (p.compound?.tb ?? 298.15) - 273.15);
		const lo = Math.floor((Math.min(...vs, 25) - 25) / 25) * 25;
		const hi = Math.ceil((Math.max(...vs, 25) + 25) / 25) * 25;
		return { lo, hi };
	});
	const tx = (c: number) => T.x0 + ((c - range.lo) / (range.hi - range.lo)) * (T.x1 - T.x0);
	const ticks = $derived(
		Array.from({ length: Math.round((range.hi - range.lo) / 25) + 1 }, (_, i) => range.lo + i * 25)
	);
	// Lift the second label when the two boiling points are close together.
	const stagger = $derived.by(() => {
		const [a, b] = pair.map((p) => (p.compound?.tb ?? 0) - 273.15);
		return Math.abs(tx(a) - tx(b)) < 150 ? 16 : 0;
	});
	const appear = (i: number) => smoothstep(0.2 + 0.45 * i, 0.8 + 0.45 * i, t);

	// ---- gallery
	/** `marks`: atoms that are stereocentres (glucose's ring form has five: C1–C5). */
	const GALLERY: {
		id: string;
		title: string;
		role: string;
		x: number;
		y: number;
		w: number;
		h: number;
		marks: number[];
	}[] = [
		{ id: 'octane', title: 'octane', role: 'fuel', x: 168, y: 165, w: 270, h: 120, marks: [] },
		{
			id: 'polyethylene',
			title: 'polyethylene',
			role: 'plastic',
			x: 480,
			y: 165,
			w: 270,
			h: 120,
			marks: []
		},
		{
			id: 'ibuprofen',
			title: 'ibuprofen',
			role: 'drug',
			x: 795,
			y: 170,
			w: 270,
			h: 150,
			marks: [6]
		},
		{
			id: 'glucose',
			title: 'glucose',
			role: 'molecule of life',
			x: 300,
			y: 420,
			w: 220,
			h: 180,
			marks: [1, 2, 3, 4, 5]
		},
		{
			id: 'alanine',
			title: 'alanine',
			role: 'molecule of life',
			x: 660,
			y: 420,
			w: 200,
			h: 150,
			marks: [1]
		}
	];
	const sub = (s: string) => s.replace(/\d+/g, (d) => [...d].map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join(''));
	const galleryFormula = (id: string) =>
		id === 'polyethylene' ? '(C₂H₄)ₙ' : sub(structureFormula(DRAWN[id], true));
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
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		font-size={size}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g style:pointer-events="none">
	{#if mode === 'isomers'}
		<Readout id="formula" order={0} label="Both are" value={sub(pair[0].compound?.formula ?? '')}>
			{@render txt(480, 44, sub(pair[0].compound?.formula ?? ''), 26, {
				anchor: 'middle',
				weight: 700
			})}
			{@render txt(480, 66, 'the same atoms, arranged differently', 13, {
				anchor: 'middle',
				muted: true
			})}
		</Readout>
		{#each pair as p, i (p.id)}
			{@const cx = i === 0 ? 250 : 710}
			{@const f = fit(p.structure, 300, 190, 95)}
			{@const tb = p.compound?.tb}
			{@const gas = tb != null && tb < 298.15}
			<g opacity={appear(i)}>
				<rect
					x={cx - 210}
					y="88"
					width="420"
					height="330"
					rx="14"
					fill="var(--surface)"
					stroke={COL[i]}
					stroke-opacity="0.6"
				/>
				<StructureView structure={p.structure} cx={cx + f.dx} cy={226 + f.dy} unit={f.unit} />
				<Readout
					id="iso-{i}"
					order={1 + i}
					label={p.title}
					value={tb != null ? `boils at ${celsius(tb)}` : 'no NIST value'}
					note={p.note}
					color={COL[i]}
				>
					{@render txt(cx, 352, p.title, 17, { anchor: 'middle', weight: 700, color: COL[i] })}
					{@render txt(cx, 372, p.note, 12, { anchor: 'middle', muted: true })}
					{@render txt(
						cx,
						400,
						tb != null ? `boils at ${celsius(tb)}: ${gas ? 'a gas' : 'a liquid'} at 25 °C` : '',
						14,
						{ anchor: 'middle', weight: 600 }
					)}
				</Readout>
			</g>
		{/each}

		<!-- thermometer -->
		<Readout id="thermo">
			<g>
				<rect
					x={T.x0}
					y={T.y - 6}
					width={tx(25) - T.x0}
					height="12"
					rx="6"
					fill="var(--cp-liquid)"
				/>
				<rect
					x={tx(25)}
					y={T.y - 6}
					width={T.x1 - tx(25)}
					height="12"
					rx="6"
					fill="var(--cp-hot)"
					fill-opacity="0.18"
				/>
				{#each ticks as c (c)}
					<line x1={tx(c)} x2={tx(c)} y1={T.y + 8} y2={T.y + 13} stroke="var(--stage-ink-muted)" />
					{@render txt(tx(c), T.y + 27, `${c} °C`.replace('-', '−'), 11, {
						anchor: 'middle',
						muted: true
					})}
				{/each}
				<line
					x1={tx(25)}
					x2={tx(25)}
					y1={T.y - 26}
					y2={T.y + 8}
					stroke="var(--stage-ink)"
					stroke-dasharray="3 3"
				/>
				{@render txt(tx(25), T.y + 48, 'room temperature, 25 °C', 11, { anchor: 'middle' })}
				{#each pair as p, i (p.id)}
					{#if p.compound?.tb != null}
						{@const x = tx(p.compound.tb - 273.15)}
						<g opacity={appear(i)}>
							<circle
								cx={x}
								cy={T.y}
								r="8"
								fill={COL[i]}
								stroke="var(--stage-bg)"
								stroke-width="2"
							/>
							{@render txt(x, T.y - 16 - i * stagger, `${p.title.split(' (')[0]} boils`, 11, {
								anchor: 'middle',
								weight: 600,
								color: COL[i]
							})}
						</g>
					{/if}
				{/each}
				{@render txt(T.x0, T.y - 52, 'boiling points (NIST, 1 atm)', 11, { muted: true })}
				{@render txt(T.x0 + 4, T.y + 4, 'gas at 25 °C', 10, { weight: 600 })}
				{@render txt(T.x1 - 4, T.y + 4, 'liquid at 25 °C', 10, { anchor: 'end', weight: 600 })}
			</g>
		</Readout>
	{:else}
		<Readout id="title" order={0} label="Made of" value="C, H, O, N">
			{@render txt(480, 40, 'Five molecules, four elements: C, H, O, N', 17, {
				anchor: 'middle',
				weight: 700
			})}
		</Readout>
		{#each GALLERY as g, i (g.id)}
			{@const s = DRAWN[g.id]}
			{@const f = fit(s, g.w - 40, g.h - 60, 44)}
			{@const o = appear(i * 0.6)}
			<g opacity={o}>
				<rect
					x={g.x - g.w / 2 - 12}
					y={g.y - g.h / 2 - 28}
					width={g.w + 24}
					height={g.h + 64}
					rx="14"
					fill="var(--surface)"
					stroke="var(--border)"
				/>
				<StructureView structure={s} cx={g.x + f.dx} cy={g.y + f.dy - 6} unit={f.unit} skeletal />
				{#if g.id === 'polyethylene'}
					{@const xs = s.atoms.map((a) => g.x + f.dx + a.x * f.unit)}
					<text
						x={Math.min(...xs) - 18}
						y={g.y + 6}
						text-anchor="middle"
						font-size="26"
						class="muted">…</text
					>
					<text
						x={Math.max(...xs) + 18}
						y={g.y + 6}
						text-anchor="middle"
						font-size="26"
						class="muted">…</text
					>
				{/if}
				{#each g.marks as mk (mk)}
					{@const a = s.atoms[mk]}
					<text
						x={g.x + f.dx + a.x * f.unit + 10}
						y={g.y + f.dy - 6 + a.y * f.unit - 8}
						font-weight="700"
						font-size="16"
						style:fill="var(--cp-number)">*</text
					>
				{/each}
				<Readout
					id="g-{g.id}"
					order={1 + i}
					label="{g.title} ({g.role})"
					value={galleryFormula(g.id)}
				>
					{@render txt(g.x - g.w / 2, g.y - g.h / 2 - 8, g.title, 15, { weight: 700 })}
					{@render txt(g.x + g.w / 2, g.y - g.h / 2 - 8, g.role, 12, {
						anchor: 'end',
						weight: 600,
						color: 'var(--cp-group)'
					})}
					{@render txt(g.x, g.y + g.h / 2 + 26, galleryFormula(g.id), 15, {
						anchor: 'middle',
						weight: 700
					})}
				</Readout>
			</g>
		{/each}
		<Readout id="key">
			{@render txt(
				480,
				588,
				'* a stereocentre (four different groups)  ·  each corner of a line drawing is a carbon',
				11,
				{
					anchor: 'middle',
					muted: true
				}
			)}
		</Readout>
	{/if}
</g>
