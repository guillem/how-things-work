<script lang="ts">
	/**
	 * Knudson's two-hit model of retinoblastoma (`knudsonChildren` in ../model.ts): 40 children,
	 * each drawn as a pair of eyes with a red spot per tumour. Carriers of one broken RB1 get a
	 * Poisson number of tumours (mean 3, shared between the eyes); without the inherited hit,
	 * both hits must strike one cell, so almost nobody gets one. On the right, this group's
	 * counts beside Knudson's expectation. `params.inherited`, `params.children` (new group).
	 */
	import { Label, hash, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { knudsonChildren, knudsonOdds } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const N = 40;
	const carrier = $derived(params.inherited !== false);
	const presses = $derived(Number(params.children ?? 0));
	const kids = $derived(knudsonChildren(N, carrier, 1 + presses));

	// Replays the reveal when the group changes.
	const key = $derived(`${carrier}|${presses}`);
	let startedKey = '';
	let startedAt = 0;
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (key !== startedKey || t < lastT) {
			startedAt = startedKey === '' || t < lastT ? 0 : t;
			startedKey = key;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});
	const shown = (i: number) => (reduced ? 1 : smoothstep(0, 1, (tRun - 0.3 - i * 0.045) / 0.2));

	// ---- the children -------------------------------------------------------------------
	const COLS = 8;
	const CW = 76;
	const CH = 92;
	const GX = 34;
	const GY = 70;
	const ER = 15;
	const children = $derived(
		kids.map((c, i) => {
			const x = GX + (i % COLS) * CW + CW / 2;
			const y = GY + Math.floor(i / COLS) * CH + 34;
			const spots = (n: number, side: number) =>
				Array.from({ length: n }, (_, j) => {
					const a = hash(i * 31 + j, side) * Math.PI * 2;
					const rr = 4 + hash(i * 17 + j, side + 7) * (ER - 9);
					return { x: Math.cos(a) * rr, y: Math.sin(a) * rr, j };
				});
			return {
				i,
				x,
				y,
				left: spots(c.left, 1),
				right: spots(c.right, 2),
				kind: c.left > 0 && c.right > 0 ? 'both' : c.left + c.right > 0 ? 'one' : 'none'
			};
		})
	);

	// ---- the tally ----------------------------------------------------------------------
	const odds = knudsonOdds();
	const tally = $derived(
		(['none', 'one', 'both'] as const).map((k) => ({
			k,
			label: { none: 'no tumour', one: 'one eye', both: 'both eyes' }[k],
			seen: children.filter((c, i) => c.kind === k && shown(i) > 0.5).length,
			expected: carrier
				? N * { none: odds.none, one: odds.oneEye, both: odds.bothEyes }[k]
				: k === 'none'
					? N
					: 0
		}))
	);
	const TX = 690;
	const TW = 200;
	const sw = scale([0, N], [0, TW]);
	const tumours = $derived(kids.reduce((a, c) => a + c.left + c.right, 0));
</script>

<g class="knudson-scene">
	<Readout id="k-title">
		<text x={GX} y={40} style:font-size="15px" font-weight="600"
			>{carrier
				? '40 children who inherited one broken RB1'
				: '40 children with two working copies of RB1'}</text
		>
	</Readout>

	{#each children as c (c.i)}
		<g opacity={shown(c.i)}>
			{#each [-1, 1] as side (side)}
				{@const spots = side < 0 ? c.left : c.right}
				<circle
					cx={c.x + side * 17}
					cy={c.y}
					r={ER}
					fill="var(--ca-eye)"
					stroke={spots.length ? 'var(--ca-cancer)' : 'var(--stage-line)'}
					stroke-width={spots.length ? 2 : 1.2}
				/>
				<circle cx={c.x + side * 17} cy={c.y} r={5} fill="var(--ca-iris)" opacity="0.7" />
				{#each spots as s (s.j)}
					<circle cx={c.x + side * 17 + s.x} cy={c.y + s.y} r={3.6} fill="var(--ca-cancer)" />
				{/each}
			{/each}
		</g>
	{/each}

	<!-- tally -->
	<Readout id="k-sub">
		<text x={TX} y={84} style:font-size="12px" class="muted">this group (bars) and</text>
		<text x={TX} y={100} style:font-size="12px" class="muted">Knudson's expectation (ticks)</text>
	</Readout>
	{#each tally as row, i (row.k)}
		{@const y = 140 + i * 74}
		<Readout
			id="t-{row.k}"
			order={1 + i}
			label={row.label}
			value="{row.seen} of {N} (expected {Math.round(row.expected)})"
			color={row.k === 'none' ? undefined : 'var(--ca-cancer)'}
		>
			<g>
				<text x={TX} {y} style:font-size="13px" font-weight="600">{row.label}</text>
				<text x={TX + TW} {y} text-anchor="end" style:font-size="13px">{row.seen}</text>
				<rect x={TX} y={y + 10} width={TW} height={16} rx="4" fill="var(--stage-grid)" />
				<rect
					x={TX}
					y={y + 10}
					width={sw(row.seen)}
					height={16}
					rx="4"
					fill={row.k === 'none' ? 'var(--stage-ink-muted)' : 'var(--ca-cancer)'}
					opacity="0.85"
				/>
				<line
					x1={TX + sw(row.expected)}
					x2={TX + sw(row.expected)}
					y1={y + 4}
					y2={y + 32}
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				<text x={TX} y={y + 46} style:font-size="11px" class="muted"
					>expected {(row.expected / N) * 100 < 1 && row.expected > 0
						? '< 1'
						: Math.round((row.expected / N) * 100)}%</text
				>
			</g>
		</Readout>
	{/each}
	<Readout id="k-total" order={5} label="Tumours in this group" value={String(tumours)}>
		<text x={TX} y={378} style:font-size="13px">{tumours} tumours in all</text>
		<text x={TX} y={396} style:font-size="12px" class="muted"
			>{carrier
				? `Knudson: 3 per child, ${N * 3} expected`
				: 'two hits in one cell: almost never'}</text
		>
	</Readout>
	<Readout id="k-key">
		<g>
			<circle
				cx={TX + 15}
				cy={450}
				r={ER}
				fill="var(--ca-eye)"
				stroke="var(--ca-cancer)"
				stroke-width="2"
			/>
			<circle cx={TX + 15} cy={450} r={5} fill="var(--ca-iris)" opacity="0.7" />
			<circle cx={TX + 20} cy={444} r={3.6} fill="var(--ca-cancer)" />
			<text x={TX + 40} y={454} style:font-size="12px">an eye; red spot: a tumour</text>
		</g>
	</Readout>
	<Readout id="k-source">
		<Label x={936} y={584} text="Model: Knudson, PNAS 1971" anchor="end" size={11} muted />
	</Readout>
</g>
