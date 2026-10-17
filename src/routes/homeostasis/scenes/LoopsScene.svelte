<script lang="ts">
	/**
	 * Four other feedback loops of the body, each as a card: a sensor, a
	 * messenger and an effector in a row, with the effect returning to the
	 * sensor underneath. A pulse runs around each loop. In three cards one link
	 * is marked broken (red ✕): the pulse fades out there, and the disease
	 * below says what fails. In the temperature card nothing is broken: a
	 * fever moves the loop's target instead.
	 *
	 * Reduced motion freezes the pulses at t = 2.5 s, partway round each loop.
	 */
	import { Label, along, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t }: StageProps = $props();

	interface Card {
		id: string;
		title: string;
		sub: string;
		nodes: [string, string][];
		/** Index of the broken link (0: sensor → messenger, 1: messenger → effector, 2: effect → sensor), or -1. */
		broken: number;
		note?: string;
		lines: { head: string; text: string }[];
		/** The card's point in one line, for the phone panel. */
		phone: string;
	}
	const cards: Card[] = [
		{
			id: 'temp',
			title: 'Body temperature',
			sub: 'held near 37 °C',
			nodes: [
				['sensor', 'hypothalamus'],
				['messenger', 'nerves'],
				['effector', 'sweat, shivering']
			],
			broken: -1,
			note: 'set point raised',
			phone: 'fever: the brain raises the set point on purpose',
			lines: [
				{ head: 'Fever:', text: 'the brain raises the set point on purpose.' },
				{ head: '', text: 'The loop works; its target has moved.' },
				{ head: 'Heatstroke:', text: 'more heat than the loop can shed.' }
			]
		},
		{
			id: 'water',
			title: 'Water in the blood',
			sub: 'how concentrated the blood is',
			nodes: [
				['sensor', 'hypothalamus'],
				['messenger', 'ADH'],
				['effector', 'kidneys keep water']
			],
			broken: 0,
			phone: 'diabetes insipidus: too little ADH',
			lines: [
				{ head: 'Diabetes insipidus:', text: 'too little ADH is' },
				{ head: '', text: 'released (or the kidneys ignore it). Litres' },
				{ head: '', text: 'of dilute urine and constant thirst.' }
			]
		},
		{
			id: 'thyroid',
			title: 'Thyroid hormone',
			sub: 'sets the pace of metabolism',
			nodes: [
				['sensor', 'pituitary'],
				['messenger', 'TSH'],
				['effector', 'thyroid gland']
			],
			broken: 1,
			phone: 'hypothyroidism: the gland fails, TSH rises',
			lines: [
				{ head: 'Hypothyroidism:', text: 'the gland fails, often' },
				{ head: '', text: 'attacked by the immune system. TSH rises,' },
				{ head: '', text: 'but nothing answers.' }
			]
		},
		{
			id: 'calcium',
			title: 'Calcium in the blood',
			sub: 'for nerves, muscles and bones',
			nodes: [
				['sensor', 'parathyroid glands'],
				['messenger', 'PTH'],
				['effector', 'bones, kidneys, gut']
			],
			broken: 2,
			phone: 'hyperparathyroidism: PTH whatever the calcium',
			lines: [
				{ head: 'Primary hyperparathyroidism:', text: 'a gland,' },
				{ head: '', text: 'usually a benign growth, keeps releasing' },
				{ head: '', text: 'PTH whatever the calcium. Calcium runs high.' }
			]
		}
	];

	const CW = 448;
	const CH = 262;
	const origin = (k: number) => ({
		x: 24 + (k % 2) * (CW + 16),
		y: 58 + Math.floor(k / 2) * (CH + 14)
	});
	const BW = 128;
	const BH = 46;
	const GAP = 16;
	const BY = 66; // box top, relative to the card
	const boxX = (k: number) => 16 + k * (BW + GAP);

	/** The loop path of a card, in card coordinates, and where each link ends (as a fraction). */
	const loopPts: Point[] = [
		{ x: boxX(0) + BW, y: BY + BH / 2 },
		{ x: boxX(1), y: BY + BH / 2 },
		{ x: boxX(1) + BW, y: BY + BH / 2 },
		{ x: boxX(2), y: BY + BH / 2 },
		{ x: boxX(2) + BW / 2, y: BY + BH },
		{ x: boxX(2) + BW / 2, y: BY + BH + 30 },
		{ x: boxX(0) + BW / 2, y: BY + BH + 30 },
		{ x: boxX(0) + BW / 2, y: BY + BH }
	];
	const segLen = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
	// Lengths: link 0 = segment 0; inside messenger box (skip) = 1; link 1 = 2;
	// effector to the return line = 3 (inside the box); return = 4, 5, 6.
	const lens = loopPts.slice(1).map((p, k) => segLen(loopPts[k], p));
	const total = lens.reduce((a, b) => a + b, 0);
	const cum = lens.reduce<number[]>((acc, l) => [...acc, acc[acc.length - 1] + l], [0]);
	/** [start, end] of each link as a fraction of the loop. */
	const links = [
		[cum[0] / total, cum[1] / total],
		[cum[2] / total, cum[3] / total],
		[cum[4] / total, cum[7] / total]
	];
	const loopD = loopPts.map((p, k) => `${k ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
	const linkMid = (k: number): Point =>
		k === 0
			? { x: (loopPts[0].x + loopPts[1].x) / 2, y: loopPts[0].y }
			: k === 1
				? { x: (loopPts[2].x + loopPts[3].x) / 2, y: loopPts[2].y }
				: { x: (loopPts[5].x + loopPts[6].x) / 2, y: loopPts[5].y };

	const r = linkMid(2);
	/** Where a broken link is marked: the middle of the link, or near the sensor on the way back. */
	const markX = boxX(0) + BW / 2 + 44;
	const markOf = (k: number): Point => (k === 2 ? { x: markX, y: loopPts[5].y } : linkMid(k));
	/** The mark's position along the loop, as a fraction. */
	const markU = (k: number) =>
		k === 2 ? (cum[5] + (loopPts[5].x - markX)) / total : (links[k][0] + links[k][1]) / 2;

	const pulses = $derived(
		cards.map((c, k) => {
			const u = cycle(t, 4.5, k * 0.27);
			const p = along(loopPts, u);
			let o = 1;
			if (c.broken >= 0) {
				const mid = markU(c.broken);
				o = 1 - smoothstep(mid - 0.04, mid + 0.01, u);
			}
			return { k, x: p.x, y: p.y, o };
		})
	);
</script>

<g>
	<Readout
		id="every"
		order={10}
		label="Every loop: a sensor measures, a messenger carries the order, an effector pushes back"
	>
		<Label
			x={480}
			y={34}
			text="Every loop: a sensor measures, a messenger carries the order, an effector pushes back"
			size={14}
			weight={600}
		/>
	</Readout>

	{#each cards as c, k (c.id)}
		{@const o = origin(k)}
		<g transform="translate({o.x} {o.y})">
			<rect width={CW} height={CH} rx="14" fill="var(--surface)" stroke="var(--border)" />
			<Readout
				id="card-{c.id}"
				order={k + 1}
				label={c.title}
				value={c.phone}
				note={c.nodes.map((n) => n[1]).join(' → ')}
				color={c.broken >= 0 ? 'var(--hm-hypo)' : 'var(--hm-glucose)'}
			>
				{#snippet narrow()}
					<!-- on phones the title stays, large; the rest is in the panel -->
					<text x={16} y={40} font-size="30" font-weight="600">{c.title}</text>
				{/snippet}
				<text x={16} y={30} font-size="15" font-weight="600"
					>{c.title}<tspan class="muted" font-size="12" font-weight="400" dx="8">{c.sub}</tspan
					></text
				>
			</Readout>

			<!-- the loop -->
			<path d={loopD} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
			{#each [0, 1] as l (l)}
				{@const m = linkMid(l)}
				<path
					d="M{m.x - 3} {m.y - 5} L{m.x + 4} {m.y} L{m.x - 3} {m.y + 5}"
					fill="none"
					stroke="var(--stage-line)"
					stroke-width="1.5"
				/>
			{/each}
			<path
				d="M{r.x + 3} {r.y - 5} L{r.x - 4} {r.y} L{r.x + 3} {r.y + 5}"
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			<Readout id="again-{c.id}">
				<text x={r.x} y={r.y + 16} font-size="11" class="muted" text-anchor="middle"
					>the effect is measured again</text
				>
			</Readout>

			{#each c.nodes as [role, name], j (role)}
				<rect
					x={boxX(j)}
					y={BY}
					width={BW}
					height={BH}
					rx="8"
					fill="var(--stage-bg)"
					stroke="var(--border)"
				/>
				<!-- named in the panel row on phones -->
				<Readout id="node-{c.id}-{role}">
					<text x={boxX(j) + BW / 2} y={BY + 18} font-size="11" class="muted" text-anchor="middle"
						>{role}</text
					>
					<text
						x={boxX(j) + BW / 2}
						y={BY + 35}
						font-size="12.5"
						font-weight="600"
						text-anchor="middle">{name}</text
					>
				</Readout>
			{/each}

			{#if c.broken >= 0}
				{@const m = markOf(c.broken)}
				<circle
					cx={m.x}
					cy={m.y}
					r="9"
					fill="var(--surface)"
					stroke="var(--hm-hypo)"
					stroke-width="1.5"
				/>
				<path
					d="M{m.x - 4} {m.y - 4} L{m.x + 4} {m.y + 4} M{m.x + 4} {m.y - 4} L{m.x - 4} {m.y + 4}"
					stroke="var(--hm-hypo)"
					stroke-width="2"
				/>
			{:else if c.note}
				<Readout id="note-{c.id}">
					<text
						x={boxX(0) + BW / 2}
						y={BY - 8}
						font-size="11"
						font-weight="600"
						text-anchor="middle"
						style:fill="var(--hm-glucose)">{c.note} ↑</text
					>
				</Readout>
			{/if}

			<circle
				cx={pulses[k].x}
				cy={pulses[k].y}
				r="5"
				fill="var(--hm-insulin)"
				opacity={pulses[k].o}
			/>

			<!-- what goes wrong -->
			<Readout id="lines-{c.id}">
				{#each c.lines as line, j (j)}
					<text x={16} y={186 + j * 20} font-size="12.5"
						>{#if line.head}<tspan
								font-weight="600"
								style:fill={c.broken >= 0 ? 'var(--hm-hypo)' : 'var(--hm-glucose)'}
								>{line.head}</tspan
							>{/if}<tspan dx={line.head ? 5 : 0}>{line.text}</tspan></text
					>
				{/each}
			</Readout>
		</g>
	{/each}
</g>
