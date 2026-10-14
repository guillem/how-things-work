<script lang="ts">
	/**
	 * The periodic table shaded by where each element's atoms in the Solar System were made
	 * (Johnson 2017, `origins.ts`): each square is split into vertical strips, one per source,
	 * as wide as that source's share.
	 *
	 * Phases (`step.hints.phase`):
	 *   origins — the whole table, filled in order of atomic number over the first seconds; the
	 *             `source` control picks out one source (the others turn grey) and counts the
	 *             elements it made most of
	 *   heavy   — elements up to iron dimmed; the s-process elements (Sr, Ba, Pb) and the
	 *             r-process ones (Eu, Pt, Au, U) ringed
	 *   you     — the six elements making up 99% of the human body ringed with their shares of
	 *             its mass, and a bar of the body's mass by source, growing in
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';
	import { cell } from '../../atoms-periodic-table/atom';
	import {
		BODY,
		SOURCES,
		SOURCE_NAMES,
		bodyBySource,
		mainSource,
		origins,
		type Source
	} from '../star';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'origins'));
	const pick = $derived(phase === 'you' ? 'all' : String(params.source ?? 'all'));

	const COLOUR: Record<Source, string> = {
		bigBang: 'var(--st-bigbang)',
		cosmicRays: 'var(--st-cosmic)',
		lowMass: 'var(--st-lowmass)',
		massive: 'var(--st-massive)',
		whiteDwarfs: 'var(--st-wd)',
		mergers: 'var(--st-mergers)'
	};

	const CW = 50;
	const CH = 44;
	const X0 = 30;
	const Y0 = 22;
	const pos = (z: number) => {
		const { row, col } = cell(z);
		return { x: X0 + (col - 1) * CW, y: Y0 + (row - 1) * CH + (row >= 9 ? 12 - CH : 0) };
	};
	const CELLS = origins.map((o) => ({ o, ...pos(o.z), main: mainSource(o.z) }));

	const HEAVY_S = new Set([38, 56, 82]);
	const HEAVY_R = new Set([63, 78, 79, 92]);
	const BODY_Z = new Map(BODY.map((b) => [b.z, b.share]));

	/** Cells appear in order of atomic number over the first 2.5 s of the first step. */
	const fill = (z: number) =>
		reduced || phase !== 'origins' ? 1 : smoothstep(z / 45, z / 45 + 0.4, t);
	const dimOf = (z: number) => {
		if (phase === 'heavy') return z <= 26 ? 0.3 : 1;
		if (phase === 'you') return BODY_Z.has(z) ? 1 : 0.3;
		return 1;
	};
	const fade = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		void phase;
		untrack(() => {
			if (reduced) return;
			fade.set(0, { duration: 0 });
			fade.set(1);
		});
	});

	const counts = $derived(
		Object.fromEntries(SOURCES.map((s) => [s, CELLS.filter((c) => c.main === s).length])) as Record<
			Source,
			number
		>
	);
	const ring = $derived(reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 3));

	// The body bar.
	const body = bodyBySource();
	const BAR = { x: 300, y: 488, w: 600 };
	const grow = $derived(phase === 'you' ? (reduced ? 1 : smoothstep(0.5, 3.5, t)) : 0);
	const barParts = $derived.by(() => {
		let x = BAR.x;
		const parts: { s: Source; x: number; w: number }[] = [];
		for (const s of SOURCES) {
			const w = body[s] * BAR.w * grow;
			if (w > 0.2) parts.push({ s, x, w });
			x += w;
		}
		return parts;
	});
	const inStars = body.lowMass + body.massive + body.whiteDwarfs + body.mergers;
</script>

<g>
	<!-- the table -->
	<g opacity={fade.current}>
		{#each CELLS as c (c.o.z)}
			{@const f = fill(c.o.z)}
			{@const o = dimOf(c.o.z)}
			<g opacity={f * o}>
				{#if c.o.synthetic}
					<rect
						x={c.x + 1}
						y={c.y + 1}
						width={CW - 2}
						height={CH - 2}
						rx="4"
						fill="var(--st-none)"
						stroke="var(--border)"
					/>
				{:else}
					{@const shares = SOURCES.filter((s) => (c.o.shares[s] ?? 0) > 0)}
					{#each shares.reduce<{ s: Source; x: number; w: number }[]>((acc, s) => {
						const prev = acc.length ? acc[acc.length - 1] : null;
						const x = prev ? prev.x + prev.w : c.x + 1;
						acc.push({ s, x, w: (c.o.shares[s] ?? 0) * (CW - 2) });
						return acc;
					}, []) as part (part.s)}
						<rect
							x={part.x}
							y={c.y + 1}
							width={part.w}
							height={CH - 2}
							fill={pick === 'all' || pick === part.s ? COLOUR[part.s] : 'var(--st-none)'}
						/>
					{/each}
					<rect
						x={c.x + 1}
						y={c.y + 1}
						width={CW - 2}
						height={CH - 2}
						rx="4"
						fill="none"
						stroke="var(--border)"
					/>
				{/if}
				<Txt
					x={c.x + CW / 2}
					y={c.y + CH / 2 + (phase === 'you' && BODY_Z.has(c.o.z) ? 1 : 5)}
					text={c.o.symbol}
					size={14}
					weight={700}
					color="var(--st-cell-ink)"
				/>
				<Readout id="z-{c.o.z}">
					<Txt
						x={c.x + 4}
						y={c.y + 12}
						text={String(c.o.z)}
						size={9}
						anchor="start"
						color="var(--st-cell-ink)"
					/>
				</Readout>
			</g>
		{/each}

		<!-- rings on the elements the step is about -->
		{#each CELLS as c (c.o.z)}
			{#if (phase === 'heavy' && (HEAVY_S.has(c.o.z) || HEAVY_R.has(c.o.z))) || (phase === 'you' && BODY_Z.has(c.o.z))}
				<rect
					x={c.x - 1}
					y={c.y - 1}
					width={CW + 2}
					height={CH + 2}
					rx="6"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-dasharray={phase === 'heavy' && HEAVY_R.has(c.o.z) ? '6 4' : undefined}
					stroke-width="3"
					opacity={ring}
				/>
				{#if phase === 'you'}
					<Readout id="body-{c.o.z}">
						<Txt
							x={c.x + CW / 2}
							y={c.y + CH - 6}
							text="{(BODY_Z.get(c.o.z)! * 100).toLocaleString('en-US', {
								maximumFractionDigits: 1
							})}%"
							size={11}
							weight={700}
						/>
					</Readout>
				{/if}
			{/if}
		{/each}
	</g>

	<!-- what the step says, top middle (the empty space above the transition metals) -->
	{#if phase === 'origins'}
		<Readout
			id="pick"
			order={1}
			label={pick === 'all' ? 'Shading' : SOURCE_NAMES[pick as Source]}
			value={pick === 'all'
				? 'each square split by where its atoms were made'
				: `made most of the atoms of ${counts[pick as Source]} elements`}
		>
			<Txt
				x={X0 + 6.5 * CW}
				y={Y0 + 26}
				text={pick === 'all'
					? 'each square: where its atoms were made'
					: `${SOURCE_NAMES[pick as Source]}:`}
				size={14}
				weight={700}
			/>
			<Txt
				x={X0 + 6.5 * CW}
				y={Y0 + 48}
				text={pick === 'all'
					? 'strip widths = shares (approximate)'
					: `main source of ${counts[pick as Source]} elements`}
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'heavy'}
		<Readout
			id="s"
			order={1}
			label="Slow neutron capture (s-process)"
			value="in giant stars: strontium, barium, lead"
			color="var(--st-lowmass)"
		>
			<Txt
				x={X0 + 6.5 * CW}
				y={Y0 + 26}
				text="solid rings: s-process (giant stars)"
				size={13}
				weight={600}
			/>
		</Readout>
		<Readout
			id="r"
			order={2}
			label="Rapid neutron capture (r-process)"
			value="in neutron-star mergers: europium, platinum, gold, uranium"
			color="var(--st-mergers)"
		>
			<Txt
				x={X0 + 6.5 * CW}
				y={Y0 + 48}
				text="dashed rings: r-process (neutron-star mergers)"
				size={13}
				weight={600}
			/>
		</Readout>
	{:else}
		<Readout
			id="you"
			order={1}
			label="Your body, by mass"
			value="O 61%, C 23%, H 10%, N 2.6%, Ca 1.4%, P 1.1%"
		>
			<Txt x={X0 + 6.5 * CW} y={Y0 + 26} text="the elements of your body" size={14} weight={700} />
			<Txt x={X0 + 6.5 * CW} y={Y0 + 48} text="share of its mass under each" size={12} muted />
		</Readout>
	{/if}

	<!-- legend -->
	{#if phase !== 'you'}
		{#each SOURCES as s, k (s)}
			{@const lx = X0 + (k % 3) * 220 + 200}
			{@const ly = 494 + Math.floor(k / 3) * 26}
			<rect
				x={lx}
				y={ly - 11}
				width="14"
				height="14"
				rx="3"
				fill={COLOUR[s]}
				stroke="var(--border)"
				opacity={pick === 'all' || pick === s ? 1 : 0.35}
			/>
			<Readout id="key-{s}" order={2 + k} label={SOURCE_NAMES[s]} color={COLOUR[s]}>
				<Txt
					x={lx + 20}
					y={ly}
					text={SOURCE_NAMES[s]}
					anchor="start"
					size={12}
					opacity={pick === 'all' || pick === s ? 1 : 0.5}
				/>
			</Readout>
		{/each}
		<rect
			x={X0 + 200}
			y={546}
			width="14"
			height="14"
			rx="3"
			fill="var(--st-none)"
			stroke="var(--border)"
		/>
		<Readout id="key-none" order={9} label="no long-lived isotopes">
			<Txt x={X0 + 220} y={557} text="no long-lived isotopes" anchor="start" size={12} muted />
		</Readout>
	{:else}
		<!-- the body's mass by source -->
		<Readout id="bar-title"
			><Txt
				x={BAR.x}
				y={BAR.y - 10}
				text="your body’s mass, by where it was made"
				anchor="start"
				size={13}
				weight={600}
			/></Readout
		>
		<rect x={BAR.x} y={BAR.y} width={BAR.w} height="22" rx="4" fill="var(--stage-grid)" />
		{#each barParts as p (p.s)}
			<rect x={p.x} y={BAR.y} width={p.w} height="22" fill={COLOUR[p.s]} />
		{/each}
		<Readout id="bb">
			<Txt
				x={BAR.x}
				y={BAR.y + 42}
				text="Big Bang: {Math.round(body.bigBang * 100)}%"
				anchor="start"
				size={12}
				opacity={grow}
			/>
		</Readout>
		<Readout
			id="instars"
			order={3}
			label="Your body’s mass"
			value="{Math.round(inStars * 100)}% made in stars, {Math.round(
				body.bigBang * 100
			)}% (hydrogen) in the Big Bang"
		>
			<Txt
				x={BAR.x + BAR.w}
				y={BAR.y + 42}
				text="made in stars: {Math.round(inStars * 100)}%"
				anchor="end"
				size={14}
				weight={700}
				opacity={grow}
			/>
		</Readout>
		<Readout id="split"
			><Txt
				x={BAR.x + BAR.w}
				y={BAR.y + 62}
				text="massive stars {Math.round(body.massive * 100)}% · low-mass stars {Math.round(
					body.lowMass * 100
				)}% · white dwarfs {Math.round(body.whiteDwarfs * 100)}%"
				anchor="end"
				size={11}
				muted
				opacity={grow}
			/></Readout
		>
	{/if}
</g>
