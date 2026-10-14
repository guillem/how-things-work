<script lang="ts">
	/**
	 * The Byzantine generals, run with Oral Messages OM(m), m = the number of traitors
	 * (`generals()` in the model). The commander (top) sends "attack"; traitors follow the
	 * model's two-faced strategy.
	 *
	 * Timeline (loops every PERIOD s): round 1, the commander's order to each lieutenant;
	 * round 2, every lieutenant passes on what it heard to every other; then each loyal
	 * lieutenant's majority decision and the verdict. With two traitors OM(2) needs a third
	 * round, summarised in the panel rather than drawn. Reduced motion shows the end.
	 */
	import { clamp, polar, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { generals, maxTraitors, type Order } from '../consensus';
	import Txt from './Txt.svelte';

	let { t, params, reduced }: StageProps = $props();

	const n = $derived(clamp(Math.round(Number(params.n ?? 3)), 3, 7));
	const f = $derived(clamp(Math.round(Number(params.traitors ?? 1)), 0, 2));
	const role = $derived(String(params.role ?? 'lieutenant'));
	const traitors = $derived(
		f === 0
			? []
			: role === 'commander'
				? [0, ...Array.from({ length: f - 1 }, (_, k) => n - 1 - k)]
				: Array.from({ length: f }, (_, k) => n - 1 - k)
	);
	const run = $derived(generals(n, traitors, 'attack'));
	const isTraitor = (g: number) => traitors.includes(g);
	const lts = $derived(Array.from({ length: n - 1 }, (_, i) => i + 1));

	const PERIOD = 16;
	const tv = $derived(reduced ? 15 : t % PERIOD);
	const R1 = { from: 0.6, to: 2.6 };
	const R2 = { from: 3.4, to: 6.4 };
	const DECIDE = 7.2;
	const fadeOut = $derived(reduced ? 1 : 1 - smoothstep(PERIOD - 0.6, PERIOD - 0.05, tv));
	const r1 = $derived(clamp((tv - R1.from) / (R1.to - R1.from)));
	const r2 = $derived(f === 0 ? 0 : clamp((tv - R2.from) / (R2.to - R2.from)));
	const decided = $derived(tv >= DECIDE);

	// ---- geometry ----------------------------------------------------------------------------
	const C = { x: 250, y: 330 };
	const RING = 165;
	const RG = 30;
	const pos = $derived(
		Array.from({ length: n }, (_, i) => polar(C.x, C.y, RING, -Math.PI / 2 + (i * 2 * Math.PI) / n))
	);
	const name = (g: number) => (g === 0 ? 'C' : `L${g}`);
	const ATTACK = 'var(--cb-term4)';
	const RETREAT = 'var(--cb-term1)';
	const col = (v: Order) => (v === 'attack' ? ATTACK : RETREAT);

	function seg(a: number, b: number, u: number, off = 0) {
		const A = pos[a];
		const B = pos[b];
		const dx = B.x - A.x;
		const dy = B.y - A.y;
		const len = Math.hypot(dx, dy);
		const ux = dx / len;
		const uy = dy / len;
		const s0 = { x: A.x + ux * (RG + 4) - uy * off, y: A.y + uy * (RG + 4) + ux * off };
		const s1 = { x: B.x - ux * (RG + 8) - uy * off, y: B.y - uy * (RG + 8) + ux * off };
		return { s0, s1, p: { x: s0.x + (s1.x - s0.x) * u, y: s0.y + (s1.y - s0.y) * u } };
	}

	const relays = $derived(
		lts.flatMap((i) =>
			lts.filter((j) => j !== i).map((j) => ({ from: j, to: i, value: run.relayed[i][j] }))
		)
	);

	const verdict = $derived(
		!run.agree
			? 'The loyal lieutenants disagree'
			: !run.obey
				? 'They agree, but not with their loyal commander'
				: isTraitor(0)
					? 'The loyal lieutenants agree'
					: 'All loyal generals agree and obey'
	);
	const need = $derived(3 * f + 1);
	const rule = $derived(
		f === 0
			? 'No traitors: everyone just follows the order'
			: `${f} traitor${f > 1 ? 's need' : ' needs'} at least 3 × ${f} + 1 = ${need} generals; here ${n}`
	);

	// ---- panel --------------------------------------------------------------------------------
	const P = { x: 520, y: 150, row: 46 };
	const panelRows = $derived(run.loyal);
	const votesOf = (i: number): { j: number; v: Order }[] =>
		f === 0
			? [{ j: 0, v: run.received.get(i)! }]
			: lts.map((j) => ({ j, v: run.votes.get(i)!.get(j)! }));
</script>

<g>
	<!-- generals -->
	{#each pos as p, g (g)}
		{@const traitor = isTraitor(g)}
		{@const dec = g > 0 && !traitor ? run.decided.get(g) : undefined}
		<circle
			cx={p.x}
			cy={p.y}
			r={RG}
			fill={traitor ? 'var(--cb-bad)' : 'var(--surface)'}
			fill-opacity={traitor ? 0.18 : 1}
			stroke={traitor ? 'var(--cb-bad)' : 'var(--stage-ink-muted)'}
			stroke-width={g === 0 ? 3 : 2}
		/>
		<text x={p.x} y={p.y + 5} text-anchor="middle" style:font-size="15px" style:font-weight="700"
			>{name(g)}</text
		>
		{@const dx = (p.x - C.x) / RING}
		{@const dy = (p.y - C.y) / RING}
		{@const out = (d: number) => ({ x: p.x + dx * d, y: p.y + dy * d })}
		{@const lab = out(RG + 20)}
		<Readout id="who-{g}">
			<Txt
				x={lab.x}
				y={lab.y + 4}
				text={g === 0 ? (traitor ? 'commander · traitor' : 'commander') : traitor ? 'traitor' : ''}
				size={12}
				weight={traitor ? 700 : 500}
				anchor="middle"
				color={traitor ? 'var(--cb-bad)' : undefined}
				muted={!traitor}
			/>
		</Readout>
		{#if dec && decided}
			{@const b = out(RG + 24)}
			<g opacity={smoothstep(DECIDE, DECIDE + 0.4, tv) * fadeOut}>
				<rect x={b.x - 32} y={b.y - 11} width="64" height="22" rx="11" fill={col(dec)} />
				<text
					x={b.x}
					y={b.y + 4}
					text-anchor="middle"
					style:font-size="12px"
					style:font-weight="700"
					style:fill="white">{dec}</text
				>
			</g>
		{/if}
	{/each}

	<!-- round 1: the commander's order -->
	{#each lts as l (l)}
		{@const v = run.received.get(l)!}
		{@const s = seg(0, l, r1)}
		{@const lp = seg(0, l, 0.55)}
		{#if tv >= R1.from}
			<g opacity={fadeOut * (1 - 0.6 * smoothstep(R2.from - 0.4, R2.from, tv) * (f > 0 ? 1 : 0))}>
				<line
					x1={s.s0.x}
					y1={s.s0.y}
					x2={s.p.x}
					y2={s.p.y}
					stroke={col(v)}
					stroke-width="2.5"
					marker-end={r1 >= 1 ? 'url(#arrowhead)' : undefined}
				/>
				<g opacity={smoothstep(0.5, 0.65, r1)}>
					<rect x={lp.p.x - 28} y={lp.p.y - 10} width="56" height="20" rx="10" fill={col(v)} />
					<text
						x={lp.p.x}
						y={lp.p.y + 4}
						text-anchor="middle"
						style:font-size="11px"
						style:font-weight="700"
						style:fill="white">{v}</text
					>
				</g>
			</g>
		{/if}
	{/each}

	<!-- round 2: every lieutenant relays what it heard -->
	{#if f > 0 && tv >= R2.from}
		{#each relays as r (`${r.from}-${r.to}`)}
			{@const s = seg(r.from, r.to, r2, 5)}
			<g opacity={fadeOut * (decided ? 0.45 : 1)}>
				<line
					x1={s.s0.x}
					y1={s.s0.y}
					x2={s.p.x}
					y2={s.p.y}
					stroke={col(r.value)}
					stroke-width="1.8"
				/>
				{#if r2 < 1}
					<circle cx={s.p.x} cy={s.p.y} r="4" fill={col(r.value)} />
				{/if}
			</g>
		{/each}
	{/if}

	<!-- header -->
	<Readout id="title" order={1} label="Generals" value="{n}, {f} traitor{f === 1 ? '' : 's'}">
		<Txt
			x={24}
			y={40}
			text="{n} generals, {f} traitor{f === 1 ? '' : 's'}"
			size={16}
			weight={700}
		/>
	</Readout>
	<Readout
		id="phase"
		order={2}
		label="Round"
		value={tv < R2.from || f === 0
			? '1: the order'
			: tv < DECIDE
				? '2: pass it on'
				: 'decide by majority'}
	>
		<Txt
			x={24}
			y={62}
			text={tv < R2.from || f === 0
				? 'Round 1: the commander sends the order'
				: tv < DECIDE
					? `Round 2: each lieutenant tells the others what he heard${f > 1 ? ' (and a third round checks those reports)' : ''}`
					: 'Each loyal lieutenant takes the majority (a tie means retreat)'}
			size={12}
			muted
		/>
	</Readout>

	<!-- panel -->
	<Txt x={P.x} y={P.y - 50} text="What each loyal lieutenant goes by" size={13} weight={700} />
	<Readout id="panel-key">
		<Txt
			x={P.x}
			y={P.y - 32}
			text={f === 0
				? 'the order from the commander'
				: f === 1
					? 'the commander’s order as he got it, and as each other lieutenant reported it'
					: 'his own copy and, for each other lieutenant, what the third round settled'}
			size={11}
			muted
		/>
	</Readout>
	{#each panelRows as i, k (i)}
		{@const y = P.y + k * P.row}
		{@const vs = votesOf(i)}
		<g opacity={smoothstep(R1.to, R1.to + 0.4, tv) * fadeOut}>
			<Txt x={P.x} y={y + 16} text={name(i)} size={14} weight={700} />
			{#each vs as cell, c (cell.j)}
				{@const x = P.x + 36 + c * 44}
				{@const shown = cell.j === i || f === 0 || tv >= R2.to}
				<g opacity={shown ? 1 : 0.15}>
					<rect {x} {y} width="40" height="24" rx="5" fill={col(cell.v)} />
					<text
						x={x + 20}
						y={y + 16}
						text-anchor="middle"
						style:font-size="11px"
						style:font-weight="700"
						style:fill="white">{cell.v === 'attack' ? 'A' : 'R'}</text
					>
					<text x={x + 20} y={y - 3} text-anchor="middle" class="muted" style:font-size="9px"
						>{cell.j === i ? 'C→me' : `via ${name(cell.j)}`}</text
					>
				</g>
			{/each}
			{#if decided}
				{@const d = run.decided.get(i)!}
				<g opacity={smoothstep(DECIDE, DECIDE + 0.4, tv)}>
					<Txt
						x={P.x + 44 + vs.length * 44}
						y={y + 16}
						text="→ {d}"
						size={13}
						weight={700}
						color={col(d)}
					/>
				</g>
			{/if}
		</g>
	{/each}
	<Readout id="key">
		<g transform="translate({P.x}, {P.y + panelRows.length * P.row + 6})">
			<rect x="0" y="0" width="22" height="16" rx="4" fill={ATTACK} />
			<Txt x={28} y={13} text="A = attack" size={11} muted />
			<rect x="104" y="0" width="22" height="16" rx="4" fill={RETREAT} />
			<Txt x={132} y={13} text="R = retreat" size={11} muted />
		</g>
	</Readout>

	<!-- verdict -->
	<g opacity={decided ? smoothstep(DECIDE, DECIDE + 0.5, tv) * fadeOut : 0}>
		<Readout
			id="verdict"
			order={3}
			label="Result"
			value={verdict}
			color={run.ok ? 'var(--cb-ok)' : 'var(--cb-bad)'}
			opacity={decided ? 1 : 0}
		>
			<Txt
				x={P.x}
				y={510}
				text={(run.ok ? '✓ ' : '✕ ') + verdict}
				size={14}
				weight={700}
				color={run.ok ? 'var(--cb-ok)' : 'var(--cb-bad)'}
			/>
		</Readout>
	</g>
	<Readout
		id="rule"
		order={4}
		label="Rule"
		value={rule}
		note={f > 0 && n === 3
			? 'L1 hears the same whether C or L2 lies, so he can’t know whom to believe'
			: undefined}
	>
		<Txt
			x={P.x}
			y={536}
			text={rule}
			size={12}
			weight={600}
			color={f > 0 && n < need ? 'var(--cb-bad)' : undefined}
		/>
		{#if f > 0 && n === 3}
			<Txt
				x={P.x}
				y={556}
				text="L1 hears the same whether C or L2 is the liar: he can’t know whom to believe."
				size={11}
				muted
			/>
		{:else}
			<Txt
				x={P.x}
				y={556}
				text="Up to {maxTraitors(n)} traitor{maxTraitors(n) === 1
					? ''
					: 's'} can be survived by {n} generals · {run.messages} messages sent"
				size={11}
				muted
			/>
		{/if}
	</Readout>
</g>
