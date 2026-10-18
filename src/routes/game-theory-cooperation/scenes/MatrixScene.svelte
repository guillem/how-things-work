<script lang="ts">
	/**
	 * The one-shot prisoner's dilemma (../model.ts `bestReply`): the payoff table with the
	 * reader's four numbers, then, column by column, an arrow to the better reply for "you"
	 * (cheating, whenever the payoffs are a dilemma), then the cell both players end up in and
	 * the cell that would have been better for both. On the right, the conditions T > R > P > S
	 * and 2R > T + S, ticked or crossed.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bestReply, isDilemma, payoff, rewardsCooperation, type Move } from '../model';
	import { payoffsOf } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const p = $derived(payoffsOf(params));
	const clock = $derived(reduced ? 99 : t);
	const show1 = $derived(smoothstep(1.2, 2.2, clock));
	const show2 = $derived(smoothstep(3.2, 4.2, clock));
	const show3 = $derived(smoothstep(5.5, 6.5, clock));
	const dilemma = $derived(isDilemma(p));

	const COLS: { them: Move; label: string; x: number }[] = [
		{ them: 'C', label: 'They cooperate', x: 250 },
		{ them: 'D', label: 'They cheat', x: 470 }
	];
	const ROWS: { me: Move; label: string; y: number }[] = [
		{ me: 'C', label: 'You cooperate', y: 120 },
		{ me: 'D', label: 'You cheat', y: 280 }
	];
	/** Right edge of the row headers. */
	const HX = 236;
	const W = 210;
	const H = 150;

	/** Better reply in each column, with how much more it earns. */
	const replies = $derived(
		COLS.map((c) => {
			const best = bestReply(p, c.them);
			const gain = Math.abs(payoff(p, 'D', c.them) - payoff(p, 'C', c.them));
			return { ...c, best, gain };
		})
	);
	/** Where two players who each take their better reply end up (if each column agrees). */
	const settled = $derived(
		replies[0].best === replies[1].best && replies.every((r) => r.gain > 0) ? replies[0].best : null
	);
	/** Some choice of theirs leaves you indifferent between your two moves. */
	const tie = $derived(replies.some((r) => r.gain === 0));
	const checks = $derived([
		{ text: `temptation ${p.T} > reward ${p.R}`, ok: p.T > p.R },
		{ text: `reward ${p.R} > punishment ${p.P}`, ok: p.R > p.P },
		{ text: `punishment ${p.P} > sucker ${p.S}`, ok: p.P > p.S }
	]);
	const repeatOk = $derived(rewardsCooperation(p));
	const repeatEven = $derived(2 * p.R === p.T + p.S);
	const repeatSign = $derived(repeatOk ? '>' : repeatEven ? '=' : '<');
	const repeatNote = $derived(
		repeatOk
			? ['cooperating every round beats', 'taking turns to cheat']
			: repeatEven
				? ['taking turns to cheat pays the same', 'as cooperating every round']
				: ['taking turns to cheat pays', 'more than cooperating']
	);
	const verdict = $derived(dilemma ? "a prisoner's dilemma" : 'not a dilemma');
	const caption = $derived(
		dilemma
			? [
					'Whatever they do, cheating earns you more, and they reason the same way:',
					`both cheat and get ${p.P} each, though both cooperating gives each ${p.R}.`
				]
			: settled === 'C'
				? ['Cooperating is the better reply whatever they do:', 'nothing to resist, so no dilemma.']
				: settled === 'D'
					? [
							`Cheating still pays more, but both cheating (${p.P} each) is no worse`,
							`than both cooperating (${p.R} each): no dilemma.`
						]
					: tie
						? [
								'Against at least one of their choices, cooperating and cheating',
								'pay you the same: not the prisoner’s dilemma.'
							]
						: [
								'The better reply depends on what the other does:',
								'a different game, not the prisoner’s dilemma.'
							]
	);
	const cellOf = (me: Move, them: Move) => ({
		x: COLS.find((c) => c.them === them)?.x ?? 0,
		y: ROWS.find((r) => r.me === me)?.y ?? 0
	});
	const end = $derived(settled ? cellOf(settled, settled) : null);
	const both = cellOf('C', 'C');
</script>

<g>
	<Readout id="title" order={1} label="One game" value="points: you · them">
		<Label
			x={24}
			y={34}
			text="One game: each player chooses without seeing the other’s choice"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Label
		x={24}
		y={56}
		text="points in each box: yours (large), theirs (small)"
		size={11}
		anchor="start"
		muted
	/>

	<!-- headers -->
	{#each COLS as c (c.them)}
		<Label x={c.x + W / 2} y={104} text={c.label} size={14} weight={600} />
	{/each}
	{#each ROWS as r (r.me)}
		<Label x={HX} y={r.y + H / 2 + 5} text={r.label} size={14} weight={600} anchor="end" />
	{/each}

	<!-- cells -->
	{#each ROWS as r (r.me)}
		{#each COLS as c (c.them)}
			{@const mine = payoff(p, r.me, c.them)}
			{@const theirs = payoff(p, c.them, r.me)}
			<rect
				x={c.x}
				y={r.y}
				width={W}
				height={H}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
				stroke-width="1.2"
			/>
			<rect
				x={c.x + 12}
				y={r.y + 12}
				width="10"
				height="10"
				rx="5"
				fill={r.me === 'C' ? 'var(--gt-coop)' : 'var(--gt-cheat)'}
			/>
			<rect
				x={c.x + 24}
				y={r.y + 12}
				width="10"
				height="10"
				rx="5"
				fill={c.them === 'C' ? 'var(--gt-coop)' : 'var(--gt-cheat)'}
				opacity="0.6"
			/>
			<Label
				x={c.x + 70}
				y={r.y + 92}
				text={String(mine)}
				size={44}
				weight={700}
				color="var(--gt-you)"
				halo={false}
				tabular
			/>
			<Label
				x={c.x + W - 14}
				y={r.y + H - 14}
				text="them {theirs}"
				size={13}
				anchor="end"
				color="var(--gt-them)"
				halo={false}
				tabular
			/>
		{/each}
	{/each}

	<!-- better reply in each column -->
	{#each replies as c, i (c.them)}
		{@const o = i === 0 ? show1 : show2}
		{#if c.gain > 0}
			{@const down = c.best === 'D'}
			{@const x = c.x + 122}
			<g opacity={o}>
				<line
					x1={x}
					x2={x}
					y1={down ? 214 : 346}
					y2={down ? 318 : 214}
					stroke="var(--gt-you)"
					stroke-width="3"
					marker-end="url(#arrowhead)"
				/>
				<Label
					x={x + 10}
					y={270}
					text="+{c.gain}"
					size={14}
					weight={700}
					anchor="start"
					color="var(--gt-you)"
					pill
				/>
			</g>
		{/if}
	{/each}

	<!-- where both end up, and what both miss -->
	{#if end}
		<rect
			x={end.x - 5}
			y={end.y - 5}
			width={W + 10}
			height={H + 10}
			rx="13"
			fill="none"
			stroke="var(--gt-cheat)"
			stroke-width="3"
			opacity={show3}
		/>
	{/if}
	{#if dilemma}
		<rect
			x={both.x - 5}
			y={both.y - 5}
			width={W + 10}
			height={H + 10}
			rx="13"
			fill="none"
			stroke="var(--gt-coop)"
			stroke-width="2.5"
			stroke-dasharray="7 5"
			opacity={show3}
		/>
	{/if}
	<g opacity={show3}>
		{#if end}
			<rect
				x={250}
				y={444}
				width="26"
				height="16"
				rx="4"
				fill="none"
				stroke="var(--gt-cheat)"
				stroke-width="3"
			/>
			<Label x={284} y={457} text="where both players end up" size={12} anchor="start" />
		{/if}
		{#if dilemma}
			<rect
				x={490}
				y={444}
				width="26"
				height="16"
				rx="4"
				fill="none"
				stroke="var(--gt-coop)"
				stroke-width="2.5"
				stroke-dasharray="5 4"
			/>
			<Label x={524} y={457} text="better for both" size={12} anchor="start" />
		{/if}
	</g>

	<!-- conditions -->
	<g transform="translate(720 120)">
		<rect width="220" height="310" rx="10" fill="var(--surface)" stroke="var(--border)" />
		<Label
			x={16}
			y={30}
			text="Is it a dilemma?"
			size={14}
			weight={600}
			anchor="start"
			halo={false}
		/>
		{#each checks as c, i (i)}
			<Label
				x={16}
				y={64 + i * 30}
				text="{c.ok ? '✓' : '✗'} {c.text}"
				size={13}
				anchor="start"
				color={c.ok ? 'var(--stage-ink)' : 'var(--gt-cheat)'}
				halo={false}
				tabular
			/>
		{/each}
		<Readout id="verdict" order={2} label="Verdict" value={verdict}>
			<Label
				x={16}
				y={170}
				text={dilemma ? '→ a prisoner’s dilemma' : '→ not a dilemma'}
				size={14}
				weight={700}
				anchor="start"
				color={dilemma ? 'var(--stage-ink)' : 'var(--gt-cheat)'}
				halo={false}
			/>
		</Readout>
		<line x1="16" x2="204" y1="196" y2="196" stroke="var(--border)" />
		<Label x={16} y={222} text="For repeated games:" size={12} anchor="start" muted halo={false} />
		<Readout
			id="repeat"
			order={3}
			label="Repeated games"
			value="2 × {p.R} {repeatSign} {p.T} + {p.S}"
			note={repeatNote.join(' ')}
		>
			<Label
				x={16}
				y={248}
				text="{repeatOk ? '✓' : '✗'} 2 × reward {2 * p.R} {repeatSign} {p.T} + {p.S}"
				size={13}
				anchor="start"
				color={repeatOk ? 'var(--stage-ink)' : 'var(--gt-cheat)'}
				halo={false}
				tabular
			/>
			<Label x={16} y={272} text={repeatNote[0]} size={11} anchor="start" muted halo={false} />
			<Label x={16} y={288} text={repeatNote[1]} size={11} anchor="start" muted halo={false} />
		</Readout>
	</g>

	<Readout id="caption" order={4} label="So" value={caption.join(' ')}>
		<g opacity={Math.max(show3, 0)}>
			<Label x={24} y={512} text={caption[0]} size={14} anchor="start" />
			<Label x={24} y={536} text={caption[1]} size={14} anchor="start" weight={600} />
		</g>
	</Readout>
</g>
