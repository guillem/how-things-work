<script lang="ts">
	/**
	 * The three doors. Depending on the step: a game the reader plays by clicking doors; two piles
	 * of cars won by an always-stay and an always-switch player; the three places the car could be;
	 * ten doors; a host who opens a door at random; and the summing-up picture. Every game is
	 * played by the model with a seeded generator.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import { cases, play, playMany, rng, tally, type Game } from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'play'));
	// On a phone the captions move to the panel under the stage: draw the doors and bars bigger.
	const readouts = useReadouts();
	const narrow = $derived(readouts?.out ?? false);
	const markSize = $derived(narrow ? 22 : 13);

	const CAR = '🚗';
	const GOAT = '🐐';
	const of = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
	const cars = (won: number, games: number) =>
		`${of(won, 'car', 'cars')} in ${of(games, 'game', 'games')}`;

	// ---- a game by hand -----------------------------------------------------------------------------
	let gameNo = $state(0);
	let pick = $state<number | null>(null);
	let final = $state<number | null>(null);
	let record = $state({ stayN: 0, stayWon: 0, switchN: 0, switchWon: 0 });
	const newGame = $derived(Number(params.newgame ?? 0));
	$effect(() => {
		void newGame;
		untrack(() => {
			gameNo++;
			pick = null;
			final = null;
		});
	});
	const prize = $derived(Math.floor(rng(1000 + gameNo)() * 3));
	const hand = $derived<Game | null>(
		pick === null ? null : play(rng(2000 + gameNo), { prize, pick })
	);
	function choose(i: number) {
		if (pick === null) {
			pick = i;
			return;
		}
		if (final !== null) {
			gameNo++;
			pick = null;
			final = null;
			return;
		}
		if (!hand || hand.opened.includes(i)) return;
		final = i;
		const won = i === prize;
		if (i === pick)
			record = { ...record, stayN: record.stayN + 1, stayWon: record.stayWon + Number(won) };
		else
			record = {
				...record,
				switchN: record.switchN + 1,
				switchWon: record.switchWon + Number(won)
			};
	}
	const message = $derived.by(() => {
		if (pick === null) return 'Pick a door';
		if (!hand) return '';
		const h = hand.opened[0] + 1;
		if (final === null)
			return `The host opens door ${h}: a goat! Stay with door ${pick + 1} or switch to door ${hand.other + 1}?`;
		const what = final === pick ? 'You stayed' : 'You switched';
		return `${what} and won ${final === prize ? 'the car!' : 'a goat.'} Click a door to play again.`;
	});

	// ---- door drawing helpers ------------------------------------------------------------------------
	interface DoorView {
		key: string;
		i: number;
		x: number;
		y: number;
		w: number;
		h: number;
		open: boolean;
		content: string;
		picked: boolean;
		mark?: string;
		markColor?: string;
		faint?: boolean;
		clickable?: boolean;
	}

	// ---- the hand game's doors ----------------------------------------------------------------------
	const PLAY_X = $derived(narrow ? [105, 375, 645] : [70, 250, 430]);
	const playDoors = $derived<DoorView[]>(
		[0, 1, 2].map((i) => {
			const opened = hand?.opened.includes(i) ?? false;
			const revealed = final !== null;
			return {
				key: `p${i}`,
				i,
				x: PLAY_X[i],
				y: narrow ? 100 : 150,
				w: narrow ? 210 : 150,
				h: narrow ? 360 : 250,
				open: opened || revealed,
				content: i === prize ? CAR : GOAT,
				picked: (final ?? pick) === i,
				mark:
					final !== null && final === i
						? 'your door'
						: final === null && pick === i
							? 'your pick'
							: undefined,
				markColor: 'var(--mh-pick)',
				clickable: true
			};
		})
	);

	// ---- many games ---------------------------------------------------------------------------------
	const STAY_GAMES = playMany(300, 11);
	const SWITCH_GAMES = playMany(300, 12);
	const nGames = $derived(
		Math.max(1, Math.min(300, Math.round(Number(params.games ?? 100)) || 100))
	);
	const stayWon = $derived(STAY_GAMES.slice(0, nGames).filter((g) => g.stayWins).length);
	const switchWon = $derived(SWITCH_GAMES.slice(0, nGames).filter((g) => g.switchWins).length);
	const PER_ROW = 15;
	const DOT = 18;
	const pile = (n: number, x0: number) =>
		Array.from({ length: n }, (_, k) => ({
			k,
			x: x0 + (k % PER_ROW) * DOT + DOT / 2,
			y: 520 - Math.floor(k / PER_ROW) * DOT - DOT / 2
		}));
	const stayPile = $derived(pile(stayWon, 120));
	const switchPile = $derived(pile(switchWon, 560));

	// ---- three places the car could be ----------------------------------------------------------------
	const first = $derived(Number(params.first ?? 0));
	const rows = $derived(cases(first));
	const ROW_Y = [104, 260, 416];
	const CASE_X = $derived(narrow ? [255, 410, 565] : [170, 270, 370]);
	const caseDoors = $derived<DoorView[]>(
		rows.flatMap((g, r) =>
			[0, 1, 2].map((i) => ({
				key: `c${r}-${i}`,
				i,
				x: CASE_X[i],
				y: ROW_Y[r],
				w: narrow ? 140 : 80,
				h: 120,
				open: true,
				content: i === g.prize ? CAR : GOAT,
				picked: i === g.pick,
				faint: !g.opened.includes(i) && i !== g.pick && i !== g.other,
				mark: g.opened.includes(i) ? 'host opens' : undefined,
				markColor: 'var(--stage-ink-muted)'
			}))
		)
	);

	// ---- many doors -----------------------------------------------------------------------------------
	const nDoors = $derived(Number(params.doors ?? 10));
	const sample = $derived(play(rng(77 + nDoors), { doors: nDoors, pick: 0 }));
	const manyW = $derived(Math.min(110, 820 / nDoors - 10));
	const manyDoors = $derived<DoorView[]>(
		Array.from({ length: nDoors }, (_, i) => ({
			key: `m${i}`,
			i,
			x: 480 - (nDoors * (manyW + 10) - 10) / 2 + i * (manyW + 10),
			y: 110,
			w: manyW,
			h: 170,
			open: sample.opened.includes(i),
			content: i === sample.prize ? CAR : GOAT,
			picked: i === 0,
			mark: i === 0 ? 'your pick' : i === sample.other ? 'left closed' : undefined,
			markColor: i === 0 ? 'var(--mh-pick)' : 'var(--mh-switch)'
		}))
	);
	const manyTally = $derived(tally(playMany(300, 500 + nDoors, { doors: nDoors })));

	// ---- the host who doesn't know ----------------------------------------------------------------------
	const hostKnows = $derived(params.knows !== false);
	const randTally = $derived(tally(playMany(300, 900, { hostKnows })));

	// ---- bars for tallies --------------------------------------------------------------------------------
	const BAR_X = $derived(narrow ? 80 : 330);
	const BAR_W = $derived(narrow ? 720 : 520);
	const BAR_H = $derived(narrow ? 56 : 30);
	const BAR_GAP = $derived(narrow ? 90 : 60);
	const barsMany = $derived([
		{ id: 'stay', label: 'Always stay', n: manyTally.stayWins, of: 300, color: 'var(--mh-stay)' },
		{
			id: 'switch',
			label: 'Always switch',
			n: manyTally.switchWins,
			of: 300,
			color: 'var(--mh-switch)'
		}
	]);
	const barsRandom = $derived([
		{ id: 'stay', label: 'Staying won', n: randTally.stayWins, of: 300, color: 'var(--mh-stay)' },
		{
			id: 'switch',
			label: 'Switching won',
			n: randTally.switchWins,
			of: 300,
			color: 'var(--mh-switch)'
		},
		{
			id: 'spoiled',
			label: 'Host showed the car',
			n: randTally.spoiled,
			of: 300,
			color: 'var(--mh-spoil)'
		}
	]);
	const bars = $derived(phase === 'ten' ? barsMany : phase === 'random' ? barsRandom : []);
	const barY0 = $derived(narrow ? (phase === 'ten' ? 360 : 200) : phase === 'ten' ? 380 : 330);

	// ---- the summing-up picture ---------------------------------------------------------------------------
	const clueDoors: DoorView[] = [0, 1, 2].map((i) => ({
		key: `q${i}`,
		i,
		x: 165 + i * 230,
		y: 170,
		w: 170,
		h: 260,
		open: i === 2,
		content: GOAT,
		picked: i === 0,
		mark: i === 0 ? 'your pick' : i === 2 ? 'host opens' : 'left closed',
		markColor: i === 0 ? 'var(--mh-pick)' : i === 1 ? 'var(--mh-switch)' : 'var(--stage-ink-muted)'
	}));

	const shown = $derived(
		phase === 'play'
			? playDoors
			: phase === 'cases'
				? caseDoors
				: phase === 'ten'
					? manyDoors
					: phase === 'clue'
						? clueDoors
						: []
	);
	const fontFor = (d: DoorView) => Math.min(d.w * 0.55, 64);
</script>

{#snippet door(d: DoorView)}
	<g opacity={d.faint ? 0.5 : 1}>
		{#if d.open}
			<rect
				x={d.x}
				y={d.y}
				width={d.w}
				height={d.h}
				rx="8"
				fill="var(--mh-inside)"
				stroke="var(--mh-door-edge)"
				stroke-width="2"
			/>
			<text x={d.x + d.w / 2} y={d.y + d.h * 0.62} text-anchor="middle" font-size={fontFor(d)}
				>{d.content}</text
			>
		{:else}
			<rect
				x={d.x}
				y={d.y}
				width={d.w}
				height={d.h}
				rx="8"
				fill="var(--mh-door)"
				stroke="var(--mh-door-edge)"
				stroke-width="2"
			/>
			<rect
				x={d.x + d.w * 0.14}
				y={d.y + d.h * 0.1}
				width={d.w * 0.72}
				height={d.h * 0.34}
				rx="4"
				fill="none"
				stroke="var(--mh-door-edge)"
				opacity="0.6"
			/>
			<rect
				x={d.x + d.w * 0.14}
				y={d.y + d.h * 0.52}
				width={d.w * 0.72}
				height={d.h * 0.38}
				rx="4"
				fill="none"
				stroke="var(--mh-door-edge)"
				opacity="0.6"
			/>
			<circle
				cx={d.x + d.w * 0.84}
				cy={d.y + d.h * 0.5}
				r={Math.max(3, d.w * 0.04)}
				fill="var(--mh-knob)"
			/>
			<text
				x={d.x + d.w / 2}
				y={d.y + d.h * 0.33}
				text-anchor="middle"
				font-size={Math.min(d.w * 0.4, 44)}
				font-weight="700"
				fill="#ffffff">{d.i + 1}</text
			>
		{/if}
		{#if d.picked}
			<rect
				x={d.x - 5}
				y={d.y - 5}
				width={d.w + 10}
				height={d.h + 10}
				rx="11"
				fill="none"
				stroke="var(--mh-pick)"
				stroke-width="4"
			/>
		{/if}
		{#if d.mark}
			<Label
				x={d.x + d.w / 2}
				y={d.y + d.h + (narrow ? 26 : 22)}
				text={d.mark}
				size={markSize}
				weight={600}
				color={d.markColor}
			/>
		{/if}
	</g>
{/snippet}

<g class="mh">
	{#if phase === 'play'}
		<Readout id="mh-msg" order={1} label="Game" value={message}>
			<Label x={320} y={100} text={message} size={16} weight={600} />
		</Readout>
		{#each playDoors as d (d.key)}
			<g
				role="button"
				tabindex="0"
				aria-label="Door {d.i + 1}"
				style:cursor="pointer"
				onclick={() => choose(d.i)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						choose(d.i);
					}
				}}
			>
				{@render door(d)}
			</g>
		{/each}
		<Readout id="mh-box">
			<rect
				x="660"
				y="170"
				width="270"
				height="200"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label x={680} y={202} text="Your games" anchor="start" size={15} weight={700} halo={false} />
		</Readout>
		<Readout id="mh-stayed" order={2} label="Stayed" value={cars(record.stayWon, record.stayN)}>
			<Label
				x={680}
				y={240}
				text="Stayed"
				anchor="start"
				size={14}
				weight={600}
				color="var(--mh-stay)"
				halo={false}
			/>
			<Label
				x={680}
				y={262}
				text={cars(record.stayWon, record.stayN)}
				anchor="start"
				size={14}
				halo={false}
			/>
		</Readout>
		<Readout
			id="mh-switched"
			order={3}
			label="Switched"
			value={cars(record.switchWon, record.switchN)}
		>
			<Label
				x={680}
				y={302}
				text="Switched"
				anchor="start"
				size={14}
				weight={600}
				color="var(--mh-switch)"
				halo={false}
			/>
			<Label
				x={680}
				y={324}
				text={cars(record.switchWon, record.switchN)}
				anchor="start"
				size={14}
				halo={false}
			/>
		</Readout>
	{:else if phase === 'tally'}
		<line x1="80" y1="522" x2="880" y2="522" stroke="var(--stage-line)" stroke-width="2" />
		{#each stayPile as p (p.k)}
			<circle cx={p.x} cy={p.y} r="7.5" fill="var(--mh-stay)" />
		{/each}
		{#each switchPile as p (p.k)}
			<circle cx={p.x} cy={p.y} r="7.5" fill="var(--mh-switch)" />
		{/each}
		<Readout
			id="mh-stay"
			order={1}
			label="Always stay"
			value={cars(stayWon, nGames)}
			color="var(--mh-stay)"
		>
			<Label x={255} y={70} text="Always stay" size={18} weight={700} color="var(--mh-stay)" />
			<Label x={255} y={96} text={cars(stayWon, nGames)} size={15} />
		</Readout>
		<Readout
			id="mh-switch"
			order={2}
			label="Always switch"
			value={cars(switchWon, nGames)}
			color="var(--mh-switch)"
		>
			<Label x={695} y={70} text="Always switch" size={18} weight={700} color="var(--mh-switch)" />
			<Label x={695} y={96} text={cars(switchWon, nGames)} size={15} />
		</Readout>
		<Readout id="mh-dot" order={3} label="Each dot" value="one car won">
			<Label x={480} y={556} text="each dot is one car won" size={13} muted />
		</Readout>
	{:else if phase === 'cases'}
		{#each rows as g, r (r)}
			<Readout
				id="mh-row{r}"
				order={1 + r}
				label={`Car behind door ${g.prize + 1}`}
				value={`stay ${g.stayWins ? 'wins' : 'loses'}, switch ${g.switchWins ? 'wins' : 'loses'}`}
			>
				<Label
					x={150}
					y={ROW_Y[r] + 66}
					text={`Car behind door ${g.prize + 1}`}
					anchor="end"
					size={14}
					weight={600}
				/>
				<Label
					x={510}
					y={ROW_Y[r] + 52}
					text={g.stayWins ? 'Stay: you win the car' : 'Stay: you get a goat'}
					anchor="start"
					size={15}
					weight={600}
					color={g.stayWins ? 'var(--mh-win)' : 'var(--mh-lose)'}
				/>
				<Label
					x={510}
					y={ROW_Y[r] + 80}
					text={g.switchWins
						? `Switch to door ${g.other + 1}: you win the car`
						: `Switch to door ${g.other + 1}: you get a goat`}
					anchor="start"
					size={15}
					weight={600}
					color={g.switchWins ? 'var(--mh-win)' : 'var(--mh-lose)'}
				/>
			</Readout>
		{/each}
		{#each caseDoors as d (d.key)}
			{@render door(d)}
		{/each}
		<Label
			x={CASE_X[first] + (narrow ? 70 : 40)}
			y={ROW_Y[0] - 16}
			text="your pick"
			size={markSize}
			weight={600}
			color="var(--mh-pick)"
		/>
		<Readout id="mh-count" order={4} label="Count" value="stay wins 1 row, switch wins 2">
			<Label x={480} y={584} text="Staying wins in 1 row, switching in 2" size={15} weight={700} />
		</Readout>
	{:else if phase === 'ten' || phase === 'clue'}
		{#each shown as d (d.key)}
			{@render door(d)}
		{/each}
		{#if phase === 'clue'}
			<Label
				x={250}
				y={140}
				text="wins 1 time in 3"
				size={narrow ? 26 : 16}
				weight={700}
				color="var(--mh-stay)"
			/>
			<Label
				x={480}
				y={140}
				text="wins 2 times in 3"
				size={narrow ? 26 : 16}
				weight={700}
				color="var(--mh-switch)"
			/>
		{:else}
			<Readout
				id="mh-doors"
				order={1}
				label="Doors"
				value={`${nDoors}: the host opens ${nDoors - 2}`}
			>
				<Label
					x={480}
					y={80}
					text={`${nDoors} doors: you pick one, the host opens ${of(nDoors - 2, 'goat door', 'goat doors')}`}
					size={16}
					weight={600}
				/>
			</Readout>
		{/if}
	{/if}

	{#if bars.length}
		{#if phase === 'random'}
			<Readout
				id="mh-host"
				order={1}
				label="Host"
				value={hostKnows ? 'knows where the car is' : 'opens a door at random'}
			>
				<Label
					x={480}
					y={110}
					text={hostKnows ? 'The host knows where the car is' : 'The host opens a door at random'}
					size={18}
					weight={700}
				/>
			</Readout>
			<Readout id="mh-games" order={6} label="Games" value="300, you pick a door at random">
				<Label x={480} y={140} text="300 games, you pick a door at random" size={14} muted />
			</Readout>
			{#if !hostKnows}
				<Readout
					id="mh-even"
					order={5}
					label="When a goat was shown"
					value={`stay ${randTally.stayWins}, switch ${randTally.switchWins}: about even`}
				>
					<Label
						x={480}
						y={250}
						text={`In the ${300 - randTally.spoiled} games with a goat shown: about even`}
						size={15}
						weight={600}
					/>
				</Readout>
			{:else}
				<Readout id="mh-even" order={5} label="Result" value="switching wins about twice as often">
					<Label
						x={480}
						y={250}
						text="Switching wins about twice as often"
						size={15}
						weight={600}
					/>
				</Readout>
			{/if}
		{/if}
		<Readout id="mh-outof">
			<Label x={BAR_X} y={barY0 - 30} text="out of 300 games" anchor="start" size={13} muted />
		</Readout>
		{#each bars as b, k (b.id)}
			{@const y = barY0 + k * BAR_GAP}
			<Readout id="mh-barlabel-{b.id}">
				<Label
					x={BAR_X - 14}
					y={y + 20}
					text={b.label}
					anchor="end"
					size={15}
					weight={600}
					color={b.color}
				/>
			</Readout>
			<rect x={BAR_X} {y} width={BAR_W} height={BAR_H} rx="4" fill="var(--stage-grid)" />
			<rect x={BAR_X} {y} width={(BAR_W * b.n) / b.of} height={BAR_H} rx="4" fill={b.color} />
			<Readout
				id="mh-bar-{b.id}"
				order={2 + k}
				label={b.label}
				value={`${b.n} of ${b.of}`}
				color={b.color}
			>
				<Label
					x={BAR_X + (BAR_W * b.n) / b.of + 10}
					y={y + BAR_H * 0.67}
					text={String(b.n)}
					anchor="start"
					size={15}
					weight={700}
				/>
			</Readout>
		{/each}
	{/if}
</g>
