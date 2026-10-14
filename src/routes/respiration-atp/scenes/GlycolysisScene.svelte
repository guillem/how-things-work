<script lang="ts">
	/**
	 * Steps "invest", "payoff", "fermentation": glycolysis as a column of its
	 * intermediates, one row per enzyme, read from the model's `GLYCOLYSIS`
	 * table (carbons, phosphates, ATP and NADH of each step). One glucose
	 * travels down the column; each enzyme it passes lights its ATP / NADH chip
	 * and the tally on the right counts only what has happened on screen. The
	 * step's `phase` decides which rows are lit: the investment (to the split),
	 * the payoff (after it), or the whole run plus lactate dehydrogenase, whose
	 * NAD⁺ returns to the sixth enzyme. Reduced motion shows the finished run.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Molecule, Label, Flow, clamp, lerp, smoothstep, easeInOut } from '#lib/draw/index.ts';
	import Carrier from '../Carrier.svelte';
	import { CARRIER } from '../colors';
	import { GLYCOLYSIS, type Reaction } from '../model';

	let { step, t, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'invest'));

	// ---- rows ---------------------------------------------------------------------
	interface Row {
		i: number;
		name: string;
		carbons: number;
		phosphates: number;
		/** Copies of the molecule on this row (2 after the split). */
		copies: number;
		/** The enzyme that made it (none for glucose). */
		r?: Reaction;
	}
	const rows: Row[] = [
		{ i: 0, name: 'glucose', carbons: 6, phosphates: 0, copies: 1 },
		...GLYCOLYSIS.map((r, k) => ({
			i: k + 1,
			name: r.product.replace(/^2 /, ''),
			carbons: r.carbons,
			phosphates: r.phosphates ?? 0,
			copies: r.carbons === 3 ? 2 : 1,
			r
		}))
	];
	const LACTATE_ROW = rows.length; // 11
	const Y0 = 40;
	const DY = 48;
	const yOf = (i: number) => Y0 + i * DY;
	const X = 300;
	const SPLIT = 4; // the aldolase row

	const ENZYME_SHORT: Record<string, string> = {
		hexokinase: 'hexokinase',
		'phosphoglucose isomerase': 'isomerase',
		phosphofructokinase: 'phosphofructokinase',
		aldolase: 'aldolase',
		'triose phosphate isomerase': 'isomerase',
		'glyceraldehyde 3-phosphate dehydrogenase': 'G3P dehydrogenase',
		'phosphoglycerate kinase': 'phosphoglycerate kinase',
		'phosphoglycerate mutase': 'mutase',
		enolase: 'enolase',
		'pyruvate kinase': 'pyruvate kinase'
	};

	// ---- which rows the step is about ---------------------------------------------
	const range = $derived(
		phase === 'invest'
			? { from: 0, to: SPLIT }
			: phase === 'payoff'
				? { from: SPLIT, to: rows.length - 1 }
				: { from: 0, to: LACTATE_ROW }
	);
	const DIM = 0.45;
	const litOf = (from: number, to: number) =>
		Array.from({ length: LACTATE_ROW + 1 }, (_, i) => (i >= from && i <= to ? 1 : DIM));
	const lit = new Tween(
		untrack(() => litOf(range.from, range.to)),
		{ duration: 750, easing: cubicInOut }
	);
	$effect(() => {
		const target = litOf(range.from, range.to);
		untrack(() => lit.set(target, { duration: reduced ? 0 : 750 }));
	});
	const showLactate = $derived(phase === 'ferment');
	const lacO = Tween.of(() => (showLactate ? 1 : 0), { duration: 750, easing: cubicInOut });

	// ---- the travelling glucose -----------------------------------------------------
	const ROW_S = 1.1;
	const HOLD = 3;
	const steps = $derived(range.to - range.from);
	const period = $derived(steps * ROW_S + HOLD);
	/** Rows travelled past `range.from` (fractional), looping; finished under reduced motion. */
	const pos = $derived(reduced ? steps : Math.min(steps, ((t % period) / ROW_S) * 1));
	const at = $derived(range.from + pos);
	const tokenRow = $derived(Math.floor(at));
	const tokenU = $derived(easeInOut(clamp(at - tokenRow)));
	const tokenY = $derived(lerp(yOf(tokenRow), yOf(Math.min(tokenRow + 1, LACTATE_ROW)), tokenU));
	/** Whether row i's enzyme has acted (the token reached row i). */
	const done = (i: number) => at >= i - 0.02;

	// ---- the tally ------------------------------------------------------------------
	const tally = $derived.by(() => {
		let spent = 0;
		let made = 0;
		let nadh = 0;
		for (const row of rows) {
			if (!row.r || !done(row.i)) continue;
			const a = (row.r.atp ?? 0) * row.r.times;
			if (a < 0) spent -= a;
			else made += a;
			nadh += (row.r.nadh ?? 0) * row.r.times;
		}
		const recycled = showLactate && done(LACTATE_ROW) ? 2 : 0;
		return { spent, made, nadh, recycled };
	});

	// Event chips: ATP spent / made and NADH made, at the row of their enzyme.
	const chips = rows.flatMap((row) => {
		if (!row.r) return [];
		const out: { i: number; kind: 'ATP' | 'NADH'; n: number }[] = [];
		if (row.r.atp) out.push({ i: row.i, kind: 'ATP', n: row.r.atp * row.r.times });
		if (row.r.nadh) out.push({ i: row.i, kind: 'NADH', n: row.r.nadh * row.r.times });
		return out;
	});
	/** A chip pops when the glucose arrives at its row. */
	const pop = (i: number) => {
		const d = at - i;
		return d < -0.02 ? 0 : 1 + 0.25 * (1 - smoothstep(0, 0.5, d));
	};

	const halves = (row: Row) => (row.copies === 2 ? [X - 46, X + 46] : [X]);
	const lactateY = yOf(LACTATE_ROW);
	const loopD = `M ${X - 80} ${lactateY} C 44 ${lactateY}, 44 ${yOf(6) - 18}, 176 ${yOf(6) - 18}`;
</script>

<g class="glycolysis-scene">
	<Readout id="title">
		<Label x={24} y={22} text="cytosol" anchor="start" muted />
	</Readout>

	<!-- the column: arrows between rows, enzyme names on the left -->
	{#each rows as row (row.i)}
		{@const o = lit.current[row.i]}
		{#if row.i > 0}
			<g opacity={o}>
				<line
					x1={X}
					y1={yOf(row.i - 1) + 13}
					x2={X}
					y2={yOf(row.i) - 14}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.4"
					marker-end="url(#arrowhead)"
				/>
				<Readout id="enz-{row.i}">
					<Label
						x={X + 12}
						y={yOf(row.i) - 18}
						text={ENZYME_SHORT[row.r?.enzyme ?? ''] ?? ''}
						anchor="start"
						size={11}
						muted
					/>
				</Readout>
			</g>
		{/if}
	{/each}
	{#each rows as row (row.i)}
		{@const o = lit.current[row.i]}
		{@const here = !reduced && tokenRow === row.i && tokenU < 0.05}
		<g opacity={o * (done(row.i) || row.i < range.from ? 1 : 0.7)}>
			{#each halves(row) as hx (hx)}
				<Molecule
					kind="sugar"
					x={hx}
					y={yOf(row.i)}
					carbons={row.carbons}
					phosphates={row.phosphates}
					scale={here ? 1.08 : 1}
				/>
			{/each}
			<Readout id="mol-{row.i}">
				<Label
					x={X + (row.copies === 2 ? 100 : 72)}
					y={yOf(row.i) + 4}
					text={(row.copies === 2 && row.i > SPLIT ? '2 × ' : '') +
						(row.i === SPLIT ? 'DHAP + glyceraldehyde 3-phosphate' : row.name)}
					anchor="start"
					size={12}
				/>
			</Readout>
		</g>
	{/each}

	<!-- ATP / NADH chips beside their enzymes -->
	{#each chips as c (c.i + c.kind)}
		{@const o = lit.current[c.i]}
		{@const s = pop(c.i)}
		<g opacity={o * (s > 0 ? 1 : 0.35)}>
			<text
				x={178}
				y={yOf(c.i) - 14}
				text-anchor="end"
				font-size="12"
				font-weight="700"
				fill={c.kind === 'ATP' ? (c.n < 0 ? 'var(--stage-ink)' : '#f97316') : CARRIER.nadh}
				>{c.n > 0 ? '+' : '−'}{Math.abs(c.n)}</text
			>
			{#if c.kind === 'ATP'}
				<Molecule kind="ATP" x={206} y={yOf(c.i) - 18} scale={0.85 * Math.max(1, s)} />
			{:else}
				<Carrier kind="NADH" x={208} y={yOf(c.i) - 18} scale={0.85 * Math.max(1, s)} />
			{/if}
		</g>
	{/each}

	<!-- the travelling glucose: a glow on its row -->
	{#if !reduced}
		<ellipse
			cx={X}
			cy={tokenY}
			rx="96"
			ry="18"
			fill="#10b981"
			opacity={0.14 * (1 - smoothstep(steps - 0.05, steps, pos))}
		/>
	{/if}

	<!-- fermentation: lactate dehydrogenase, and NAD⁺ back to the sixth enzyme -->
	<g opacity={lacO.current}>
		<line
			x1={X}
			y1={yOf(LACTATE_ROW - 1) + 13}
			x2={X}
			y2={lactateY - 14}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			marker-end="url(#arrowhead)"
		/>
		<Label
			x={X + 12}
			y={lactateY - 18}
			text="lactate dehydrogenase"
			anchor="start"
			size={11}
			muted
		/>
		<g opacity={done(LACTATE_ROW) ? 1 : 0.55}>
			{#each [X - 46, X + 46] as hx (hx)}
				<Molecule kind="sugar" x={hx} y={lactateY} carbons={3} phosphates={0} />
			{/each}
			<Label x={X + 100} y={lactateY + 4} text="2 × lactate" anchor="start" size={12} />
		</g>
		<Flow d={loopD} color={CARRIER.nadh} width={1.6} dash={5} {t} speed={24} arrow />
		<Carrier kind="NAD+" x={68} y={(lactateY + yOf(6)) / 2} />
		<Label
			x={30}
			y={(lactateY + yOf(6)) / 2 + 26}
			text="NAD⁺ back"
			anchor="start"
			size={11}
			muted
		/>
	</g>

	<!-- ================= tally ================= -->
	<Readout id="card1">
		<rect
			x="640"
			y="60"
			width="296"
			height="172"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Label x={660} y={88} text="one glucose so far" anchor="start" size={13} weight={600} />
	<Readout id="spent" order={1} label="ATP spent" value={String(tally.spent)}>
		<text x="660" y="118" font-size="12" class="muted">ATP spent</text>
		<text x="916" y="118" font-size="14" font-weight="600" text-anchor="end">{tally.spent}</text>
	</Readout>
	<Readout id="made" order={2} label="ATP made" value={String(tally.made)}>
		<text x="660" y="144" font-size="12" class="muted">ATP made</text>
		<text x="916" y="144" font-size="14" font-weight="600" text-anchor="end">{tally.made}</text>
	</Readout>
	<Readout
		id="net"
		order={3}
		label="Net"
		value="{tally.made - tally.spent >= 0 ? '+' : '−'}{Math.abs(
			tally.made - tally.spent
		)} ATP, {tally.nadh - tally.recycled} NADH"
	>
		<line x1="660" y1="158" x2="916" y2="158" stroke="var(--border)" />
		<text x="660" y="182" font-size="12" font-weight="600">net ATP</text>
		<text x="916" y="182" font-size="16" font-weight="700" text-anchor="end" fill="#f97316"
			>{tally.made - tally.spent >= 0 ? '+' : '−'}{Math.abs(tally.made - tally.spent)}</text
		>
		<text x="660" y="210" font-size="12" font-weight="600">NADH kept</text>
		<text x="916" y="210" font-size="16" font-weight="700" text-anchor="end" fill={CARRIER.nadh}
			>{tally.nadh - tally.recycled}</text
		>
	</Readout>
	{#if showLactate}
		<Readout id="ferm" order={4} label="Without oxygen" value="NAD⁺ is recycled; 2 ATP per glucose">
			<Label x={788} y={256} text="NAD⁺ recycled: glycolysis keeps going" size={11} muted />
		</Readout>
	{:else if phase === 'payoff'}
		<Readout id="pyr" order={4} label="Left over" value="2 pyruvate still hold most of the energy">
			<Label x={788} y={256} text="2 pyruvate still hold most of the energy" size={11} muted />
		</Readout>
	{:else}
		<Readout
			id="inv"
			order={4}
			label="So far"
			value="an investment: 2 ATP spent to split the sugar"
		>
			<Label x={788} y={256} text="an investment: 2 ATP spent to split the sugar" size={11} muted />
		</Readout>
	{/if}
</g>
