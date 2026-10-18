<script lang="ts">
	/**
	 * One sum, both models, run in the page. Top: the sum laid out in columns the way a person
	 * adds it, with its carries and its columns adding up to 9 (runs of nines) shaded. Middle: what the direct model
	 * writes, digit by digit, under the columns it stands for. Bottom: what the scratchpad model
	 * writes: each column's digit and carry (units first, so it fills from right to left, with an
	 * arrow from each carry it wrote to the column that reads it), then the answer. Characters
	 * appear one per forward pass at the same pace for both models; the line under each strip is
	 * the raw text the model wrote. Phase `direct` or `working` puts one model in focus.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { columns, nines, questionOf, WIDTH, type Mode } from '../addition';
	import { transcript } from '../models';
	import { int, sumOf } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'both'));
	const sum = $derived(sumOf(params));
	const a = $derived(sum[0]);
	const b = $derived(sum[1]);
	const cols = $derived(columns(a, b));
	const run = $derived(nines(a, b));
	const runText = $derived(
		run.run === 0
			? 'no column adds up to 9'
			: `longest run of nines: ${run.run} column${run.run > 1 ? 's' : ''}, ${run.carried ? 'a carry comes in' : 'no carry comes in'}`
	);
	const direct = $derived(transcript('direct', a, b));
	const scratch = $derived(transcript('scratchpad', a, b));

	// one character per forward pass, the same pace for both models
	const PACE = 0.32;
	const START = 0.6;
	const shown = $derived(reduced ? 99 : Math.max(0, Math.floor((t - START) / PACE) + 1));

	// ---- layout: column c (0 = units, 10 = the top carry) at x = colX(c)
	const COL_W = 46;
	const X0 = 330; // left edge of column 10
	const colX = (c: number) => X0 + (WIDTH - c) * COL_W + COL_W / 2;
	const GRID = { carry: 74, a: 104, b: 134, rule: 146, sum: 174 };
	const DIRECT = { y: 230, label: 236 };
	const SCR = { work: 356, answer: 446, label: 340 };

	/** Digits of a number by column (0 = units), WIDTH + 1 of them. */
	const digitsOfAll = (n: number) =>
		Array.from({ length: WIDTH + 1 }, (_, c) => Math.floor(n / 10 ** c) % 10);
	const da = $derived(digitsOfAll(a));
	const db = $derived(digitsOfAll(b));
	const ds = $derived(digitsOfAll(a + b));
	const top = (n: number) => (n === 0 ? 0 : Math.floor(Math.log10(n)));
	/** Leading zeros are drawn faintly: the models write them, a person would not. */
	const lead = (n: number, c: number) => c > top(n);

	/** Answer character i (most significant first) stands for column WIDTH − i. */
	const answerCol = (i: number) => WIDTH - i;

	interface Cell {
		ch: string;
		ok: boolean;
		p: number;
		on: boolean;
	}
	/** The k-th written character of a transcript, or null if not written yet. */
	function cellsOf(mode: Mode, from: number, count: number): (Cell | null)[] {
		const tr = mode === 'direct' ? direct : scratch;
		const out: (Cell | null)[] = [];
		for (let k = from; k < from + count; k++) {
			const w = tr.written[k];
			out.push(
				w && k < shown
					? { ch: w.char, ok: w.char === tr.right[k], p: w.p, on: k === shown - 1 }
					: null
			);
		}
		return out;
	}
	const directCells = $derived(cellsOf('direct', 0, WIDTH + 2));
	const workCells = $derived(cellsOf('scratchpad', 0, 2 * WIDTH));
	const scrAnswerCells = $derived(cellsOf('scratchpad', 2 * WIDTH + 1, WIDTH + 2));
	const markShown = $derived(shown > 2 * WIDTH);

	const textOf = (mode: Mode) => {
		const tr = mode === 'direct' ? direct : scratch;
		return tr.written
			.slice(0, shown)
			.map((w) => w.char)
			.join('');
	};
	const directText = $derived(textOf('direct'));
	const scratchText = $derived(textOf('scratchpad'));
	const answerOf = (mode: Mode, text: string) => {
		const s = mode === 'direct' ? text : text.slice(text.indexOf('>') + 1);
		return /^\d{11}/.test(s) ? Number(s.slice(0, 11)) : null;
	};
	const directDone = $derived(shown >= direct.written.length);
	const scratchDone = $derived(shown >= scratch.written.length);
	const directAns = $derived(answerOf('direct', textOf('direct')));
	const scratchAns = $derived(answerOf('scratchpad', textOf('scratchpad')));

	const verdict = (ans: number | null) =>
		ans === null ? 'no answer' : ans === a + b ? `${int(ans)}, right` : `${int(ans)}, wrong`;

	const dimDirect = $derived(phase === 'working' ? 0.4 : 1);
	const dimScratch = $derived(phase === 'direct' ? 0.4 : 1);
	const pulse = $derived(reduced ? 1 : 0.6 + 0.4 * Math.sin(t * 6));

	const fill = (c: Cell | null) =>
		c === null ? 'var(--surface)' : c.ok ? 'var(--cot-right-bg)' : 'var(--cot-wrong-bg)';
	const stroke = (c: Cell | null) =>
		c === null ? 'var(--border)' : c.ok ? 'var(--cot-right)' : 'var(--cot-wrong)';
</script>

<g>
	<Readout id="sum" order={0} label="The sum" value="{int(a)} + {int(b)} = {int(a + b)}">
		<Label x={40} y={34} anchor="start" size={16} weight={650} tabular text="{int(a)} + {int(b)}" />
	</Readout>
	<Readout id="nines" order={1} label="Runs of nines" value={runText}>
		<Label
			x={920}
			y={34}
			anchor="end"
			size={13}
			color="var(--cot-nine)"
			weight={600}
			text={runText}
		/>
	</Readout>

	<!-- the sum in columns, as a person adds it; columns adding up to 9 shaded -->
	{#each cols as c, i (i)}
		{#if c.a + c.b === 9}
			<rect
				x={colX(i) - COL_W / 2 + 3}
				y={GRID.a - 18}
				width={COL_W - 6}
				height={GRID.sum - GRID.a + 30}
				rx="6"
				fill="var(--cot-nine-bg)"
			/>
		{/if}
	{/each}
	<Readout id="grid-key">
		<Label x={40} y={GRID.carry + 4} anchor="start" size={11} muted text="carries" />
		<Label x={40} y={GRID.b + 4} anchor="start" size={11} muted text="the two numbers" />
		<Label x={40} y={GRID.sum + 4} anchor="start" size={11} muted text="the sum" />
		<Label
			x={40}
			y={GRID.sum + 22}
			anchor="start"
			size={11}
			muted
			text="shaded: columns adding up to 9"
		/>
	</Readout>
	{#each cols as c, i (i)}
		{#if c.carryOut}
			<text
				x={colX(i + 1)}
				y={GRID.carry + 4}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				fill="var(--cot-carry)"
				style:font-family="var(--font-mono)">1</text
			>
		{/if}
	{/each}
	{#each Array.from({ length: WIDTH + 1 }, (_, c) => c) as c (c)}
		{#if c < WIDTH}
			<text
				x={colX(c)}
				y={GRID.a + 6}
				text-anchor="middle"
				font-size="18"
				style:font-family="var(--font-mono)"
				opacity={lead(a, c) ? 0.3 : 1}>{da[c]}</text
			>
			<text
				x={colX(c)}
				y={GRID.b + 6}
				text-anchor="middle"
				font-size="18"
				style:font-family="var(--font-mono)"
				opacity={lead(b, c) ? 0.3 : 1}>{db[c]}</text
			>
		{/if}
		<text
			x={colX(c)}
			y={GRID.sum + 6}
			text-anchor="middle"
			font-size="18"
			font-weight="650"
			style:font-family="var(--font-mono)"
			opacity={lead(a + b, c) ? 0.3 : 1}>{ds[c]}</text
		>
	{/each}
	<text x={X0 - 6} y={GRID.b + 6} text-anchor="end" font-size="18">+</text>
	<line
		x1={X0}
		x2={colX(0) + COL_W / 2}
		y1={GRID.rule}
		y2={GRID.rule}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
	/>

	<!-- the direct model -->
	<g opacity={dimDirect}>
		<Label
			x={40}
			y={DIRECT.label}
			anchor="start"
			size={14}
			weight={650}
			color="var(--cot-direct)"
			text="Direct model"
		/>
		<Label
			x={40}
			y={DIRECT.label + 18}
			anchor="start"
			size={11}
			muted
			text="writes the answer at once"
		/>
		<Readout
			id="direct"
			order={2}
			label="Direct model"
			value={directDone ? verdict(directAns) : 'writing…'}
			color="var(--cot-direct)"
		>
			<Label
				x={40}
				y={DIRECT.label + 38}
				anchor="start"
				size={12}
				weight={600}
				color={directDone
					? directAns === a + b
						? 'var(--cot-right)'
						: 'var(--cot-wrong)'
					: undefined}
				tabular
				text={directDone ? verdict(directAns) : 'writing…'}
			/>
		</Readout>
		{#each directCells as cell, i (i)}
			{@const x = i <= WIDTH ? colX(answerCol(i)) : colX(0) + COL_W}
			<rect
				x={x - 17}
				y={DIRECT.y}
				width="34"
				height="34"
				rx="5"
				fill={fill(cell)}
				stroke={stroke(cell)}
				stroke-width={cell?.on ? 2.5 : 1.2}
				opacity={cell?.on ? pulse : 1}
			/>
			{#if cell}
				<text
					{x}
					y={DIRECT.y + 23}
					text-anchor="middle"
					font-size="17"
					font-weight="600"
					style:font-family="var(--font-mono)">{cell.ch}</text
				>
				{#if i <= WIDTH}
					<Readout id="dp{i}">
						<text
							{x}
							y={DIRECT.y + 50}
							text-anchor="middle"
							font-size="10"
							fill="var(--stage-ink-muted)"
							style:font-variant-numeric="tabular-nums">{Math.round(cell.p * 100)}%</text
						>
					</Readout>
				{/if}
			{/if}
		{/each}
		<Readout id="dp-key">
			<Label x={X0 - 10} y={DIRECT.y + 50} anchor="end" size={10} muted text="its probability" />
		</Readout>
	</g>

	<!-- the scratchpad model -->
	<g opacity={dimScratch}>
		<Label
			x={40}
			y={SCR.label}
			anchor="start"
			size={14}
			weight={650}
			color="var(--cot-scratch)"
			text="Scratchpad model"
		/>
		<Label
			x={40}
			y={SCR.label + 18}
			anchor="start"
			size={11}
			muted
			text="writes each column's digit"
		/>
		<Label x={40} y={SCR.label + 32} anchor="start" size={11} muted text="and carry, units first" />
		<Label x={40} y={SCR.answer + 22} anchor="start" size={11} muted text="then the answer" />
		<Readout
			id="scratch"
			order={3}
			label="Scratchpad model"
			value={scratchDone ? verdict(scratchAns) : 'writing…'}
			color="var(--cot-scratch)"
		>
			<Label
				x={40}
				y={SCR.answer + 40}
				anchor="start"
				size={12}
				weight={600}
				color={scratchDone
					? scratchAns === a + b
						? 'var(--cot-right)'
						: 'var(--cot-wrong)'
					: undefined}
				tabular
				text={scratchDone ? verdict(scratchAns) : 'writing…'}
			/>
		</Readout>
		<!-- working: column c's digit and carry under column c -->
		{#each Array.from({ length: WIDTH }, (_, c) => c) as c (c)}
			{@const dCell = workCells[2 * c]}
			{@const cCell = workCells[2 * c + 1]}
			{@const x = colX(c)}
			<rect
				x={x - 20}
				y={SCR.work}
				width="24"
				height="32"
				rx="4"
				fill={fill(dCell)}
				stroke={stroke(dCell)}
				stroke-width={dCell?.on ? 2.5 : 1.2}
				opacity={dCell?.on ? pulse : 1}
			/>
			<rect
				x={x + 6}
				y={SCR.work + 8}
				width="15"
				height="24"
				rx="4"
				fill={fill(cCell)}
				stroke={cCell ? stroke(cCell) : 'var(--border)'}
				stroke-width={cCell?.on ? 2.5 : 1.2}
				opacity={cCell?.on ? pulse : 1}
			/>
			{#if dCell}
				<text
					x={x - 8}
					y={SCR.work + 22}
					text-anchor="middle"
					font-size="16"
					font-weight="600"
					style:font-family="var(--font-mono)">{dCell.ch}</text
				>
			{/if}
			{#if cCell}
				<text
					x={x + 13.5}
					y={SCR.work + 25}
					text-anchor="middle"
					font-size="12"
					font-weight="700"
					fill={cCell.ch === '1' ? 'var(--cot-carry)' : 'var(--stage-ink-muted)'}
					style:font-family="var(--font-mono)">{cCell.ch}</text
				>
				{#if cCell.ch === '1' && c + 1 < WIDTH}
					<!-- the carry it wrote is read back in for the next column -->
					<path
						d="M {x + 13} {SCR.work + 6} C {x + 10} {SCR.work - 22}, {x - COL_W + 2} {SCR.work -
							22}, {x - COL_W - 6} {SCR.work - 3}"
						fill="none"
						stroke="var(--cot-carry)"
						stroke-width="1.6"
						marker-end="url(#arrowhead)"
						opacity={0.85}
					/>
				{/if}
			{/if}
		{/each}
		<Readout id="work-key">
			<Label x={X0 - 10} y={SCR.work + 52} anchor="end" size={10} muted text="digit · carry" />
		</Readout>
		<!-- the answer, read off the working -->
		{#each scrAnswerCells as cell, i (i)}
			{@const x = i <= WIDTH ? colX(answerCol(i)) : colX(0) + COL_W}
			<rect
				x={x - 17}
				y={SCR.answer}
				width="34"
				height="34"
				rx="5"
				fill={fill(cell)}
				stroke={stroke(cell)}
				stroke-width={cell?.on ? 2.5 : 1.2}
				opacity={cell?.on ? pulse : 1}
			/>
			{#if cell}
				<text
					{x}
					y={SCR.answer + 23}
					text-anchor="middle"
					font-size="17"
					font-weight="600"
					style:font-family="var(--font-mono)">{cell.ch}</text
				>
			{/if}
		{/each}
		{#if markShown}
			<text
				x={X0 - 10}
				y={SCR.answer + 23}
				text-anchor="end"
				font-size="15"
				fill="var(--stage-ink-muted)"
				style:font-family="var(--font-mono)">&gt;</text
			>
		{/if}
	</g>

	<!-- the raw text each model wrote after the question -->
	<Readout id="raw">
		<Label
			x={40}
			y={532}
			anchor="start"
			size={11}
			muted
			text="as text, after “{questionOf(a, b)}”:"
		/>
		{#each [{ y: 552, name: 'direct', text: directText, color: 'var(--cot-direct)', o: dimDirect }, { y: 572, name: 'scratchpad', text: scratchText, color: 'var(--cot-scratch)', o: dimScratch }] as row (row.name)}
			<Label
				x={40}
				y={row.y}
				anchor="start"
				size={12}
				weight={600}
				color={row.color}
				opacity={row.o}
				text={row.name}
			/>
			<Label
				x={130}
				y={row.y}
				anchor="start"
				size={12}
				mono
				opacity={row.o}
				text={row.text || '…'}
			/>
		{/each}
	</Readout>
</g>
