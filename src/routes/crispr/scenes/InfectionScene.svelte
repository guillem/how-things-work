<script lang="ts">
	/**
	 * Step "phage": the life of a virulent phage in four panels, left to right:
	 * it lands and injects its DNA; its genes take over and the cell copies the
	 * phage DNA; new phages are assembled; the cell bursts and releases them.
	 * A highlight walks along the panels (4 s each); under reduced motion all
	 * four are shown at full strength, each at a telling moment.
	 */
	import { cycle, hash, Label, smoothstep, TAU } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Phage from './Phage.svelte';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);

	const PANELS = [
		{ k: 0, x: 128, title: 'Lands, injects its DNA', sub: 'the empty coat stays outside' },
		{ k: 1, x: 364, title: 'Its genes take over', sub: 'the cell copies the phage DNA' },
		{ k: 2, x: 600, title: 'New phages are built', sub: 'heads filled with phage DNA' },
		{ k: 3, x: 836, title: 'The cell bursts', sub: 'dozens to hundreds of new phages' }
	];
	const CY = 310;
	const W = 100; // half width of a cell
	const H = 62; // half height

	/** Which panel is lit (0–3), and the phase within its 4 s. */
	const lit = $derived(Math.floor(cycle(time, 16) * 4));
	const local = $derived(reduced ? 0.8 : cycle(time, 4));
	const panelOpacity = (k: number) => (reduced ? 1 : k === lit ? 1 : 0.5);

	/** A closed wavy loop: the bacterial chromosome. */
	const chromosome = (cx: number) => {
		let d = '';
		for (let i = 0; i <= 60; i++) {
			const a = (i / 60) * TAU;
			const r = 1 + 0.12 * Math.sin(a * 7);
			const x = cx + Math.cos(a) * 60 * r;
			const y = CY + Math.sin(a) * 32 * r;
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d + 'Z';
	};

	/** The injected DNA: a wavy line from the tail tip down into the cell, `u` of its length. */
	const injected = (cx: number, u: number) => {
		let d = '';
		const n = Math.max(2, Math.round(40 * u));
		for (let i = 0; i <= n; i++) {
			const s = (i / 40) * 1;
			const x = cx + 10 + Math.sin(s * 18) * 9 + s * 30;
			const y = CY - H + 4 + s * 70;
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	};

	/** A short squiggle of phage DNA centred on (x, y). */
	const squiggle = (x: number, y: number, k: number, tt: number) => {
		let d = '';
		for (let i = 0; i <= 12; i++) {
			const u = i / 12 - 0.5;
			const yy = y + Math.sin(u * 12 + tt * 2 + k) * 4;
			d += `${i ? 'L' : 'M'}${(x + u * 30).toFixed(1)} ${yy.toFixed(1)}`;
		}
		return d;
	};
	const COPIES = Array.from({ length: 6 }, (_, i) => ({
		k: i,
		dx: -48 + (i % 3) * 48 + (hash(i, 1) - 0.5) * 8,
		dy: i < 3 ? -20 : 20
	}));
	const BUILT = Array.from({ length: 7 }, (_, i) => ({
		k: i,
		dx: -63 + i * 21,
		dy: (i % 2 ? 14 : -4) + 20
	}));
	const BURST = Array.from({ length: 9 }, (_, i) => ({
		k: i,
		a: (i / 9) * TAU + 0.3 * hash(i, 5)
	}));
	const burstU = $derived(reduced ? 0.45 : smoothstep(0, 0.9, local));
</script>

<g>
	<Readout
		id="title"
		order={0}
		label="A phage infects a bacterium"
		value="about an hour from landing to bursting, depending on the phage"
	>
		<Label x={480} y={66} text="A phage infects a bacterium" size={17} weight={600} />
		<Label
			x={480}
			y={88}
			text="(schematic: the yogurt bacterium’s phages are about 0.3 µm long, a third of the cell)"
			size={12}
			muted
		/>
	</Readout>

	{#each PANELS as p (p.k)}
		{@const o = panelOpacity(p.k)}
		{@const u = reduced ? 0.8 : p.k === lit ? local : 0.8}
		<g opacity={o}>
			<!-- the cell (broken up in the last panel) -->
			{#if p.k < 3}
				<rect
					x={p.x - W}
					y={CY - H}
					width={W * 2}
					height={H * 2}
					rx={H}
					fill="var(--cr-cell)"
					stroke="var(--cr-cell-edge)"
					stroke-width="1.5"
				/>
				<path
					d={chromosome(p.x)}
					fill="none"
					stroke="var(--cr-chromosome)"
					stroke-width="1.6"
					stroke-dasharray={p.k === 0 ? undefined : '5 6'}
					opacity={p.k === 0 ? 0.9 : 0.4}
				/>
			{:else}
				{#each [0, 1, 2, 3, 4, 5] as f (f)}
					{@const a0 = (f / 6) * TAU + 0.2}
					{@const push = 6 + burstU * 26}
					{@const cxF = p.x + Math.cos(a0 + 0.5) * push}
					{@const cyF = CY + Math.sin(a0 + 0.5) * push * 0.6}
					<path
						d="M{cxF + Math.cos(a0) * W * 0.9} {cyF + Math.sin(a0) * H * 0.9} A {W * 0.9} {H *
							0.9} 0 0 1 {cxF + Math.cos(a0 + 0.75) * W * 0.9} {cyF +
							Math.sin(a0 + 0.75) * H * 0.9}"
						fill="none"
						stroke="var(--cr-cell-edge)"
						stroke-width="1.5"
						stroke-linecap="round"
						opacity={1 - 0.6 * burstU}
					/>
				{/each}
			{/if}

			{#if p.k === 0}
				<path
					d={injected(p.x, smoothstep(0.1, 0.7, u))}
					fill="none"
					stroke="var(--cr-phage-dna)"
					stroke-width="2"
					stroke-linecap="round"
				/>
				<Phage x={p.x + 10} y={CY - H + 2} full={u < 0.15} />
			{:else if p.k === 1}
				{#each COPIES as c (c.k)}
					<path
						d={squiggle(p.x + c.dx, CY + c.dy, c.k, time)}
						fill="none"
						stroke="var(--cr-phage-dna)"
						stroke-width="2"
						stroke-linecap="round"
						opacity={reduced || p.k !== lit ? 1 : smoothstep(c.k * 0.1, c.k * 0.1 + 0.15, u)}
					/>
				{/each}
			{:else if p.k === 2}
				{#each BUILT as b (b.k)}
					<Phage
						x={p.x + b.dx}
						y={CY + b.dy + Math.sin(time * 1.5 + b.k) * 1.5}
						scale={0.48}
						angle={b.k % 2 ? 12 : -10}
					/>
				{/each}
			{:else}
				{#each BURST as b (b.k)}
					{@const r = 24 + burstU * 70}
					<Phage
						x={p.x + Math.cos(b.a) * r}
						y={CY + Math.sin(b.a) * r * 0.75}
						scale={0.42}
						angle={(b.a * 180) / Math.PI - 90}
						opacity={reduced ? 1 : 1 - smoothstep(0.85, 1, local)}
					/>
				{/each}
			{/if}
		</g>

		<Readout
			id="panel{p.k}"
			order={p.k + 1}
			label={p.title}
			value={p.sub}
			marker={p.k + 1}
			at={[p.x, 190]}
		>
			<Label x={p.x} y={184} text="{p.k + 1}  {p.title}" size={13} weight={600} opacity={o} />
			<Label x={p.x} y={418} text={p.sub} size={12} muted opacity={o} />
		</Readout>
		{#if p.k < 3}
			<path
				d="M{p.x + W + 5} {CY} L{p.x + 236 - W - 5} {CY}"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
				opacity="0.7"
			/>
		{/if}
	{/each}

	<Readout
		id="this-page"
		order={9}
		label="This page"
		value="CRISPR, the defence many bacteria and archaea use to remember a phage and destroy it the next time"
	>
		<Label
			x={480}
			y={500}
			text="This page: CRISPR, the defence many bacteria use"
			size={14}
			weight={600}
		/>
		<Label
			x={480}
			y={522}
			text="to remember a phage and destroy it the next time it gets in"
			size={14}
			weight={600}
		/>
	</Readout>
</g>
