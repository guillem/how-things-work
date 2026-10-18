<script lang="ts">
	/**
	 * The logarithm as a count of steps: a log number line from 1 to a million, with the reader's
	 * number on it (draggable), and rows of equal hops of ×2, ×10 and ×31.6 (one earthquake
	 * magnitude in energy) from 1 to that number. The hops counted, with the fraction of the last
	 * one, are the logarithms in base 2, 10 and 31.6.
	 *
	 * Phases: `two` (the doublings row in focus) and `ten` (the ×10 and magnitude rows in focus).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, clamp, lerp, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { logBase } from '../explog';
	import { fmt } from '../format';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'two'));
	const T = $derived(reduced ? 1e6 : t);

	const X0 = 190;
	/** The left column: row names and their counts. */
	const COL = 24;
	const X1 = 890;
	const LINE = 330;
	const sx = scale([0, 6], [X0, X1]);
	const at = (v: number) => sx(Math.log10(v));

	const e = $derived(clamp(Number(params.number ?? 3), 0, 6));
	/** The number, rounded to 3 figures as the slider shows it. */
	const x = $derived(Number((10 ** e).toPrecision(3)));
	const xText = $derived(fmt(x));

	const MAG = 10 ** 1.5;
	const rows = [
		{ id: 'two', base: 2, name: '×2', y: 250, sym: 'log₂', what: 'doublings' },
		{ id: 'ten', base: 10, name: '×10', y: 430, sym: 'log₁₀', what: 'zeros' },
		{ id: 'mag', base: MAG, name: '×32', y: 530, sym: 'log₃₂', what: 'magnitude steps' }
	] as const;

	const focusTwo = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		untrack(() => focusTwo.set(p === 'two' ? 1 : 0, { duration: reduced ? 0 : 700 }));
	});
	const rowOpacity = (id: string) =>
		id === 'two' ? 0.35 + 0.65 * focusTwo.current : 1 - 0.65 * focusTwo.current;

	/** The hops grow in one after another (complete after about 2 s, or at once if reduced). */
	const grown = $derived(smoothstep(0.2, 2.2, T));

	const hops = (base: number) => {
		const count = logBase(base, x);
		const whole = Math.floor(count + 1e-9);
		const out: { from: number; to: number; partial: boolean }[] = [];
		for (let k = 0; k < whole; k++)
			out.push({ from: base ** k, to: base ** (k + 1), partial: false });
		if (count - whole > 1e-6) out.push({ from: base ** whole, to: x, partial: true });
		return { count, whole, out };
	};
	const arc = (a: number, b: number, y: number, h: number) =>
		`M${a.toFixed(1)} ${y} Q${((a + b) / 2).toFixed(1)} ${y - h} ${b.toFixed(1)} ${y}`;

	const minor = Array.from({ length: 6 }, (_, d) =>
		Array.from({ length: 8 }, (_, i) => (i + 2) * 10 ** d)
	).flat();
	const decadeLabel = ['1', '10', '100', '1,000', '10,000', '100,000', '1,000,000'];

	const two = $derived(hops(2));
	const ten = $derived(hops(10));
	const lead = $derived(phase === 'two' ? two : ten);
	const leadSym = $derived(phase === 'two' ? 'log₂' : 'log₁₀');
	const leadNote = $derived(
		phase === 'two'
			? two.count - two.whole > 1e-6
				? `${two.whole} doublings reach ${fmt(2 ** two.whole)}; ${(two.count - two.whole).toFixed(2)} of the next one gets to ${xText}`
				: `exactly ${two.whole} doublings`
			: ten.count - ten.whole > 1e-6
				? `${ten.whole} zeros reach ${fmt(10 ** ten.whole)}; ${(ten.count - ten.whole).toFixed(2)} of the next ×10 gets to ${xText}`
				: `exactly ${ten.whole} zeros`
	);
</script>

<g>
	<!-- the title readout -->
	<Readout
		id="lead"
		order={1}
		label="{leadSym} {xText}"
		value={lead.count.toFixed(2)}
		note={leadNote}
	>
		<Label
			x={480}
			y={70}
			text="{leadSym} {xText} = {lead.count.toFixed(2)}"
			size={24}
			weight={600}
			tabular
			halo={false}
		/>
		<Label x={480} y={98} text={leadNote} size={13} muted halo={false} />
	</Readout>

	<!-- the log number line -->
	<line x1={X0} x2={X1} y1={LINE} y2={LINE} stroke="var(--stage-ink)" stroke-width="1.5" />
	{#each minor as v (v)}
		<line
			x1={at(v)}
			x2={at(v)}
			y1={LINE - 5}
			y2={LINE + 5}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
	{/each}
	{#each decadeLabel as text, d (d)}
		<line
			x1={sx(d)}
			x2={sx(d)}
			y1={LINE - 10}
			y2={LINE + 10}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<Readout id="dec-{d}">
			<Label x={sx(d)} y={LINE + 28} {text} size={12} muted />
		</Readout>
	{/each}
	<Readout id="line-name">
		<Label x={COL} y={LINE + 5} text="log scale: ×10 per tick" anchor="start" size={11} muted />
	</Readout>

	<!-- the rows of hops -->
	{#each rows as row (row.id)}
		{@const h = row.id === 'two' ? two : row.id === 'ten' ? ten : hops(MAG)}
		{@const show = row.id !== 'mag' || phase === 'ten'}
		{@const o = rowOpacity(row.id) * (show ? 1 : 0)}
		{@const n = h.out.length}
		<g opacity={o}>
			<line
				x1={X0}
				x2={X1}
				y1={row.y}
				y2={row.y}
				stroke="var(--stage-line)"
				stroke-width="1"
				stroke-dasharray="2 4"
			/>
			<Label
				x={COL}
				y={row.y - 4}
				text="hops of {row.name}"
				anchor="start"
				size={14}
				weight={600}
			/>
			{#each h.out as hop, k (k)}
				{@const a = at(hop.from)}
				{@const b = at(hop.to)}
				{@const u = clamp(grown * n - k)}
				{@const hh = Math.min(42, 12 + (at(row.base) - X0) * 0.25)}
				{#if u > 0}
					<path
						d={arc(a, lerp(a, b, u), row.y, hh * Math.min(1, (b - a) / (at(row.base) - X0)))}
						fill="none"
						stroke={row.id === 'two'
							? 'var(--xl-mul)'
							: row.id === 'ten'
								? 'var(--xl-add)'
								: 'var(--xl-slow)'}
						stroke-width="2"
						stroke-dasharray={hop.partial ? '5 4' : undefined}
					/>
					<circle cx={b} cy={row.y} r="2.5" fill="var(--stage-ink)" opacity={u >= 1 ? 1 : 0} />
				{/if}
				{#if !hop.partial && (row.id !== 'two' || k % (n > 12 ? 2 : 1) === 1 || n <= 12) && u >= 1}
					<Readout id="hop-{row.id}-{k}">
						<Label x={(a + b) / 2} y={row.y - hh - 6} text={String(k + 1)} size={11} muted />
					</Readout>
				{/if}
			{/each}
			<circle cx={X0} cy={row.y} r="3" fill="var(--stage-ink)" />
			<Readout
				id="row-{row.id}"
				order={row.id === 'two' ? 2 : row.id === 'ten' ? 3 : 4}
				label="{row.sym} {xText}"
				value="{h.count.toFixed(2)} {row.what}"
				opacity={o}
			>
				<Label
					x={COL}
					y={row.y + 16}
					text="{h.count.toFixed(2)} {row.what}"
					anchor="start"
					size={13}
					tabular
				/>
			</Readout>
		</g>
	{/each}

	<!-- the reader's number (the dashed line stops short of the line's labels) -->
	{#each [[rows[0].y - 50, LINE - 14], [LINE + 36, phase === 'ten' ? rows[2].y + 8 : rows[1].y + 8]] as [y1, y2], i (i)}
		<line
			x1={at(x)}
			x2={at(x)}
			{y1}
			{y2}
			stroke="var(--stage-ink)"
			stroke-width="1"
			stroke-dasharray="3 3"
			opacity="0.6"
		/>
	{/each}
	<Handle
		x={at(x)}
		y={LINE}
		label="Number on the log scale"
		value={e}
		min={0}
		max={6}
		valuetext={xText}
		onmove={(p: Point) => setParam('number', Math.round(clamp(sx.invert(p.x), 0, 6) * 100) / 100)}
		onkey={(s) =>
			setParam(
				'number',
				s === 'start' ? 0 : s === 'end' ? 6 : clamp(Math.round((e + s * 0.01) * 100) / 100, 0, 6)
			)}
	/>
</g>
