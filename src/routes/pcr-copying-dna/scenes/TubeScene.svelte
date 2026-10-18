<script lang="ts">
	/**
	 * The tube and what goes in it: a few template double strands (the chosen stretch marked),
	 * many primers, loose building blocks and polymerase molecules, drifting in the liquid; a key
	 * on the right. Everything drifts as a pure function of t.
	 */
	import { Label, hash } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { tubePath } from './shared';

	let { t }: StageProps = $props();

	const TX = 90;
	const TY = 70;
	const TW = 240;
	const TH = 450;
	const LIQUID = 250;
	const outline = tubePath(TX, TY, TW, TH);

	/** Spots in the liquid, avoiding the narrow tip. */
	function spot(i: number, salt: number) {
		const y = LIQUID + 22 + hash(i, salt) * 190;
		const narrow = Math.max(0, (y - 376) / 144);
		const half = (TW / 2 - 22) * (1 - 0.75 * narrow);
		return { x: TX + TW / 2 + (hash(i, salt + 1) * 2 - 1) * half, y };
	}
	const templates = [
		{ i: 0, x: 168, y: 290, angle: -14 },
		{ i: 1, x: 252, y: 345, angle: 10 },
		{ i: 2, x: 196, y: 405, angle: -4 }
	];
	const primers = Array.from({ length: 26 }, (_, i) => ({
		i,
		...spot(i, 21),
		angle: 180 * hash(i, 22)
	}));
	const BASES = ['var(--dp-a)', 'var(--dp-c)', 'var(--dp-g)', 'var(--dp-t)'];
	const blocks = Array.from({ length: 64 }, (_, i) => ({ i, ...spot(i, 31), c: BASES[i % 4] }));
	const enzymes = [0, 1, 2, 3].map((i) => ({ i, ...spot(i, 41) }));

	const drift = (i: number, k = 1) => ({
		dx: k * 5 * Math.sin(t * 0.7 + i * 1.7),
		dy: k * 4 * Math.cos(t * 0.55 + i * 2.3)
	});

	const KX = 400;
	const rows = [
		{
			id: 'template',
			y: 128,
			title: 'Template: the sample’s DNA',
			note: 'the chosen stretch (violet) is a tiny part of it'
		},
		{
			id: 'primers',
			y: 222,
			title: 'Two primers, about 20 letters each',
			note: 'one matches each end of the chosen stretch'
		},
		{
			id: 'blocks',
			y: 316,
			title: 'Building blocks: A, C, G and T',
			note: 'loose nucleotides, joined into new strands'
		},
		{
			id: 'enzyme',
			y: 410,
			title: 'DNA polymerase',
			note: 'copies a strand, starting at a primer; survives 95 °C'
		}
	];
</script>

<g>
	<defs>
		<clipPath id="pcr-tube-clip"><path d="{outline} Z" /></clipPath>
	</defs>

	<!-- heating block, behind the tube's cone -->
	<rect
		x={TX - 34}
		y={TY + TH * 0.6}
		width={TW + 68}
		height={TH * 0.4 + 40}
		rx="10"
		fill="var(--stage-grid)"
		stroke="var(--stage-line)"
	/>
	<Readout id="block">
		<Label
			x={TX + TW / 2}
			y={TY + TH + 30}
			text="heating block: 95 → 55 → 72 °C, about 40 times"
			size={12}
			muted
		/>
	</Readout>

	<!-- the tube and its liquid -->
	<path d="{outline} Z" fill="var(--stage-bg)" />
	<rect
		x={TX}
		y={LIQUID}
		width={TW}
		height={TY + TH - LIQUID}
		fill="var(--pcr-liquid)"
		clip-path="url(#pcr-tube-clip)"
	/>
	<g clip-path="url(#pcr-tube-clip)">
		{#each blocks as b (b.i)}
			{@const d = drift(b.i, 1.4)}
			<circle cx={b.x + d.dx} cy={b.y + d.dy} r="2.6" fill={b.c} />
		{/each}
		{#each primers as p (p.i)}
			{@const d = drift(p.i + 40)}
			<g transform="translate({p.x + d.dx} {p.y + d.dy}) rotate({p.angle})">
				<line x1="-7" x2="7" y1="0" y2="0" stroke="var(--pcr-primer)" stroke-width="3" />
			</g>
		{/each}
		{#each enzymes as e (e.i)}
			{@const d = drift(e.i + 80, 0.8)}
			<ellipse
				cx={e.x + d.dx}
				cy={e.y + d.dy}
				rx="11"
				ry="8"
				fill="var(--protein)"
				stroke="var(--protein-edge)"
			/>
		{/each}
		{#each templates as s (s.i)}
			{@const d = drift(s.i + 120, 0.5)}
			<g transform="translate({s.x + d.dx} {s.y + d.dy}) rotate({s.angle})">
				<line x1="-48" x2="48" y1="-3" y2="-3" stroke="var(--pcr-template)" stroke-width="2.5" />
				<line x1="-48" x2="48" y1="3" y2="3" stroke="var(--pcr-template)" stroke-width="2.5" />
				<line x1="-10" x2="10" y1="-3" y2="-3" stroke="var(--pcr-target)" stroke-width="3" />
				<line x1="-10" x2="10" y1="3" y2="3" stroke="var(--pcr-target)" stroke-width="3" />
			</g>
		{/each}
	</g>
	<path d={outline} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" />
	<rect
		x={TX - 10}
		y={TY - 16}
		width={TW + 20}
		height="16"
		rx="5"
		fill="var(--surface)"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<Readout id="tube">
		<Label x={TX + TW / 2} y={TY + 40} text="one tube, 20 µL" size={14} weight={600} />
	</Readout>

	<!-- the key -->
	<rect
		x={KX}
		y={70}
		width={520}
		height={400}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#each rows as r, i (r.id)}
		<g>
			{#if r.id === 'template'}
				<line
					x1={KX + 22}
					x2={KX + 82}
					y1={r.y - 13}
					y2={r.y - 13}
					stroke="var(--pcr-template)"
					stroke-width="2.5"
				/>
				<line
					x1={KX + 22}
					x2={KX + 82}
					y1={r.y - 5}
					y2={r.y - 5}
					stroke="var(--pcr-template)"
					stroke-width="2.5"
				/>
				<line
					x1={KX + 44}
					x2={KX + 60}
					y1={r.y - 13}
					y2={r.y - 13}
					stroke="var(--pcr-target)"
					stroke-width="3"
				/>
				<line
					x1={KX + 44}
					x2={KX + 60}
					y1={r.y - 5}
					y2={r.y - 5}
					stroke="var(--pcr-target)"
					stroke-width="3"
				/>
			{:else if r.id === 'primers'}
				<line
					x1={KX + 26}
					x2={KX + 46}
					y1={r.y - 9}
					y2={r.y - 9}
					stroke="var(--pcr-primer)"
					stroke-width="3"
				/>
				<line
					x1={KX + 58}
					x2={KX + 78}
					y1={r.y - 9}
					y2={r.y - 9}
					stroke="var(--pcr-primer)"
					stroke-width="3"
				/>
			{:else if r.id === 'blocks'}
				{#each BASES as c, j (j)}
					<circle cx={KX + 30 + j * 14} cy={r.y - 9} r="4" fill={c} />
				{/each}
			{:else}
				<ellipse
					cx={KX + 52}
					cy={r.y - 9}
					rx="16"
					ry="11"
					fill="var(--protein)"
					stroke="var(--protein-edge)"
				/>
			{/if}
			<Readout id={r.id} order={2 + i} label={r.title} marker={i + 1} at={[KX + 52, r.y - 9]}>
				<Label
					anchor="start"
					x={KX + 104}
					y={r.y - 10}
					text={r.title}
					size={14}
					weight={600}
					halo={false}
				/>
				<Label
					anchor="start"
					x={KX + 104}
					y={r.y + 10}
					text={r.note}
					size={12}
					muted
					halo={false}
				/>
			</Readout>
		</g>
	{/each}
	<Readout id="few" label="Too few copies of the stretch to see">
		<Label
			x={KX + 260}
			y={520}
			text="a few hundred copies of the chosen stretch: far too few to see"
			size={13}
			weight={600}
			pill
		/>
	</Readout>
</g>
