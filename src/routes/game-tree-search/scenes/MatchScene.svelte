<script lang="ts">
	/**
	 * The rule of thumb, built and tested.
	 *
	 * 'build': left, an example position with the features the reader's rule counts (centre
	 * discs ringed, lines of two and of three drawn through their four squares; faint when the
	 * feature has no points) and the score that results for red. Right, the match: on "Play the
	 * match" (`params.runMatch`), 98 games of the reader's rule four moves ahead against the chosen
	 * opponent (`playMatch`, run once per press, never per frame), as a bar of wins, draws and
	 * losses and one square per game; under it the page's own rule against the same opponent.
	 *
	 * 'quoted': the three matches the last step quotes (MATCHES, checked in the model tests).
	 */
	import { untrack } from 'svelte';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		NO_RULE,
		PAGE_RULE,
		Position,
		ROWS,
		evaluate,
		features,
		playMatch,
		type Rule
	} from '../connect-four';
	import { MATCHES, OPPONENTS } from '../presets';
	import { pressWatcher } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(step.hints?.phase === 'quoted' ? 'quoted' : 'build');
	const num = (v: unknown) => Math.max(0, Math.round(Number(v ?? 0)) || 0);
	const rule = $derived<Rule>({
		centre: num(params.wCentre),
		two: num(params.wTwo),
		three: num(params.wThree)
	});
	const oppId = $derived<keyof typeof OPPONENTS>(
		params.opponent === 'page4' || params.opponent === 'none6' ? params.opponent : 'none4'
	);
	const opp = $derived(OPPONENTS[oppId]);
	const settings = $derived(`${rule.centre},${rule.two},${rule.three}|${oppId}`);

	// ---- the match, once per press ----------------------------------------------------
	interface Result {
		settings: string;
		wins: number;
		draws: number;
		losses: number;
		games: number[];
	}
	let result = $state<Result | null>(null);
	const fresh = pressWatcher(untrack(() => Number(params.runMatch ?? 0)));
	$effect(() => {
		const presses = Number(params.runMatch ?? 0);
		const r = rule;
		const s = settings;
		const o = opp;
		untrack(() => {
			if (!fresh(presses)) return;
			const m = playMatch(
				{ depth: 4, rule: r },
				{ depth: o.depth, rule: o.rule === 'page' ? PAGE_RULE : NO_RULE }
			);
			result = {
				settings: s,
				wins: m.wins,
				draws: m.draws,
				losses: m.losses,
				games: m.games.map((g) => g.result)
			};
		});
	});
	const stale = $derived(result !== null && result.settings !== settings);

	// ---- the example position ------------------------------------------------------------
	const EXAMPLE = '3243324245';
	const ex = Position.from(EXAMPLE);
	const fr = features(ex, 1);
	const fy = features(ex, 2);
	const exScore = $derived(evaluate(ex, rule)); // red is to move: the score is red's
	const EX = 48;
	const EY = 130;
	const EC = 40;
	const ecx = (c: number) => EX + c * EC + EC / 2;
	const ecy = (r: number) => EY + (ROWS - r) * EC - EC / 2;
	const at = (i: number) => ({ x: ecx(Math.floor(i / ROWS)), y: ecy(i % ROWS) });
	const lineOf = (w: readonly number[]) => {
		const a = at(w[0]);
		const b = at(w[3]);
		return `M${a.x} ${a.y}L${b.x} ${b.y}`;
	};
	const twosPath = (ws: (readonly number[])[]) => ws.map(lineOf).join('');

	const rows = $derived([
		{ name: 'Centre column', r: fr.centre, y: fy.centre, w: rule.centre },
		{ name: 'Two in a line', r: fr.twos.length, y: fy.twos.length, w: rule.two },
		{ name: 'Three in a line', r: fr.threes.length, y: fy.threes.length, w: rule.three }
	]);
	const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

	// ---- bars ---------------------------------------------------------------------------
	const BARX = 440;
	const BARW = 480;
	const seg = (r: { wins: number; draws: number; losses: number }) => {
		const n = r.wins + r.draws + r.losses;
		return [
			{ k: 'w', v: r.wins, x0: 0, w: (r.wins / n) * BARW, color: 'var(--gt-win)' },
			{
				k: 'd',
				v: r.draws,
				x0: (r.wins / n) * BARW,
				w: (r.draws / n) * BARW,
				color: 'var(--gt-draw)'
			},
			{
				k: 'l',
				v: r.losses,
				x0: ((r.wins + r.draws) / n) * BARW,
				w: (r.losses / n) * BARW,
				color: 'var(--gt-loss)'
			}
		];
	};
	const grow = $derived(reduced ? 1 : smoothstep(0.1, 1.2, t));
	const oppName = $derived(
		oppId === 'page4'
			? 'the page’s rule, 4 moves ahead'
			: oppId === 'none6'
				? 'no rule, 6 moves ahead'
				: 'no rule, 4 moves ahead'
	);
	const ruleName = (r: string, d: number) =>
		`${r === 'page' ? 'The page’s rule' : 'No rule'}, ${d} ahead`;
</script>

{#snippet bar(y: number, r: { wins: number; draws: number; losses: number }, opacity: number)}
	<g {opacity}>
		{#each seg(r) as s (s.k)}
			<rect
				x={BARX + s.x0 * grow}
				{y}
				width={Math.max(0, s.w * grow)}
				height="26"
				fill={s.color}
				opacity="0.8"
			/>
			{#if s.w > 34}
				<Label
					x={BARX + (s.x0 + s.w / 2) * grow}
					y={y + 18}
					text={String(s.v)}
					size={13}
					weight={700}
					halo={false}
					color="var(--stage-bg)"
					opacity={grow}
				/>
			{/if}
		{/each}
	</g>
{/snippet}

<g>
	{#if phase === 'build'}
		<!-- the example position -->
		<Readout id="m-ex-title">
			<Label
				x={EX}
				y={92}
				text="Your rule scores a position"
				size={15}
				weight={700}
				anchor="start"
			/>
			<Label x={EX} y={112} text="(an example, red to move)" size={12} muted anchor="start" />
		</Readout>
		<rect
			x={EX - 6}
			y={EY - 6}
			width={7 * EC + 12}
			height={ROWS * EC + 12}
			rx="10"
			fill="var(--gt-frame)"
		/>
		{#each Array.from({ length: 42 }, (_, i) => i) as i (i)}
			{@const p = at(i)}
			{@const v = ex.cells[i]}
			<circle
				cx={p.x}
				cy={p.y}
				r="16"
				fill={v === 1 ? 'var(--gt-red)' : v === 2 ? 'var(--gt-yellow)' : 'var(--gt-hole)'}
			/>
		{/each}
		<!-- centre column -->
		<rect
			x={ecx(3) - EC / 2 + 2}
			y={EY + 2}
			width={EC - 4}
			height={ROWS * EC - 4}
			rx="8"
			fill="none"
			stroke="var(--stage-bg)"
			stroke-width="2.5"
			stroke-dasharray="5 4"
			opacity={rule.centre > 0 ? 0.95 : 0.3}
		/>
		{#each [{ ws: fr.twos, c: 'var(--gt-red)', w: 3, on: rule.two > 0 }, { ws: fy.twos, c: 'var(--gt-yellow)', w: 3, on: rule.two > 0 }, { ws: fr.threes, c: 'var(--gt-red)', w: 6, on: rule.three > 0 }, { ws: fy.threes, c: 'var(--gt-yellow)', w: 6, on: rule.three > 0 }] as f, k (k)}
			<g opacity={f.on ? 1 : 0.15}>
				<path
					d={twosPath(f.ws)}
					stroke="var(--stage-bg)"
					stroke-width={f.w + 4}
					stroke-linecap="round"
					fill="none"
				/>
				<path
					d={twosPath(f.ws)}
					stroke={f.c}
					stroke-width={f.w}
					stroke-linecap="round"
					fill="none"
				/>
			</g>
		{/each}

		<!-- the arithmetic -->
		{@const TY = 412}
		<Readout id="m-table">
			<Label x={EX} y={TY} text="feature" size={11} muted anchor="start" />
			<Label x={EX + 150} y={TY} text="red" size={11} muted />
			<Label x={EX + 194} y={TY} text="yellow" size={11} muted />
			<Label x={EX + 340} y={TY} text="points" size={11} muted anchor="end" />
			{#each rows as r, k (r.name)}
				{@const y = TY + 24 + k * 22}
				<Label x={EX} {y} text={r.name} size={12} anchor="start" opacity={r.w ? 1 : 0.5} />
				<Label
					x={EX + 150}
					{y}
					text={String(r.r)}
					size={12}
					weight={700}
					color="var(--gt-red)"
					tabular
				/>
				<Label x={EX + 194} {y} text={String(r.y)} size={12} weight={700} tabular />
				<Label
					x={EX + 340}
					{y}
					text="({r.r} − {r.y}) × {r.w} = {signed((r.r - r.y) * r.w)}"
					size={12}
					anchor="end"
					tabular
					opacity={r.w ? 1 : 0.5}
				/>
			{/each}
		</Readout>
		<Readout
			id="m-score"
			order={1}
			label="Example position, for red"
			value="{signed(exScore)} points"
		>
			<Label
				x={EX + 340}
				y={TY + 100}
				text="Score for red: {signed(exScore)}"
				size={15}
				weight={700}
				anchor="end"
				tabular
			/>
		</Readout>

		<!-- the match -->
		<Readout id="m-title">
			<Label
				x={BARX}
				y={92}
				text="Your rule against {oppName}"
				size={15}
				weight={700}
				anchor="start"
			/>
			<Label
				x={BARX}
				y={112}
				text="98 games, your rule looking 4 moves ahead"
				size={12}
				muted
				anchor="start"
			/>
		</Readout>
		{#if result}
			{@const o = stale ? 0.35 : 1}
			<Readout
				id="m-result"
				order={2}
				label="Your rule"
				value="{result.wins} wins · {result.draws} draws · {result.losses} losses{stale
					? ' (rule changed)'
					: ''}"
			>
				<Label
					x={BARX}
					y={154}
					text="{result.wins} wins · {result.draws} draws · {result.losses} losses"
					size={14}
					weight={700}
					anchor="start"
					opacity={o}
					tabular
				/>
				{#if stale}
					<Label
						x={BARX + BARW}
						y={154}
						text="changed: play again"
						size={12}
						weight={600}
						color="var(--gt-loss-text)"
						anchor="end"
					/>
				{/if}
			</Readout>
			{@render bar(166, result, o)}
			<!-- one square per game: rows are the first move, pairs of columns the second -->
			{#each result.games as g, k (k)}
				<rect
					x={BARX + (k % 14) * 34 + 2}
					y={214 + Math.floor(k / 14) * 22}
					width="30"
					height="18"
					rx="3"
					fill={g > 0 ? 'var(--gt-win)' : g < 0 ? 'var(--gt-loss)' : 'var(--gt-draw)'}
					opacity={0.75 * o * grow}
				/>
			{/each}
			<Readout id="m-grid-note">
				<Label
					x={BARX}
					y={386}
					text="one square per game: green won, grey drawn, red lost"
					size={11}
					muted
					anchor="start"
				/>
			</Readout>
		{:else}
			<Readout id="m-wait" order={2} label="Your rule" value="press “Play the match”">
				<Label
					x={BARX}
					y={160}
					text="Set the points, then press “Play the match”."
					size={13}
					muted
					anchor="start"
				/>
			</Readout>
		{/if}
		<Readout
			id="m-page"
			order={3}
			label="The page’s rule, same opponent"
			value="{opp.page.wins} wins · {opp.page.draws} draws · {opp.page.losses} losses"
		>
			<Label
				x={BARX}
				y={438}
				text="For comparison, the page’s rule (centre 3, two 2, three 5):"
				size={12}
				anchor="start"
			/>
			<Label
				x={BARX}
				y={458}
				text="{opp.page.wins} wins · {opp.page.draws} draws · {opp.page.losses} losses"
				size={13}
				weight={700}
				anchor="start"
				tabular
			/>
		</Readout>
		{@render bar(470, opp.page, 0.85)}
		<Readout id="m-key">
			<rect x={BARX} y={520} width="12" height="12" rx="2" fill="var(--gt-win)" />
			<Label x={BARX + 18} y={531} text="win" size={11} anchor="start" />
			<rect x={BARX + 60} y={520} width="12" height="12" rx="2" fill="var(--gt-draw)" />
			<Label x={BARX + 78} y={531} text="draw" size={11} anchor="start" />
			<rect x={BARX + 126} y={520} width="12" height="12" rx="2" fill="var(--gt-loss)" />
			<Label x={BARX + 144} y={531} text="loss" size={11} anchor="start" />
		</Readout>
	{:else}
		<Readout id="q-title">
			<Label x={48} y={80} text="Three matches of 98 games" size={16} weight={700} anchor="start" />
			<Label
				x={48}
				y={102}
				text="results for the first player named: wins, draws, losses"
				size={12}
				muted
				anchor="start"
			/>
		</Readout>
		{#each MATCHES as m, k (k)}
			{@const y = 170 + k * 120}
			{@const show = reduced ? 1 : smoothstep(0.3 + k * 1.2, 1.1 + k * 1.2, t)}
			<Readout
				id="q-{k}"
				order={k + 1}
				label="{ruleName(m.a.rule, m.a.depth)} v {ruleName(m.b.rule, m.b.depth).toLowerCase()}"
				value="{m.wins} – {m.draws} – {m.losses}"
			>
				<Label
					x={48}
					y={y + 4}
					text={ruleName(m.a.rule, m.a.depth)}
					size={14}
					weight={700}
					anchor="start"
				/>
				<Label
					x={48}
					y={y + 24}
					text="against {ruleName(m.b.rule, m.b.depth).toLowerCase()}"
					size={12}
					muted
					anchor="start"
				/>
			</Readout>
			{@render bar(y - 12, m, show)}
			<Readout id="q-n-{k}">
				<Label
					x={BARX}
					y={y + 34}
					text="{m.wins} wins · {m.draws} draws · {m.losses} losses"
					size={12}
					muted
					anchor="start"
					opacity={show}
					tabular
				/>
			</Readout>
		{/each}
		<Readout id="q-key">
			<rect x={BARX} y={520} width="12" height="12" rx="2" fill="var(--gt-win)" />
			<Label x={BARX + 18} y={531} text="win" size={11} anchor="start" />
			<rect x={BARX + 60} y={520} width="12" height="12" rx="2" fill="var(--gt-draw)" />
			<Label x={BARX + 78} y={531} text="draw" size={11} anchor="start" />
			<rect x={BARX + 126} y={520} width="12" height="12" rx="2" fill="var(--gt-loss)" />
			<Label x={BARX + 144} y={531} text="loss" size={11} anchor="start" />
		</Readout>
	{/if}
</g>
