<script lang="ts">
	/**
	 * Where a Turing-type mechanism is well supported, where the evidence is mixed and where it
	 * is contested: three columns of cases, each with a small drawing, its signals and a source.
	 * The cards come in one after another over the first two seconds (complete when reduced).
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	type Icon =
		'digits' | 'follicles' | 'palate' | 'feathers' | 'zebrafish' | 'angelfish' | 'zebra' | 'print';
	interface Case {
		icon: Icon;
		name: string;
		lines: string[];
	}
	interface Column {
		id: string;
		title: string;
		colour: string;
		cases: Case[];
		/** A boxed note under the cases. */
		note?: { title: string; lines: string[] };
	}
	const columns: Column[] = [
		{
			id: 'supported',
			title: 'well supported',
			colour: 'var(--tp-good)',
			cases: [
				{
					icon: 'digits',
					name: 'digit spacing',
					lines: ['BMP–SOX9–WNT, tuned by Hox', 'Sheth 2012 · Raspopovic 2014']
				},
				{
					icon: 'follicles',
					name: 'hair follicles',
					lines: ['WNT and its inhibitor DKK', 'Sick 2006']
				},
				{ icon: 'palate', name: 'palate ridges', lines: ['FGF and SHH', 'Economou 2012'] },
				{
					icon: 'feathers',
					name: 'feather buds',
					lines: ['BMP inhibits; cell mechanics', 'helps start them (Shyer 2017)']
				}
			]
		},
		{
			id: 'mixed',
			title: 'mixed',
			colour: 'var(--tp-mixed)',
			cases: [
				{
					icon: 'zebrafish',
					name: 'zebrafish stripes',
					lines: [
						'Turing-like, but made by pigment',
						'cells that touch and move',
						'(Nakamasu 2009)'
					]
				},
				{
					icon: 'angelfish',
					name: 'angelfish stripes',
					lines: [
						'inserted as the fish grows',
						'(Kondo & Asai 1995); cell',
						'movement can do it too'
					]
				}
			],
			note: {
				title: 'chemistry alone can do it',
				lines: [
					'Stationary spots and stripes in a gel',
					'of reacting chemicals, the CIMA',
					'reaction (Castets 1990; Ouyang',
					'& Swinney 1991)'
				]
			}
		},
		{
			id: 'contested',
			title: 'contested',
			colour: 'var(--tp-contested)',
			cases: [
				{
					icon: 'zebra',
					name: 'zebra stripes',
					lines: ['Turing-type models exist;', 'no signals identified']
				},
				{
					icon: 'print',
					name: 'fingerprints',
					lines: [
						'EDAR–WNT–BMP: experiments and',
						'modelling (Glover 2023); recent,',
						'and buckling is a rival idea'
					]
				}
			],
			note: {
				title: 'the test',
				lines: [
					'Find both signals, show that the',
					'inhibitor acts further away, and',
					'change the spacing by changing them.',
					'A look-alike pattern is not enough.'
				]
			}
		}
	];

	const CX = [24, 336, 648];
	const CW = 288;
	const TOP = 40;
	const ROW = 124;
	const NOTE_Y = TOP + 330;
	const tt = $derived(reduced ? 10 : t);
	const show = (col: number, i: number) => smoothstep(0, 0.5, tt - 0.2 - col * 0.5 - i * 0.18);
</script>

{#snippet icon(kind: Icon, x: number, y: number, colour: string)}
	<g transform="translate({x} {y})">
		<rect x="0" y="0" width="64" height="64" rx="10" fill="var(--tp-low)" stroke="var(--border)" />
		{#if kind === 'digits'}
			<!-- a paw: a palm and five evenly spaced digits -->
			<ellipse cx="32" cy="46" rx="17" ry="11" fill={colour} />
			{#each [-16, -8, 0, 8, 16] as dx, i (i)}
				<rect
					x={30 + dx}
					y={14 + Math.abs(dx) * 0.4}
					width="5"
					height="22"
					rx="2.5"
					fill={colour}
				/>
			{/each}
		{:else if kind === 'follicles' || kind === 'feathers'}
			<!-- a hexagonal array of buds -->
			{#each [0, 1, 2, 3] as r (r)}
				{#each [0, 1, 2, 3] as c (c)}
					<circle
						cx={10 + c * 14 + (r % 2) * 7}
						cy={11 + r * 14}
						r={kind === 'feathers' ? 4.5 : 3}
						fill={colour}
					/>
				{/each}
			{/each}
		{:else if kind === 'palate'}
			<!-- the roof of the mouth with its ridges -->
			<path d="M10 56 C10 14 54 14 54 56" fill="none" stroke={colour} stroke-width="2" />
			{#each [22, 30, 38, 46] as y (y)}
				<path d="M{18} {y} Q32 {y - 6} {46} {y}" fill="none" stroke={colour} stroke-width="3" />
			{/each}
		{:else if kind === 'zebrafish'}
			<!-- a fish with lengthwise stripes -->
			<path d="M8 32 Q26 14 48 32 Q26 50 8 32 Z" fill="none" stroke={colour} stroke-width="1.6" />
			<path d="M48 32 L58 24 L58 40 Z" fill={colour} />
			{#each [26, 32, 38] as y (y)}
				<line x1="14" x2="44" y1={y} y2={y} stroke={colour} stroke-width="2.4" />
			{/each}
		{:else if kind === 'angelfish'}
			<!-- a tall, round fish with arched stripes across its body -->
			<ellipse cx="30" cy="32" rx="20" ry="22" fill="none" stroke={colour} stroke-width="1.6" />
			<path d="M50 32 L60 24 L60 40 Z" fill={colour} />
			{#each [18, 27, 36] as x (x)}
				<path d="M{x} 14 Q{x + 8} 32 {x} 50" fill="none" stroke={colour} stroke-width="2.4" />
			{/each}
		{:else if kind === 'zebra'}
			<!-- bold stripes on a flank -->
			{#each [0, 1, 2, 3, 4] as i (i)}
				<path
					d="M{6 + i * 12} 8 Q{14 + i * 12} 32 {6 + i * 12} 56"
					fill="none"
					stroke={colour}
					stroke-width="5"
				/>
			{/each}
		{:else}
			<!-- a fingerprint whorl -->
			{#each [6, 11, 16, 21, 26] as r (r)}
				<path
					d="M{32 - r} 36 A{r} {r * 0.9} 0 1 1 {32 + r} 36"
					fill="none"
					stroke={colour}
					stroke-width="2"
				/>
			{/each}
		{/if}
	</g>
{/snippet}

<g>
	{#each columns as col, ci (col.id)}
		<g opacity={show(ci, 0)}>
			<rect
				x={CX[ci]}
				y={TOP}
				width={CW}
				height={540}
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<rect x={CX[ci]} y={TOP} width={CW} height="8" rx="4" fill={col.colour} />
			<Readout
				id="col-{col.id}"
				order={ci + 1}
				label={col.title}
				color={col.colour}
				value={col.cases.map((c) => c.name).join(', ')}
			>
				<Label
					anchor="start"
					x={CX[ci] + 18}
					y={TOP + 38}
					text={col.title}
					size={16}
					weight={700}
					color={col.colour}
					halo={false}
				/>
			</Readout>
		</g>
		{#if col.note}
			<Readout id="note-{col.id}">
				<g opacity={show(ci, col.cases.length + 1)}>
					<rect
						x={CX[ci] + 16}
						y={NOTE_Y}
						width={CW - 32}
						height={34 + col.note.lines.length * 17}
						rx="8"
						fill="none"
						stroke={col.colour}
						stroke-dasharray="4 3"
					/>
					<Label
						anchor="start"
						x={CX[ci] + 30}
						y={NOTE_Y + 22}
						text={col.note.title}
						size={12}
						weight={600}
						color={col.colour}
						halo={false}
					/>
					{#each col.note.lines as line, j (j)}
						<Label
							anchor="start"
							x={CX[ci] + 30}
							y={NOTE_Y + 42 + j * 17}
							text={line}
							size={11}
							halo={false}
						/>
					{/each}
				</g>
			</Readout>
		{/if}
		{#each col.cases as c, i (c.name)}
			<g opacity={show(ci, i + 1)}>
				{@render icon(c.icon, CX[ci] + 16, TOP + 60 + i * ROW, col.colour)}
				<Readout id="case-{col.id}-{i}">
					<Label
						anchor="start"
						x={CX[ci] + 92}
						y={TOP + 76 + i * ROW}
						text={c.name}
						size={13}
						weight={600}
						halo={false}
					/>
					{#each c.lines as line, j (j)}
						<Label
							anchor="start"
							x={CX[ci] + 92}
							y={TOP + 96 + i * ROW + j * 17}
							text={line}
							size={11}
							muted
							halo={false}
						/>
					{/each}
				</Readout>
			</g>
		{/each}
	{/each}
</g>
