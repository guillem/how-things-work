<script lang="ts">
	/**
	 * Ten rounds of the prisoner's dilemma against the page. The reader's moves come from the
	 * `coop` and `cheat` buttons (action controls: their values count presses) and are kept as a
	 * string in the `moves` param (no control owns it, so it survives a visit to another step);
	 * `again` or a new `opponent` starts over. The page's moves follow from the reader's through
	 * the chosen strategy (../model.ts), with a fixed seed for Random. When the ten rounds are
	 * done, the scene compares the reader's total with always cheating and always cooperating
	 * against the same opponent.
	 */
	import { untrack } from 'svelte';
	import { Label, cycle } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { payoff, playMatch, rng, strategy, type Move, type StrategyId } from '../model';
	import { moveColor, payoffsOf } from './shared';

	let { t, params, reduced, setParam }: StageProps = $props();

	const ROUNDS = 10;
	const SEED = 11;
	const p = $derived(payoffsOf(params));
	const opp = $derived(strategy(String(params.opponent ?? 'tft') as StrategyId));
	const moves = $derived(
		[...String(params.moves ?? '')]
			.filter((m): m is Move => m === 'C' || m === 'D')
			.slice(0, ROUNDS)
	);

	// ---- the buttons ---------------------------------------------------------------------------
	const coop = $derived(Number(params.coop ?? 0));
	const cheat = $derived(Number(params.cheat ?? 0));
	const again = $derived(Number(params.again ?? 0));
	const oppId = $derived(opp.id);
	let seen = untrack(() => ({ coop, cheat, again, opp: oppId }));
	$effect(() => {
		const now = { coop, cheat, again, opp: oppId };
		untrack(() => {
			let next = String(params.moves ?? '');
			if (now.again !== seen.again || now.opp !== seen.opp) next = '';
			else {
				// presses that arrive in one batch (a fast double click) each count as a round
				next += 'C'.repeat(Math.max(0, now.coop - seen.coop));
				next += 'D'.repeat(Math.max(0, now.cheat - seen.cheat));
				next = next.slice(0, ROUNDS);
			}
			seen = now;
			if (next !== String(params.moves ?? '')) setParam('moves', next);
		});
	});

	// ---- the game so far -------------------------------------------------------------------------
	/** The page's reply to the reader's moves so far, round by round. */
	const theirs = $derived.by(() => {
		const rand = rng(SEED);
		const out: Move[] = [];
		for (let r = 0; r < moves.length; r++) {
			out.push(opp.decide({ mine: out, theirs: moves.slice(0, r), rand, payoffs: p }));
		}
		return out;
	});
	const mine = $derived(moves.map((m, r) => payoff(p, m, theirs[r])));
	const yours = $derived(theirs.map((m, r) => payoff(p, m, moves[r])));
	const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
	const done = $derived(moves.length >= ROUNDS);
	const versus = (id: StrategyId) =>
		playMatch(id, opp.id, { rounds: ROUNDS, payoffs: p, seed: SEED });
	const allCheat = $derived(versus('alld').scoreA);
	const allCoop = $derived(versus('allc').scoreA);

	// ---- layout --------------------------------------------------------------------------------
	const X0 = 196;
	const DX = 68;
	const YOU = 168;
	const THEM = 282;
	const R = 25;
	const xOf = (r: number) => X0 + r * DX;
	const pulse = $derived(reduced ? 1 : 0.55 + 0.45 * Math.sin(cycle(t, 1.6) * 2 * Math.PI));
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="You against"
		value="{opp.name}, round {Math.min(moves.length + 1, ROUNDS)} of {ROUNDS}"
	>
		<Label
			x={24}
			y={34}
			text="You against {opp.name} · {done
				? 'game over'
				: `round ${moves.length + 1} of ${ROUNDS}`}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Label x={24} y={56} text="{opp.name}: {opp.rule}" size={12} anchor="start" muted />

	<Label
		x={X0 - 50}
		y={YOU + 5}
		text="You"
		size={15}
		weight={700}
		anchor="end"
		color="var(--gt-you)"
	/>
	<Label
		x={X0 - 50}
		y={THEM + 5}
		text={opp.name}
		size={13}
		weight={700}
		anchor="end"
		color="var(--gt-them)"
	/>
	{#each Array.from({ length: ROUNDS }, (_, r) => r) as r (r)}
		<Label x={xOf(r)} y={YOU - 44} text={String(r + 1)} size={11} muted />
	{/each}

	<!-- tit for tat copies your previous move -->
	{#if opp.id === 'tft'}
		{#each Array.from({ length: Math.max(0, theirs.length - 1) }, (_, r) => r) as r (r)}
			<line
				x1={xOf(r) + 14}
				y1={YOU + 22}
				x2={xOf(r + 1) - 14}
				y2={THEM - 22}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				opacity="0.6"
				marker-end="url(#arrowhead)"
			/>
		{/each}
	{/if}

	{#each Array.from({ length: ROUNDS }, (_, r) => r) as r (r)}
		{#if r < moves.length}
			{#each [{ m: moves[r], y: YOU, pt: mine[r] }, { m: theirs[r], y: THEM, pt: yours[r] }] as c, k (k)}
				<circle cx={xOf(r)} cy={c.y} r={R} fill={moveColor(c.m)} />
				<text
					x={xOf(r)}
					y={c.y + 4}
					text-anchor="middle"
					font-size="11"
					font-weight="700"
					fill="#fff">{c.m === 'C' ? 'coop' : 'cheat'}</text
				>
				<Label
					x={xOf(r)}
					y={c.y + (k === 0 ? 46 : 46)}
					text="+{c.pt}"
					size={13}
					weight={600}
					color={k === 0 ? 'var(--gt-you)' : 'var(--gt-them)'}
					tabular
				/>
			{/each}
		{:else}
			{#each [YOU, THEM] as y (y)}
				<circle
					cx={xOf(r)}
					cy={y}
					r={R}
					fill="none"
					stroke="var(--stage-line)"
					stroke-dasharray="4 4"
					opacity={r === moves.length && y === YOU ? 1 : 0.6}
				/>
			{/each}
			{#if r === moves.length}
				<circle
					cx={xOf(r)}
					cy={YOU}
					r={R + 5}
					fill="none"
					stroke="var(--gt-you)"
					stroke-width="2"
					opacity={pulse}
				/>
			{/if}
		{/if}
	{/each}

	<!-- totals -->
	<Readout id="you" order={2} label="You" value="{sum(mine)} points" color="var(--gt-you)">
		<Label
			x={936}
			y={YOU + 8}
			text={String(sum(mine))}
			size={26}
			weight={700}
			anchor="end"
			color="var(--gt-you)"
			tabular
		/>
	</Readout>
	<Readout id="them" order={3} label={opp.name} value="{sum(yours)} points" color="var(--gt-them)">
		<Label
			x={936}
			y={THEM + 8}
			text={String(sum(yours))}
			size={26}
			weight={700}
			anchor="end"
			color="var(--gt-them)"
			tabular
		/>
	</Readout>
	<Label x={936} y={YOU - 44} text="total" size={11} anchor="end" muted />

	<!-- summary -->
	<g transform="translate(24 380)">
		<rect width="912" height="180" rx="12" fill="var(--surface)" stroke="var(--border)" />
		{#if done}
			<Readout
				id="summary"
				order={4}
				label="Over 10 rounds"
				value="you {sum(mine)}, always cheating {allCheat}, always cooperating {allCoop}"
			>
				<Label
					x={24}
					y={40}
					text="Against {opp.name.toLowerCase()}, over {ROUNDS} rounds:"
					size={14}
					weight={600}
					anchor="start"
					halo={false}
				/>
				{#each [{ k: 'your play', v: sum(mine), c: 'var(--gt-you)' }, { k: 'always cheating', v: allCheat, c: 'var(--gt-cheat)' }, { k: 'always cooperating', v: allCoop, c: 'var(--gt-coop)' }] as row, i (row.k)}
					{@const best = Math.max(sum(mine), allCheat, allCoop)}
					<Label x={24} y={80 + i * 32} text={row.k} size={13} anchor="start" halo={false} />
					<rect
						x={200}
						y={68 + i * 32}
						width={Math.max(2, (560 * row.v) / Math.max(1, best))}
						height="18"
						rx="4"
						fill={row.c}
						opacity="0.85"
					/>
					<Label
						x={210 + (560 * row.v) / Math.max(1, best)}
						y={82 + i * 32}
						text="{row.v} points"
						size={13}
						weight={600}
						anchor="start"
						halo={false}
						tabular
					/>
				{/each}
			</Readout>
		{:else}
			<Readout id="hint" label="Your move" value="press Cooperate or Cheat">
				<Label
					x={456}
					y={72}
					text="Press Cooperate or Cheat (under the picture) to play round {moves.length + 1}."
					size={14}
					halo={false}
				/>
			</Readout>
			<Label
				x={456}
				y={108}
				text="Points: both cooperate {p.R} each · both cheat {p.P} each · cheat on a cooperator {p.T}, and they get {p.S}"
				size={12}
				muted
				halo={false}
			/>
		{/if}
	</g>
</g>
