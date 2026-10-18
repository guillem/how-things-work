import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { STRATEGIES } from './model';

const payoffControl = (id: 'T' | 'R' | 'P' | 'S', label: string, value: number): Control => ({
	type: 'range',
	id,
	label,
	min: 0,
	max: 10,
	step: 1,
	default: value,
	format: (v) => `${v} points`
});

const payoffs: Control[] = [
	payoffControl('T', 'You cheat, they cooperate (temptation)', 5),
	payoffControl('R', 'Both cooperate (reward)', 3),
	payoffControl('P', 'Both cheat (punishment)', 1),
	payoffControl('S', 'You cooperate, they cheat (sucker)', 0)
];

const strategyOptions = STRATEGIES.map((s) => ({ value: s.id, label: s.name }));

const opponent: Control = {
	type: 'select',
	id: 'opponent',
	label: 'The page plays',
	default: 'tft',
	options: strategyOptions.filter((o) =>
		['tft', 'grim', 'alld', 'allc', 'random'].includes(o.value)
	)
};

const gameOver = (p: Record<string, unknown>) =>
	(typeof p.moves === 'string' ? p.moves : '').length >= 10;

const cooperate: Control = {
	type: 'action',
	id: 'coop',
	label: 'Your move',
	action: 'Cooperate',
	disabled: gameOver
};

const cheat: Control = {
	type: 'action',
	id: 'cheat',
	label: 'or',
	action: 'Cheat',
	disabled: gameOver
};

const again: Control = { type: 'action', id: 'again', label: 'New game', action: 'Play again' };

const matchA: Control = {
	type: 'select',
	id: 'matchA',
	label: 'Player 1',
	default: 'tft',
	options: strategyOptions
};

const matchB: Control = {
	type: 'select',
	id: 'matchB',
	label: 'Player 2',
	default: 'alld',
	options: strategyOptions
};

const ROUND_VALUES = [1, 2, 3, 5, 10, 20, 50, 100, 200];

const rounds: Control = {
	type: 'range',
	id: 'rounds',
	label: 'Rounds per game',
	min: 1,
	max: 200,
	step: 1,
	default: 200,
	values: () => ROUND_VALUES,
	format: (v) => `${v}`
};

const shortRounds: Control = { ...rounds, id: 'shortRounds', default: 3 };

const entrants: Control[] = STRATEGIES.map((s) => ({
	type: 'toggle',
	id: `in_${s.id}`,
	label: s.name,
	default: true
}));

const start: Control = {
	type: 'select',
	id: 'start',
	label: 'At the start',
	default: 'cheats',
	options: [
		{ value: 'cheats', label: '90 % always cheat' },
		{ value: 'equal', label: 'Equal shares' }
	]
};

const noise: Control = {
	type: 'range',
	id: 'noise',
	label: 'Mistakes',
	min: 0,
	max: 0.1,
	step: 0.01,
	default: 0.05,
	values: () => [0, 0.01, 0.02, 0.05, 0.1],
	format: (v) => `${Math.round(v * 100)} % of moves come out wrong`
};

const echoPair: Control = {
	type: 'select',
	id: 'echo',
	label: 'Both players',
	default: 'tft',
	options: [
		{ value: 'tft', label: 'Tit for tat' },
		{ value: 'gtft', label: 'Generous tit for tat' }
	]
};

/** Temptations at which the grid behaves differently (it only changes at a few thresholds). */
export const B_VALUES = [1.2, 1.5, 1.7, 1.85, 2.1, 2.5];

const temptation: Control = {
	type: 'range',
	id: 'b',
	label: 'Temptation b (cooperating pair: 1 each)',
	min: B_VALUES[0],
	max: B_VALUES[B_VALUES.length - 1],
	step: 0.01,
	default: 1.85,
	values: () => B_VALUES,
	format: (v) => `${v}`
};

/**
 * Scenes: `matrix` (the payoff table and the one-shot argument), `play` (ten rounds against the
 * page), `match` (two strategies' moves round by round; `focus` 'match' | 'echo'), `tournament`
 * (the round robin's table of scores and the ranking; `focus` 'all' | 'pick' | 'short'), `evolve`
 * (the shares of a population over generations; `focus` 'equal' | 'few' | 'noise') and `grid`
 * (Nowak & May's spatial game; `focus` 'random' | 'one').
 */
export const spec: ExplainerSpec = {
	slug: 'game-theory-cooperation',
	title: 'Game theory: why cooperate?',
	summary:
		"Play the prisoner's dilemma against the page, run Axelrod's tournament of strategies, let them evolve, add mistakes, and watch cooperators and cheats battle on a grid.",
	chapters: [
		{ id: 'once', title: 'One game' },
		{ id: 'again', title: 'Meeting again' },
		{ id: 'evolve', title: 'Evolution' },
		{ id: 'grid', title: 'Neighbours' }
	],
	steps: [
		// ----------------------------------------------------------------- once
		{
			id: 'dilemma',
			chapter: 'once',
			title: "The prisoner's dilemma",
			scene: 'matrix',
			duration: 26,
			controls: payoffs,
			body: `
<p>Two players each choose, without seeing the other's choice, to <strong>cooperate</strong> or to <strong>cheat</strong>. If both cooperate, each gets 3 points. If both cheat, each gets 1. If one cheats while the other cooperates, the cheat gets 5 and the cooperator gets nothing.</p>
<p>Put yourself in one player's place. If the other cooperates, cheating earns you 5 instead of 3. If the other cheats, cheating earns you 1 instead of 0. Whatever they do, cheating pays more: game theorists say cheating <dfn data-def="One choice dominates another when it pays more whatever the other player does.">dominates</dfn>. The other player reasons the same way, so both cheat and get 1 each, when both cooperating would have given each of them 3.</p>
<p>That is the <dfn data-def="A game in which each player does better by cheating, whatever the other does, yet both do worse cheating than cooperating.">prisoner's dilemma</dfn>. Change the four numbers: as long as temptation &gt; reward &gt; punishment &gt; sucker's payoff, the arrows still point to cheating.</p>`,
			notes: `<p>The game was devised by Merrill Flood and Melvin Dresher at the RAND Corporation in 1950, and Albert Tucker gave it its story: two prisoners questioned in separate rooms, each offered a lighter sentence for betraying the other. The same structure turns up wherever acting for the group costs each member something: two firms deciding whether to cut prices, countries deciding whether to cut emissions, animals deciding whether to groom each other.</p>`
		},
		{
			id: 'play',
			chapter: 'once',
			title: 'Play ten rounds against the page',
			scene: 'play',
			duration: 30,
			controls: [cooperate, cheat, again, opponent],
			body: `
<p>Now play the same game ten times against the same opponent, who remembers what you did. The page plays <strong>tit for tat</strong>: it cooperates in the first round, and after that it copies whatever you did in the round before.</p>
<p>Cheat once and you take 5 points from its 0. But next round it cheats back. Cheat every round and you score 5 + 9 × 1 = 14; cooperate every round and you score 10 × 3 = 30. Against a player who remembers, cheating pays once, then it costs.</p>
<p>Try the other opponents. Against <em>always cooperate</em>, cheating pays every round; against <em>grudger</em>, a single cheat is never forgiven.</p>`
		},
		// ---------------------------------------------------------------- again
		{
			id: 'strategies',
			chapter: 'again',
			title: 'Strategies that remember',
			scene: 'match',
			hints: { focus: 'match' },
			duration: 26,
			controls: [matchA, matchB],
			body: `
<p>A <strong>strategy</strong> is a rule for every round of a repeated game. Here are seven: tit for tat; <em>always cheat</em>; <em>always cooperate</em>; <em>grudger</em>, which cooperates until the other cheats once and then cheats for ever; <em>random</em>, which flips a coin; <em>tit for two tats</em>, which only hits back after two cheats in a row; and <em>generous tit for tat</em>, which forgives one cheat in three.</p>
<p>Pit two against each other for 40 rounds. Tit for tat against always cheat: tit for tat is exploited once, then both cheat. Always cheat ends 5 points ahead, but each scores only about 1 a round, while two tit for tats score 3 a round each.</p>
<p>Look at any game tit for tat plays: it <strong>never</strong> scores more than its opponent. It can only tie or lose by a little, because it never cheats first and never cheats more often than the other player.</p>`
		},
		{
			id: 'tournament',
			chapter: 'again',
			title: "Axelrod's tournament",
			scene: 'tournament',
			hints: { focus: 'all' },
			duration: 30,
			controls: [rounds, ...payoffs],
			body: `
<p>In 1980 the political scientist Robert Axelrod invited game theorists to send in strategies and played them against each other in a <dfn data-def="A tournament in which every entrant plays every other entrant (and here a copy of itself).">round robin</dfn> of 200-round games, with the payoffs 5, 3, 1 and 0. The simplest entry, Anatol Rapoport's tit for tat, scored the most. A second tournament, with 62 entries from people who knew the first result, ended the same way.</p>
<p>Here the seven strategies play one. The table shows each row's points per round against each column; the bars rank the total. Always cheat wins <em>every</em> game against another strategy and finishes last. Tit for tat wins none and finishes near the top: grudger edges past it only by punishing Random for ever. What mattered was scoring well against everyone, not beating anyone.</p>
<p>Axelrod's summary: be <strong>nice</strong> (never cheat first), <strong>retaliate</strong>, <strong>forgive</strong>, and be clear.</p>`,
			notes: `<p>The points are averages over 10 games per pairing, because Random and the generous strategy roll dice. Axelrod, <em>The Evolution of Cooperation</em> (1984), and Axelrod &amp; Hamilton, "The evolution of cooperation", <em>Science</em> 211 (1981). The real tournaments had 15 and 63 entrants (including Random) and many cleverer strategies; tit for tat won both, but later studies found winners change with the field, the payoffs and the length of the games.</p>`
		},
		{
			id: 'no-best',
			chapter: 'again',
			title: 'No strategy is best everywhere',
			scene: 'tournament',
			hints: { focus: 'pick' },
			duration: 30,
			controls: entrants,
			body: `
<p>Now choose who takes part. Remove Random and tit for tat ties with grudger for first place. Leave always cheat with always cooperate, Random and generous tit for tat, players that never or only sometimes punish it, and always cheat comes first: it feeds on them.</p>
<p>There is no strategy that is best whatever it meets. A score in a tournament is a score <em>against that field</em>. What Axelrod's results show is that nice strategies that retaliate do well in fields where many others do too, and that a strategy can win a tournament without beating a single opponent.</p>`
		},
		{
			id: 'short',
			chapter: 'again',
			title: 'When games are too short',
			scene: 'tournament',
			hints: { focus: 'short' },
			duration: 26,
			controls: [shortRounds],
			body: `
<p>Cooperation depends on meeting again: the next round has to be worth protecting. Shorten the games. With one round, the tournament is the one-shot game, and always cheat wins it. With two or three rounds it still wins: one early cheat earns more than the little cooperation that follows can repay.</p>
<p>Lengthen the games and the order reverses. At five rounds it only just leads; with ten or more it finishes last. The longer the <dfn data-def="Axelrod's phrase for how much the future matters to a player: the chance of meeting again, or how much later rounds count.">shadow of the future</dfn>, the better cooperation pays (the same idea as <a href="../reinforcement-learning/#discount">a reward now being worth more than one later</a>).</p>`,
			notes: `<p>If both players know exactly which round is the last, a cold argument says cheat in it, since there is no future to protect; then the round before is effectively the last, and so on back to the first (<dfn data-def="Reasoning from the end of a game back to its start.">backward induction</dfn>). People and simple strategies rarely follow it in long games, and Axelrod's second tournament made the length uncertain so that nobody could plan on an end. The strategies here don't count rounds: in short games, always cheat simply gains more from its first cheats than it loses later.</p>`
		},
		// --------------------------------------------------------------- evolve
		{
			id: 'evolve',
			chapter: 'evolve',
			title: 'Let the winners spread',
			scene: 'evolve',
			hints: { focus: 'equal' },
			duration: 26,
			body: `
<p>Now turn the tournament into <a href="../evolution/#generations">evolution</a>. Start a population with equal shares of the seven strategies. Each generation everyone plays everyone; then each strategy's share grows in proportion to the points its players scored: strategies that score above the population's average spread, those below shrink. Nobody plans anything; the copying does the work.</p>
<p>Always cheat scores the most against always cooperate and Random, but every strategy that hits back holds it to about 1 point a round, so it scores below average from the first generation and dies out, followed by Random. Once only nice strategies are left, they all cooperate and score 3 a round, and the shares stop changing: always cooperate survives too, because nobody is left to exploit it.</p>`,
			notes: `<p>Each generation's shares are the last shares times their average score, divided by the population's average score (discrete <dfn data-def="The rule that a strategy's share grows in proportion to how much better than average it scores.">replicator dynamics</dfn>), for a very large population. Games last 200 rounds with Axelrod's payoffs. Axelrod ran the same "ecological" experiment on his second tournament's entries and found tit for tat the most common after a thousand generations.</p>`
		},
		{
			id: 'few',
			chapter: 'evolve',
			title: 'Too few cooperators, too short games',
			scene: 'evolve',
			hints: { focus: 'few' },
			duration: 26,
			controls: [start, rounds],
			body: `
<p>Start instead with nine players in ten always cheating. In long games the few nice players still take over: each time they meet one another they earn 3 a round, while a cheat that meets one gains a single big round and then about 1 a round.</p>
<p>Now shorten the games to 10 rounds. The rare cooperators mostly meet cheats, lose the first round of each game, and the cheats keep the population. With equal shares at the start, the same short games would have let the cooperators win. Cooperation can take hold among players who look after only themselves, but only if the games are long enough and enough others cooperate.</p>`
		},
		{
			id: 'echo',
			chapter: 'evolve',
			title: 'A mistake starts a feud',
			scene: 'match',
			hints: { focus: 'echo' },
			duration: 26,
			controls: [echoPair, noise],
			body: `
<p>Real players make mistakes: a message gets lost, a hand slips. Let a few moves come out the opposite of what was meant. Two tit for tats then fall into a feud: one slips, the other punishes, the first punishes the punishment, and they take turns cheating until another slip ends or doubles it.</p>
<p>Switch both to <strong>generous tit for tat</strong>, which lets one cheat in three go unpunished. A slip still costs a round or two, but the feud dies out quickly.</p>`,
			notes: `<p>Generous tit for tat forgives a cheat with the probability that just stops always cheat from invading a population of it: one in three for Axelrod's payoffs (Nowak &amp; Sigmund, <em>Nature</em> 355, 1992). Points are shown for each round; a ring marks a move that came out wrong.</p>`
		},
		{
			id: 'noise',
			chapter: 'evolve',
			title: 'With mistakes, forgiveness pays',
			scene: 'evolve',
			hints: { focus: 'noise' },
			duration: 30,
			controls: [noise],
			body: `
<p>Run the evolution again with equal shares, 200-round games and mistakes. Grudger, which never forgives a single slip, now dies out. Tit for tat shrinks, losing points in feuds with its own kind; generous tit for tat and tit for two tats end up commoner than it.</p>
<p>And Random does not disappear: in a population that forgives, a player who cheats half the time is not punished enough. Forgiveness pays among players who mean well and costs among those who don't. The best strategy depends on the mistakes, the payoffs and who else is playing.</p>`
		},
		// ----------------------------------------------------------------- grid
		{
			id: 'grid',
			chapter: 'grid',
			title: 'Cooperators on a grid',
			scene: 'grid',
			hints: { focus: 'random' },
			duration: 30,
			controls: [temptation],
			body: `
<p>Take away memory altogether. In 1992 Martin Nowak and Robert May put players on a grid. Each cell either always cooperates or always cheats, and plays one game with each of its 8 neighbours and itself: a cooperator gets 1 point for each cooperator it meets, a cheat gets <em>b</em> for each cooperator it meets, and nobody gets anything from a cheat. Then every cell copies the strategy of whichever of the nine scored highest.</p>
<p>A cheat surrounded by cooperators does well, but a block of cooperators earns a lot from each other. Clusters of cooperators grow at their edges and are eaten at their edges. Blue cells stayed cooperators, red stayed cheats; green ones have just become cooperators and yellow ones cheats.</p>
<p>With <em>b</em> between 1.8 and 2, neither side wins: the grid churns for ever with about a third cooperators. Below 1.8 cooperators hold most of it; above 2, cheats take nearly all.</p>`,
			notes: `<p>Nowak &amp; May, "Evolutionary games and spatial chaos", <em>Nature</em> 359 (1992). Updates are simultaneous on a 59 × 59 grid that wraps round at the edges, starting with one cell in ten a cheat. Only a few thresholds of <em>b</em> change what happens (when one neighbourhood's score passes another's), so the slider steps between them. No memory, no repeated games with the same partner: here what protects cooperators is that they stay neighbours of one another, like <a href="../ecosystems/#web">species tied together in a food web</a>.</p>`
		},
		{
			id: 'kaleidoscope',
			chapter: 'grid',
			title: 'One cheat',
			scene: 'grid',
			hints: { focus: 'one' },
			duration: 40,
			controls: [temptation],
			body: `
<p>Start with a single cheat in the middle of a grid of cooperators. At <em>b</em> = 1.85 it does better than its neighbours, so they copy it; the block of cheats then has cooperators around it doing better, and they win back ground. The fight never settles: it draws an endless, symmetric kaleidoscope with about a third of the cells cooperating.</p>
<p>Lower <em>b</em> below 1.8 and the cheat's first converts stay a small block, boxed in for ever. Just above 2 the block grows into a square and stops; at 2.5 the cheats take nine cells in ten. Cooperation here needs no memory or kindness, only neighbours who cooperate too.</p>`
		}
	]
};
