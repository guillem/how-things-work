<script lang="ts">
	/**
	 * Step "history": the discoveries on a timeline from 1985 to 2021, one card
	 * at a time (every 1.2 s; reduced motion: all), alternating above and below
	 * the axis, each tied to its year. Below, the takeaway in one line.
	 */
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Tag from './Tag.svelte';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 99 : t);

	const EVENTS = [
		{ year: 1987, who: 'Ishino et al.', a: 'odd repeats beside', b: 'a gene of E. coli' },
		{ year: 2002, who: 'Jansen et al.', a: 'named CRISPR; cas', b: 'genes always beside it' },
		{ year: 2005, who: 'Mojica et al.', a: 'spacers match phages;', b: 'carriers resist them' },
		{ year: 2007, who: 'Barrangou et al.', a: 'yogurt bacteria gain', b: 'spacers and resist' },
		{ year: 2008, who: 'Brouns et al.', a: 'crRNAs guide', b: 'the defence' },
		{ year: 2008, who: 'Marraffini & Sontheimer', a: 'the target', b: 'is DNA' },
		{ year: 2010, who: 'Garneau et al.', a: 'the phage DNA is cut', b: 'inside the target' },
		{ year: 2011, who: 'Deltcheva et al.', a: 'tracrRNA and RNase III', b: 'make the crRNAs' },
		{
			year: 2020,
			who: 'Nobel Prize in Chemistry',
			a: 'Charpentier & Doudna,',
			b: 'for a gene-editing tool'
		}
	].map((e, i) => {
		const above = i % 2 === 0;
		const slot = Math.floor(i / 2);
		return { ...e, i, above, cx: above ? 122 + slot * 179 : 212 + slot * 179 };
	});
	const AX = { x0: 60, x1: 900, y: 300, y0: 1985, y1: 2021 };
	const yx = (y: number) => AX.x0 + ((y - AX.y0) / (AX.y1 - AX.y0)) * (AX.x1 - AX.x0);
	const shown = (i: number) => smoothstep(0.5 + i * 1.2, 1.1 + i * 1.2, time);
	const CW = 166;
	const CH = 92;
</script>

<g>
	<line x1={AX.x0} x2={AX.x1} y1={AX.y} y2={AX.y} stroke="var(--stage-line)" stroke-width="2" />
	{#each [1990, 2000, 2010, 2020] as y (y)}
		<line x1={yx(y)} x2={yx(y)} y1={AX.y - 5} y2={AX.y + 5} stroke="var(--stage-line)" />
		<Readout id="tick{y}">
			<Tag x={yx(y)} y={AX.y + 22} text={String(y)} size={11} muted />
		</Readout>
	{/each}

	{#each EVENTS as e (e.i)}
		{@const o = shown(e.i)}
		{@const top = e.above ? 102 : 396}
		{@const nobel = e.year === 2020}
		<g opacity={o}>
			<line
				x1={e.cx}
				y1={e.above ? top + CH : top}
				x2={yx(e.year)}
				y2={AX.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 3"
			/>
			<circle
				cx={yx(e.year)}
				cy={AX.y}
				r={5}
				fill={nobel ? 'var(--cr-pam)' : 'var(--cr-cell-edge)'}
			/>
			<rect
				x={e.cx - CW / 2}
				y={top}
				width={CW}
				height={CH}
				rx={10}
				fill="var(--surface)"
				stroke={nobel ? 'var(--cr-pam)' : 'var(--border)'}
				stroke-width={nobel ? 2 : 1}
			/>
		</g>
		<Readout id="ev{e.i}" order={e.i} label="{e.year} · {e.who}" value="{e.a} {e.b}" opacity={o}>
			<Tag x={e.cx} y={top + 20} text={String(e.year)} size={13} weight={700} opacity={o} />
			<Tag x={e.cx} y={top + 38} text={e.who} size={11} muted opacity={o} />
			<Tag x={e.cx} y={top + 58} text={e.a} size={12} opacity={o} />
			<Tag x={e.cx} y={top + 76} text={e.b} size={12} opacity={o} />
		</Readout>
	{/each}

	<Readout
		id="takeaway"
		order={20}
		label="In one line"
		value="a bacterium keeps a piece of each virus it survives in its DNA, and uses RNA copies of it to find and cut that virus next time"
		opacity={shown(EVENTS.length)}
	>
		<Tag
			x={480}
			y={538}
			text="A bacterium keeps a piece of each virus it survives in its own DNA,"
			size={14}
			weight={600}
			opacity={shown(EVENTS.length)}
		/>
		<Tag
			x={480}
			y={560}
			text="and uses RNA copies of it to find and cut that virus the next time."
			size={14}
			weight={600}
			opacity={shown(EVENTS.length)}
		/>
	</Readout>
</g>
