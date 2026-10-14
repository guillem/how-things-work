<script lang="ts">
	/**
	 * The halting table and the diagonal argument.
	 *
	 * The grid is real: six small machines (rows), each run on the description
	 * of each of them (columns), halting (H) or running forever (∞), as decided
	 * by `haltingTable` (run and watch for repeats).
	 *
	 * - `table`: the grid, with one entry after another explained on the right.
	 * - `argument`: the five moves of Turing's proof, chosen with the
	 *   `argument` slider: the endless list, the supposed decider H, the
	 *   diagonal and the machine D that flips it, D differing from every row,
	 *   and D run on its own description.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { haltingTable, type Verdict } from '../turing';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const table = haltingTable();
	const N = table.names.length;
	const isArgument = $derived(Boolean(step.hints?.argument));
	const move = $derived(isArgument ? clamp(Math.round(Number(params.argument ?? 1)), 1, 5) : 0);

	// Smooth changes between the moves of the argument.
	const show = {
		more: new Tween(0, { duration: 700, easing: cubicInOut }),
		h: new Tween(0, { duration: 700, easing: cubicInOut }),
		diag: new Tween(0, { duration: 700, easing: cubicInOut }),
		d: new Tween(0, { duration: 700, easing: cubicInOut }),
		self: new Tween(0, { duration: 700, easing: cubicInOut })
	};
	$effect(() => {
		const mv = move;
		const instant = reduced;
		untrack(() => {
			const o = instant ? { duration: 0 } : undefined;
			void show.more.set(mv >= 1 ? 1 : 0, o);
			void show.h.set(mv === 2 ? 1 : 0, o);
			void show.diag.set(mv >= 3 ? 1 : 0, o);
			void show.d.set(mv >= 3 ? 1 : 0, o);
			void show.self.set(mv >= 5 ? 1 : 0, o);
		});
	});

	// ---- geometry ----------------------------------------------------------------------
	const NAME_X = 24;
	const GX = 150;
	const CS = 48;
	const RH = 38;
	const GY = 128;
	const colX = (j: number) => GX + j * CS + CS / 2;
	const rowY = (i: number) => GY + RH * (i + 0.5);
	const dRow = N + 1.4;
	const color = (v: Verdict) => (v === 'halts' ? 'var(--tm-halt)' : 'var(--tm-loop)');
	const glyph = (v: Verdict) => (v === 'halts' ? 'H' : '∞');
	const flip = (v: Verdict): Verdict => (v === 'halts' ? 'loops' : 'halts');
	const diag = table.cells.map((r, i) => r[i]);
	const dVals = diag.map(flip);

	// ---- the table step: one entry after another --------------------------------------
	const PER = 3.2;
	const order = [
		[3, 0],
		[3, 1],
		[0, 2],
		[2, 4],
		[5, 1],
		[4, 4]
	] as const;
	const pick = $derived(reduced ? 0 : Math.floor(Math.max(0, t - 0.8) / PER) % order.length);
	const [pi, pj] = $derived(order[pick]);
	const why = (i: number, j: number) => {
		const v = table.cells[i][j];
		const code = table.codes[j];
		const ones = [...code].filter((c) => c === '1').length;
		switch (table.names[i]) {
			case 'Add one':
				return 'adds one to the bits and stops: it halts on any string of 0s and 1s';
			case 'Palindrome?':
				return v === 'halts' ? 'answers yes or no and stops' : 'runs forever';
			case 'Walk right':
				return 'walks right forever, whatever the input';
			case 'Even length':
				return `the description has ${code.length} symbols: ${code.length % 2 ? 'odd, so it walks off forever' : 'even, so it halts'}`;
			case '1s ÷ 4':
				return `the description has ${ones} 1s: ${ones % 4 ? 'not a multiple of 4, so it walks off forever' : 'a multiple of 4, so it halts'}`;
			default:
				return `the description has ${code.length} symbols: ${code.length % 3 ? 'not a multiple of 3, so it walks off forever' : 'a multiple of 3, so it halts'}`;
		}
	};

	// ---- the argument, move 4: D against each row in turn ------------------------------
	const cmp = $derived(reduced ? 2 : Math.floor(Math.max(0, t - 0.6) / 1.6) % N);

	const panelText = $derived.by((): { title: string; lines: string[] } => {
		switch (move) {
			case 1:
				return {
					title: '1 · List every machine',
					lines: [
						'Every machine has a description, so',
						'they can all be listed in order: these six',
						'and infinitely many more, rows and columns.',
						'Entry (row k, column j): does machine k',
						'halt when given description j?'
					]
				};
			case 2:
				return {
					title: '2 · Suppose H decides halting',
					lines: [
						'H takes a machine M and an input x,',
						'always halts, and says whether M halts on x.',
						'Then H could fill in every entry of',
						'the endless table.'
					]
				};
			case 3:
				return {
					title: '3 · Build D from H',
					lines: [
						'D, given a description M:',
						'ask H whether M halts on M itself,',
						'then do the opposite: loop forever if',
						'H says “halts”, halt if it says “runs forever”.',
						'D’s row is the diagonal, flipped.'
					]
				};
			case 4:
				return {
					title: '4 · D is in no row',
					lines: [
						`D differs from row ${cmp + 1} (${table.names[cmp]})`,
						`in column ${cmp + 1}: ${glyph(diag[cmp])} there, ${glyph(dVals[cmp])} for D.`,
						'The same for every row k, in column k.',
						'But D is a machine, so it must have a row.'
					]
				};
			default:
				return {
					title: '5 · Run D on its own description',
					lines: [
						'If D halts on ⟨D⟩, H says “halts”,',
						'so D loops. If D loops, H says',
						'“runs forever”, so D halts.',
						'Either way, a contradiction: H cannot exist.'
					]
				};
		}
	});

	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));
</script>

<g opacity={fadeIn}>
	<Readout
		id="h-title"
		order={1}
		label={isArgument ? panelText.title : 'Machine k run on description j'}
	>
		<Txt
			x={24}
			y={42}
			text={isArgument
				? 'Can one program H fill in this table for every machine?'
				: 'Does machine k halt on description j?'}
			size={18}
			weight={600}
		/>
		<Txt
			x={24}
			y={68}
			text="H: halts · ∞: runs forever · ⟨j⟩: the description of machine j, as 0s and 1s"
			size={13}
			muted
		/>
	</Readout>

	<!-- column headers -->
	{#each table.names as _, j (j)}
		<Txt
			x={colX(j)}
			y={GY - 10}
			text="⟨{j + 1}⟩"
			size={13}
			anchor="middle"
			weight={600}
			color="var(--tm-desc)"
		/>
	{/each}
	<g opacity={show.more.current}>
		<Txt x={colX(N)} y={GY - 10} text="…" size={15} anchor="middle" color="var(--tm-desc)" />
		<g opacity={show.self.current}>
			<Txt
				x={colX(N + 1)}
				y={GY - 10}
				text="⟨D⟩"
				size={13}
				anchor="middle"
				weight={700}
				color="var(--tm-write)"
			/>
		</g>
	</g>

	<!-- rows -->
	{#each table.cells as row, i (i)}
		{@const dimRow = move === 4 && i !== cmp ? 0.45 : 1}
		<g opacity={dimRow}>
			<Txt x={NAME_X} y={rowY(i) + 5} text="{i + 1}. {table.names[i]}" size={13} weight={500} />
			{#each row as v, j (j)}
				{@const isPick = !isArgument && i === pi && j === pj}
				{@const onDiag = i === j}
				<rect
					x={colX(j) - CS / 2 + 3}
					y={rowY(i) - RH / 2 + 3}
					width={CS - 6}
					height={RH - 6}
					rx="6"
					fill={color(v)}
					fill-opacity={isPick ? 0.32 : 0.13}
					stroke={isPick ? color(v) : 'none'}
					stroke-width="2"
				/>
				{#if onDiag}
					<rect
						x={colX(j) - CS / 2 + 1}
						y={rowY(i) - RH / 2 + 1}
						width={CS - 2}
						height={RH - 2}
						rx="7"
						fill="none"
						stroke="var(--tm-write)"
						stroke-width="2.5"
						opacity={show.diag.current}
					/>
				{/if}
				<Txt
					x={colX(j)}
					y={rowY(i) + 6}
					text={glyph(v)}
					size={16}
					anchor="middle"
					weight={700}
					color={color(v)}
					halo={false}
				/>
			{/each}
			<g opacity={show.more.current}>
				<Txt x={colX(N)} y={rowY(i) + 5} text="…" size={15} anchor="middle" muted />
			</g>
		</g>
	{/each}
	<g opacity={show.more.current}>
		<Txt x={NAME_X} y={rowY(N) + 2} text="⋮  infinitely many more" size={13} muted />
		{#each table.names as _, j (j)}
			<Txt x={colX(j)} y={rowY(N) + 2} text="⋮" size={15} anchor="middle" muted />
		{/each}
	</g>

	<!-- D's row: the diagonal, flipped -->
	<g opacity={show.d.current}>
		<rect
			x={NAME_X - 8}
			y={rowY(dRow) - RH / 2 - 2}
			width={colX(N + 1) + CS / 2 - NAME_X + 14}
			height={RH + 4}
			rx="9"
			fill="var(--tm-write)"
			fill-opacity="0.08"
			stroke="var(--tm-write)"
		/>
		<Txt x={NAME_X} y={rowY(dRow) + 5} text="D" size={13} weight={700} color="var(--tm-write)" />
		{#each dVals as v, j (j)}
			{@const hot = move === 4 && j === cmp}
			<rect
				x={colX(j) - CS / 2 + 3}
				y={rowY(dRow) - RH / 2 + 3}
				width={CS - 6}
				height={RH - 6}
				rx="6"
				fill={color(v)}
				fill-opacity={hot ? 0.35 : 0.15}
				stroke={hot ? 'var(--tm-write)' : 'none'}
				stroke-width="2.5"
			/>
			<Txt
				x={colX(j)}
				y={rowY(dRow) + 6}
				text={glyph(v)}
				size={16}
				anchor="middle"
				weight={700}
				color={color(v)}
				halo={false}
			/>
		{/each}
		<Txt x={colX(N)} y={rowY(dRow) + 5} text="…" size={15} anchor="middle" muted />
		<g opacity={show.self.current}>
			<rect
				x={colX(N + 1) - CS / 2 + 3}
				y={rowY(dRow) - RH / 2 + 3}
				width={CS - 6}
				height={RH - 6}
				rx="6"
				fill="var(--tm-write)"
				fill-opacity="0.3"
				stroke="var(--tm-write)"
				stroke-width="2.5"
			/>
			<Txt
				x={colX(N + 1)}
				y={rowY(dRow) + 7}
				text="?"
				size={20}
				anchor="middle"
				weight={800}
				color="var(--tm-write)"
				halo={false}
			/>
		</g>

	</g>

	<!-- the right-hand panel -->
	{#if !isArgument}
		{@const v = table.cells[pi][pj]}
		<Readout
			id="entry"
			order={2}
			label="{table.names[pi]} on ⟨{pj + 1}⟩"
			value={v === 'halts' ? 'halts' : 'runs forever'}
			note={why(pi, pj)}
			color={color(v)}
		>
			<rect
				x={560}
				y={GY - 4}
				width={384}
				height={250}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Txt
				x={576}
				y={GY + 22}
				text="{table.names[pi]} run on ⟨{pj + 1}⟩ ({table.names[pj]})"
				size={14}
				weight={600}
				halo={false}
			/>
			<Txt
				x={576}
				y={GY + 48}
				text="⟨{pj + 1}⟩ = {table.codes[pj].slice(0, 30)}…"
				size={12}
				mono
				muted
				halo={false}
			/>
			<Txt
				x={576}
				y={GY + 68}
				text="({table.codes[pj].length} symbols)"
				size={12}
				muted
				halo={false}
			/>
			{#each why(pi, pj).match(/.{1,44}(\s|$)/g) ?? [] as line, k (k)}
				<Txt x={576} y={GY + 102 + k * 20} text={line.trim()} size={13} halo={false} />
			{/each}
			<Txt
				x={576}
				y={GY + 164}
				text={v === 'halts' ? 'Verdict: halts' : 'Verdict: runs forever'}
				size={15}
				weight={700}
				color={color(v)}
				halo={false}
			/>
		</Readout>
		<Readout id="h-foot">
			<Txt
				x={24}
				y={470}
				text="Each entry here was settled by running the machine and spotting a repeat."
				size={14}
				weight={600}
			/>
			<Txt
				x={24}
				y={494}
				text="The halting problem asks for one program that settles every entry of the endless table, for every machine."
				size={13}
				muted
			/>
		</Readout>
	{:else}
		{@const p = panelText}
		<Readout id="move" order={2} label={p.title} value={p.lines.join(' ')}>
			<rect
				x={560}
				y={GY - 4}
				width={384}
				height={190}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Txt
				x={576}
				y={GY + 22}
				text={p.title}
				size={15}
				weight={700}
				color="var(--tm-write)"
				halo={false}
			/>
			{#each p.lines as line, k (k)}
				<Txt x={576} y={GY + 52 + k * 22} text={line} size={13} halo={false} />
			{/each}
		</Readout>
		<!-- move 2: H as a box -->
		<g opacity={show.h.current}>
			<rect
				x={600}
				y={350}
				width={300}
				height={66}
				rx="12"
				fill="var(--tm-desc)"
				fill-opacity="0.1"
				stroke="var(--tm-desc)"
				stroke-width="2"
			/>
			<Txt
				x={750}
				y={378}
				text="H(M, x)"
				size={16}
				anchor="middle"
				weight={700}
				color="var(--tm-desc)"
				halo={false}
			/>
			<Txt
				x={750}
				y={400}
				text="always halts: “halts” or “runs forever”"
				size={12}
				anchor="middle"
				halo={false}
			/>
		</g>
		{#if move === 3}
			<g>
				<rect
					x={600}
					y={350}
					width={300}
					height={86}
					rx="12"
					fill="var(--tm-write)"
					fill-opacity="0.08"
					stroke="var(--tm-write)"
					stroke-width="2"
				/>
				<Txt
					x={616}
					y={376}
					text="D(M):"
					size={14}
					weight={700}
					color="var(--tm-write)"
					halo={false}
					mono
				/>
				<Txt x={616} y={398} text="if H(M, M) = halts: loop forever" size={13} halo={false} mono />
				<Txt x={616} y={420} text="else: halt" size={13} halo={false} mono />
			</g>
		{/if}
		{#if move === 5}
			<Readout
				id="contra"
				order={3}
				label="D on ⟨D⟩"
				value="halts ⇒ loops, loops ⇒ halts: impossible"
				color="var(--tm-write)"
			>
				<rect
					x={600}
					y={350}
					width={300}
					height={86}
					rx="12"
					fill="var(--tm-write)"
					fill-opacity="0.08"
					stroke="var(--tm-write)"
					stroke-width="2"
				/>
				<Txt x={616} y={376} text="D halts on ⟨D⟩ ⇒ D loops on ⟨D⟩" size={13} halo={false} />
				<Txt x={616} y={398} text="D loops on ⟨D⟩ ⇒ D halts on ⟨D⟩" size={13} halo={false} />
				<Txt
					x={616}
					y={422}
					text="So no such H exists."
					size={14}
					weight={700}
					color="var(--tm-write)"
					halo={false}
				/>
			</Readout>
		{/if}
	{/if}
</g>
