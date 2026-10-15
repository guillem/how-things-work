<script lang="ts">
	/**
	 * Steps "record" and "adapt": the CRISPR array in a bacterium.
	 *
	 * record: three phages outside the cell, each with the stretch of its
	 * (made-up) genome that one spacer matches; dashed lines link each stretch
	 * to its spacer. Newest (C) next to the leader, oldest (A) at the far end.
	 *
	 * adapt: one more phage's DNA inside the cell. Cas1–Cas2 slides to the
	 * first PAM with room before it (`acquire` in the model), cuts out the 20
	 * letters before it and carries them to the front of the array, which opens
	 * up; the first repeat is copied. "Another infection" repeats this with the
	 * next phage.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { lerp, norm, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PHAGES, SPACER_LENGTH, acquire, hasPam, madeUpGenome } from '../model';
	import ArrayStrip from './ArrayStrip.svelte';
	import { spacerX, stripWidth, STRIP, type StripSpacer } from './strip';
	import Phage from './Phage.svelte';
	import Tag from './Tag.svelte';

	let { step, t, params, reduced }: StageProps = $props();
	const time = $derived(reduced ? 2.5 : t);
	const view = $derived(step.hints?.view === 'adapt' ? 'adapt' : 'record');

	const NAMES = 'ABCDEFGHIJKLMNOP'.split('');
	const colorOf = (i: number) => `var(--cr-s${(i % 6) + 1})`;
	const genomeOf = (i: number) =>
		i === 0 ? PHAGES.A : i === 1 ? PHAGES.B : i === 2 ? PHAGES.C : madeUpGenome(101 + i * 7, 240);

	/** Where in each phage's genome its spacer came from (model: first PAM with room). */
	const protoAt = (i: number) => acquire({ spacers: [] }, genomeOf(i), NAMES[i])?.protospacer ?? 0;

	// ---- the switch between views
	const viewT = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = view === 'adapt' ? 1 : 0;
		untrack(() => viewT.set(v, { duration: reduced ? 0 : 800 }));
	});
	const a = $derived(viewT.current); // 0 record, 1 adapt

	// ---- adaptation progress
	const presses = $derived(Number(params.infect ?? 0));
	const pressT = new Tween(1, { duration: 6500 });
	$effect(() => {
		const n = presses;
		untrack(() => {
			if (n === 0) return;
			pressT.set(0, { duration: 0 });
			pressT.set(1, { duration: reduced ? 0 : 6500 });
		});
	});
	const prog = $derived(
		view !== 'adapt' || reduced ? 1 : presses === 0 ? norm(time, 0.8, 7.3) : pressT.current
	);

	// ---- which spacers are drawn
	const MAX = 7;
	/** Phages met before this infection (adapt) or the three of the record view. */
	const before = $derived(view === 'adapt' ? 2 + presses : 3);
	const newIdx = $derived(view === 'adapt' ? before : -1);
	const spacers: StripSpacer[] = $derived.by(() => {
		const list: StripSpacer[] = [];
		const top = view === 'adapt' ? before : before - 1;
		for (let i = top; i >= 0 && list.length < MAX; i--)
			list.push({
				key: NAMES[i % NAMES.length] + i,
				label: NAMES[i % NAMES.length],
				color: colorOf(i)
			});
		return list;
	});
	const more = $derived((view === 'adapt' ? before + 1 : before) > MAX);

	const grow = $derived(view === 'adapt' ? smoothstep(0.7, 0.9, prog) : 1);
	const SCALE = 1.25;
	const stripW = $derived(stripWidth(spacers.length, SCALE, true, grow));
	const stripX = $derived(480 - stripWidth(spacers.length, SCALE) / 2);
	const stripY = $derived(lerp(400, 440, a));

	// ---- record view: three phages and their genomes
	const REC = [0, 1, 2].map((i) => {
		const cx = 190 + (2 - i) * 290; // newest (C) on the left, above its spacer
		const g = genomeOf(i);
		const x0 = cx - 70;
		const x1 = cx + 110;
		const at = protoAt(i);
		return {
			i,
			cx,
			x0,
			x1,
			s0: lerp(x0, x1, at / g.length),
			s1: lerp(x0, x1, (at + SPACER_LENGTH) / g.length)
		};
	});

	// ---- adapt view: the infecting phage's DNA, 240 letters over 720 px
	const DNA_X = 120;
	const PX = 3;
	const DNA_Y = 150;
	const genome = $derived(genomeOf(Math.max(0, newIdx)));
	const pams = $derived.by(() => {
		const out: number[] = [];
		for (let p = 0; p < genome.length - 3; p++) if (hasPam(genome, p)) out.push(p);
		return out;
	});
	const proto = $derived(protoAt(Math.max(0, newIdx)));
	const segX = $derived(DNA_X + proto * PX);
	const segW = SPACER_LENGTH * PX;
	// Cas1–Cas2 position and the cut piece
	const casPath = $derived.by(() => {
		const p = prog;
		const start = { x: DNA_X - 20, y: DNA_Y };
		const atPam = { x: segX + segW / 2, y: DNA_Y };
		const target = { x: spacerX(stripX, 0, SCALE, true, 1), y: stripY - 52 };
		if (p < 0.25) {
			const u = smoothstep(0, 0.25, p);
			return { x: lerp(start.x, atPam.x, u), y: DNA_Y, carry: 0 };
		}
		if (p < 0.4) return { x: atPam.x, y: DNA_Y + smoothstep(0.25, 0.4, p) * 26, carry: 1 };
		const u = smoothstep(0.4, 0.7, p);
		return {
			x: lerp(atPam.x, target.x, u),
			y: lerp(DNA_Y + 26, target.y, u),
			carry: p < 0.8 ? 1 : 1 - smoothstep(0.8, 0.9, p)
		};
	});
	const cutOpen = $derived(view === 'adapt' ? smoothstep(0.28, 0.38, prog) : 0);
	const cellTop = $derived(lerp(270, 50, a));
</script>

<g>
	<!-- the bacterium -->
	<rect
		x={36}
		y={cellTop}
		width={888}
		height={560 - cellTop}
		rx={Math.min(110, (560 - cellTop) / 2)}
		fill="var(--cr-cell)"
		stroke="var(--cr-cell-edge)"
		stroke-width="1.5"
	/>
	<Readout id="cell" opacity={1 - a}>
		<Tag
			x={72}
			y={cellTop + 40}
			text="a bacterium"
			size={13}
			anchor="start"
			muted
			opacity={1 - a}
		/>
	</Readout>

	<!-- record view: phages outside, with the stretch each spacer matches -->
	{#if a < 0.99}
		<g opacity={1 - a}>
			{#each REC as r (r.i)}
				<Phage x={r.x0 - 34} y={170} scale={0.95} />
				<line x1={r.x0} x2={r.x1} y1={150} y2={150} stroke="var(--cr-phage-dna)" stroke-width="3" />
				<rect x={r.s0} y={142} width={r.s1 - r.s0} height={16} rx={3} fill={colorOf(r.i)} />
				<rect x={r.s1 + 1} y={144} width={8} height={12} rx={2} fill="var(--cr-pam)" />
				<Tag x={r.cx + 20} y={118} text="phage {NAMES[r.i]}: its DNA" size={13} weight={600} />
				<path
					d="M{(r.s0 + r.s1) / 2} 162 C {(r.s0 + r.s1) / 2} 260, {spacerX(
						stripX,
						2 - r.i,
						SCALE
					)} 300, {spacerX(stripX, 2 - r.i, SCALE)} {stripY - 22}"
					fill="none"
					stroke={colorOf(r.i)}
					stroke-width="1.8"
					stroke-dasharray="5 4"
					marker-end="url(#arrowhead)"
				/>
			{/each}
			<Readout
				id="rec-key"
				order={1}
				label="Spacers match phages"
				value="each spacer is a copy of a stretch of one phage’s DNA (the coloured box); the yellow tag after it is its PAM"
			>
				<Tag
					x={480}
					y={210}
					text="each spacer is a copy of a stretch of one phage’s DNA"
					size={12}
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- adapt view: the new phage's DNA inside the cell -->
	{#if a > 0.01}
		<g opacity={a}>
			<Readout
				id="dna-title"
				order={1}
				label="Inside the cell"
				value="DNA of phage {NAMES[newIdx]}, injected; yellow ticks: PAMs (NGG)"
				opacity={a}
			>
				<Tag
					x={DNA_X}
					y={DNA_Y - 70}
					text="DNA of phage {NAMES[newIdx]}, just injected (made-up, 240 letters)"
					size={13}
					weight={600}
					anchor="start"
				/>
				<Tag
					x={DNA_X + 720}
					y={DNA_Y - 70}
					text="yellow: PAMs (any letter, then GG)"
					size={12}
					anchor="end"
					muted
				/>
			</Readout>
			<line
				x1={DNA_X}
				x2={segX}
				y1={DNA_Y}
				y2={DNA_Y}
				stroke="var(--cr-phage-dna)"
				stroke-width="4"
			/>
			<line
				x1={segX + segW}
				x2={DNA_X + 240 * PX}
				y1={DNA_Y}
				y2={DNA_Y}
				stroke="var(--cr-phage-dna)"
				stroke-width="4"
			/>
			<line
				x1={segX}
				x2={segX + segW}
				y1={DNA_Y}
				y2={DNA_Y}
				stroke="var(--cr-phage-dna)"
				stroke-width="4"
				stroke-dasharray="3 3"
				opacity={cutOpen}
			/>
			{#each pams as p (p)}
				<rect
					x={DNA_X + p * PX}
					y={DNA_Y - 7}
					width={PX * 3}
					height={14}
					rx={1.5}
					fill="var(--cr-pam)"
				/>
			{/each}
			<!-- the piece being cut and carried -->
			{#if casPath.carry > 0.01}
				<rect
					x={casPath.x - segW / 2}
					y={casPath.y - 7 + (prog < 0.25 ? 0 : 0)}
					width={segW}
					height={14}
					rx={3}
					fill={colorOf(newIdx)}
					opacity={prog < 0.25 ? smoothstep(0.15, 0.25, prog) : casPath.carry}
				/>
			{/if}
			{#if prog < 0.95}
				<g
					opacity={1 - smoothstep(0.88, 0.95, prog)}
					transform="translate({casPath.x} {casPath.y - 22})"
				>
					<ellipse cx={-14} cy={0} rx={16} ry={12} fill="var(--cr-cas12)" />
					<ellipse cx={14} cy={0} rx={16} ry={12} fill="var(--cr-cas12)" />
					<ellipse
						cx={0}
						cy={-6}
						rx={9}
						ry={7}
						fill="var(--cr-cas12)"
						stroke="var(--cr-cell)"
						stroke-width="1.5"
					/>
				</g>
				<Readout
					id="cas12"
					order={2}
					label="Cas1–Cas2"
					value="cut out the 20 letters before a PAM and carry them to the array"
					opacity={a * (1 - smoothstep(0.88, 0.95, prog))}
				>
					<Tag
						x={casPath.x}
						y={casPath.y - 44}
						text="Cas1–Cas2"
						size={13}
						weight={600}
						opacity={1 - smoothstep(0.88, 0.95, prog)}
					/>
				</Readout>
			{/if}
			<Readout
				id="step-note"
				order={3}
				label="Adaptation"
				value={prog < 0.4
					? 'Cas1–Cas2 find a PAM and cut out the letters before it'
					: prog < 0.9
						? 'the piece goes to the front of the array, next to the leader'
						: 'a new spacer, with a new copy of the repeat: newest at the front'}
			>
				<Tag
					x={660}
					y={262}
					text={prog < 0.4
						? 'Cas1–Cas2 find a PAM and cut out the 20 letters before it'
						: prog < 0.9
							? 'the piece goes in at the front, next to the leader'
							: 'a new spacer, with a new copy of the repeat'}
					size={14}
					weight={600}
				/>
			</Readout>
		</g>
	{/if}

	<!-- the array -->
	<ArrayStrip x={stripX} y={stripY} {spacers} scale={SCALE} {grow} {more} text={14} />
	<Readout
		id="labels"
		order={5}
		label="The array"
		value="leader, then repeat (grey diamond), spacer, repeat, …; newest spacer next to the leader"
	>
		<Tag
			x={stripX + (STRIP.leader + STRIP.repeat / 2) * SCALE}
			y={stripY - 30}
			text="repeat"
			size={12}
			muted
		/>
		<Tag
			x={spacerX(stripX, 0, SCALE, true, grow)}
			y={stripY + 40}
			text="spacer"
			size={12}
			muted
			opacity={grow}
		/>
		<path
			d="M{stripX + 20} {stripY + 70} L{stripX + stripW - 10} {stripY + 70}"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			marker-end="url(#arrowhead)"
		/>
		<Tag x={stripX + 20} y={stripY + 90} text="newest" size={12} anchor="start" muted />
		<Tag x={stripX + stripW - 10} y={stripY + 90} text="oldest" size={12} anchor="end" muted />
	</Readout>
	<Readout
		id="array-title"
		order={4}
		label="CRISPR array"
		value="{spacers.length + (more ? '+' : '')} spacers{view === 'adapt'
			? `, ${presses + 1} new since this step began`
			: ''}"
	>
		<Tag
			x={480}
			y={stripY - 58 + (view === 'adapt' ? 0 : 0)}
			text="CRISPR array, in the bacterium’s chromosome"
			size={14}
			weight={600}
			opacity={1 - a * smoothstep(0.3, 0.7, prog) * (1 - smoothstep(0.88, 0.95, prog))}
		/>
	</Readout>
</g>
