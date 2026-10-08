import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Moves per second for each notch of the speed slider. */
export const PACES = [3, 10, 30, 100, 400];

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Speed',
	min: 1,
	max: 5,
	step: 1,
	default: 2,
	format: (v) => `${PACES[Math.round(v) - 1] ?? PACES[1]} moves per second`
};

/** The same speed control, starting faster, for steps about where learning ends up. */
const speedFast: Control = { ...speed, id: 'speedFast', default: 4 };

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Run by itself',
	default: true,
	help: 'Turn off, then drag the episode bar (or use its arrow keys) to go back and forth.'
};

const alpha: Control = {
	type: 'range',
	id: 'alpha',
	label: 'Learning rate α',
	min: 0,
	max: 1,
	step: 0.05,
	default: 0.5,
	format: (v) => v.toFixed(2),
	help: 'How far each estimate moves towards what the agent just saw. Changing it starts a new run.'
};

const gamma: Control = {
	type: 'range',
	id: 'gamma',
	label: 'Discount factor γ',
	min: 0,
	max: 0.99,
	step: 0.01,
	default: 0.9,
	format: (v) => v.toFixed(2),
	help: 'What a reward one move later is worth now. Changing it starts a new run.'
};

const epsilon: Control = {
	type: 'range',
	id: 'epsilon',
	label: 'Exploration rate ε',
	min: 0,
	max: 1,
	step: 0.05,
	default: 0.1,
	format: (v) => `${Math.round(v * 100)}% random moves`,
	help: 'The chance that a move is random instead of the best-looking one. Changing it starts a new run.'
};

const decay: Control = {
	type: 'toggle',
	id: 'decay',
	label: 'Explore less as it learns',
	default: false,
	help: 'Lower the exploration rate steadily, from its setting in the first episode to 0 in the last.'
};

const brush: Control = {
	type: 'select',
	id: 'brush',
	label: 'Paint',
	default: 'wall',
	options: [
		{ value: 'wall', label: 'Walls' },
		{ value: 'reward', label: 'Reward +10' },
		{ value: 'small', label: 'Small reward +1' },
		{ value: 'penalty', label: 'Pit −10' },
		{ value: 'floor', label: 'Clear' }
	],
	help: 'Click or drag on the grid to paint (the agent starts again from scratch); drag S to move the start.'
};

const resetMap: Control = {
	type: 'action',
	id: 'resetMap',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to this step’s map.'
};

const restart: Control = {
	type: 'action',
	id: 'restart',
	label: 'New run',
	action: 'New run',
	help: 'A fresh agent with different luck: same settings, other random moves.'
};

export const spec: ExplainerSpec = {
	slug: 'reinforcement-learning',
	title: 'How a machine learns by trial and error',
	summary:
		'Release an agent into a grid world of rewards, pits and walls, and watch it learn — from rewards alone — which move is worth making in every square.',
	chapters: [
		{ id: 'learn', title: 'Learning from rewards' },
		{ id: 'balance', title: 'Exploring and exploiting' },
		{ id: 'yours', title: 'Your own world' }
	],
	steps: [
		// ------------------------------------------------------------------ learn
		{
			id: 'world',
			chapter: 'learn',
			title: 'A world of rewards',
			scene: 'grid',
			hints: { phase: 'world', map: 'maze' },
			duration: 24,
			controls: [speed, play, brush, resetMap],
			body: `
<p>When a machine learns from examples, someone hands the computer the right answers. Often nobody knows them. How do you teach a robot to walk, or a program to play a game? You let it try, and tell it only how well things went.</p>
<p>Here is the smallest version of that. An <dfn data-def="The learner: something that observes where it is, chooses an action, and receives a reward.">agent</dfn> lives on a grid. In every square it can move up, down, left or right. Stepping onto the green square pays a <dfn data-def="A number the world hands the agent after an action: positive for good outcomes, negative for bad ones. It is all the agent is told.">reward</dfn> of +10; falling into a red pit costs −10. Either way the <dfn data-def="One attempt, from the start square until the agent reaches a reward or a pit (or runs out of moves).">episode</dfn> ends and it starts again from S.</p>
<p>Nobody tells it where the reward is, or even that walls exist. In its first episode it knows nothing, so every move is a guess: it wanders, bumps into walls, and often ends up in a pit.</p>`,
			notes: `<p>The agent knows which square it is in and what it was paid, nothing else. Its moves always go where it intends (a model of a slippery floor or a gusty wind would make them random), and it may make up to 400 moves before an episode is cut off.</p>`
		},
		{
			id: 'credit',
			chapter: 'learn',
			title: 'Giving credit backwards',
			scene: 'grid',
			hints: { phase: 'credit', map: 'maze' },
			duration: 28,
			controls: [alpha, speed, play],
			body: `
<p>The agent keeps a table with one number for every square and every move: its estimate of how much reward that move will lead to. All start at 0. The four triangles in each square show them — greener for higher, redder for lower.</p>
<p>When a move pays a reward, the agent nudges that move's estimate towards it. With a <dfn data-def="How far an estimate moves towards new evidence after each try, from 0 (never changes) to 1 (jumps all the way).">learning rate</dfn> of 0.5 it goes halfway: the first time it steps onto the +10, the last move's estimate goes from 0 to 5.</p>
<p>The trick is what happens next time. A move that leads into a square with a good estimate is itself credited, as if the square paid out: 0.5 × (0.9 × 5) = 2.25. Episode after episode, credit seeps backwards from the reward, one square at a time, until it reaches the start.</p>`,
			notes: `<p>This is <dfn data-def="A reinforcement-learning method that learns the value of each action in each situation from its own experience, introduced by Chris Watkins in 1989.">Q-learning</dfn> (Chris Watkins, 1989). After each move from square s with move a, paying r and landing in s′: Q(s, a) ← Q(s, a) + α · (r + γ · max Q(s′, ·) − Q(s, a)), where α is the learning rate and γ the discount factor of the next step. The card on the right does this sum for the latest move. With a learning rate of 1 an estimate jumps straight to the new value — fine in this world, where moves always do the same thing; when rewards are noisy, a small rate averages over many tries.</p>`
		},
		{
			id: 'discount',
			chapter: 'learn',
			title: 'A reward now is worth more',
			scene: 'grid',
			hints: { phase: 'values', map: 'maze' },
			duration: 28,
			controls: [gamma, speedFast, play],
			body: `
<p>Each time credit passes back a square it is multiplied by the <dfn data-def="A number between 0 and 1 by which a reward is multiplied for each move it lies in the future.">discount factor</dfn>, here 0.9. So the numbers — the best estimate in each square — fall away with the distance from the reward: 10 right next to it, 9 one square further, then 8.1, and so on.</p>
<p>That is why the agent learns the <em>shortest</em> route, not just any route: the same +10 is worth more the sooner it comes. The fastest way from S takes 13 moves, so S ends up worth 10 × 0.9¹² ≈ 2.82. The arrows, each square's best move, then form a path from S to the reward.</p>
<p>Lower the discount and the agent becomes short-sighted: at 0.5, the same +10 seen from S is worth 10 × 0.5¹² ≈ 0.002 — next to nothing.</p>`,
			notes: `<p>The values the learning settles to are the solution of the <dfn data-def="The condition that the value of a move equals its reward plus the discounted value of the best move from where it leads.">Bellman equation</dfn>, Q(s, a) = r + γ · max Q(s′, ·), which can also be solved directly when the rules of the world are known (by “value iteration”). The tests behind this page check that the agent's numbers converge to that exact solution, as Chris Watkins and Peter Dayan proved they do (1992), provided every move keeps being tried and the learning rate is lowered suitably over time.</p>`
		},
		// ------------------------------------------------------------------ balance
		{
			id: 'explore',
			chapter: 'balance',
			title: 'Explore or exploit?',
			scene: 'grid',
			hints: { phase: 'explore', map: 'choice' },
			duration: 32,
			controls: [epsilon, decay, restart, speedFast, play],
			body: `
<p>A new world: a small reward of +1 four moves to the left, and a +10 eight moves away. With a discount of 0.9 the +10 is clearly better (worth 4.8 at S, against 0.73) — but only if the agent ever finds it.</p>
<p>An agent that always makes its best-looking move <dfn data-def="Using what you already know to collect reward now, rather than trying something new.">exploits</dfn>. Once it has found the +1 that move looks best, so it goes there every time and never learns about the +10. With few random moves (0 to 10%) that happens in most runs. To <dfn data-def="Trying moves that do not look best, to find out whether they are better than expected.">explore</dfn>, it makes a random move now and then: at 70% it finds the +10 in almost every run.</p>
<p>But exploring has a cost. An agent that only explores (100%) learns the right route and then never follows it, collecting less than 5 per episode. The usual answer: start curious and settle down — turn on “Explore less as it learns” at 100% and, by the end, it takes the +10 every time.</p>`,
			notes: `<p>Counts from 30 runs of 300 episodes each (“New run” shows other runs): with 0% or 10% random moves the +10 was found in at most 6; with 70% in 28; with 100% in all 30, but the last 50 episodes paid about 4 on average. Lowering the rate from 100% to 0 paid exactly 10 in every one of the last 50 episodes of all 30 runs. Even in the maze, with 10% random moves, about one run in ten settles on a 15-move route instead of the 13-move one.</p>`
		},
		{
			id: 'progress',
			chapter: 'balance',
			title: 'Early episodes and late ones',
			scene: 'curve',
			hints: { map: 'maze' },
			duration: 26,
			controls: [epsilon, restart],
			body: `
<p>Back to the maze. Plot how many moves each episode took and the learning is plain to see. The first episode usually takes well over a hundred moves, and about a third of the first twenty end in a pit. After some fifty episodes the agent needs about 15.</p>
<p>It never settles at exactly 13, the shortest possible, because one move in ten is still random — sometimes into a pit. Drag the two handles under the chart to pick an early and a late episode and replay them side by side.</p>`
		},
		// ------------------------------------------------------------------ yours
		{
			id: 'paint',
			chapter: 'yours',
			title: 'Your own world',
			scene: 'grid',
			hints: { phase: 'paint', map: 'open' },
			duration: 40,
			controls: [brush, resetMap, epsilon, decay, gamma, alpha, speedFast, play, restart],
			body: `
<p>Now build a world. Paint walls, rewards and pits, drag S, and release a fresh agent. Hide the reward behind a wall of pits, give it two rewards to choose between, or wall it off completely and watch the agent learn that nothing is worth anything. In an open field it often settles for a route a couple of moves longer than the shortest: good enough, as far as it knows. More exploration — try “Explore less as it learns” from 100% — usually finds the best one.</p>
<p><strong>An agent can learn a skill from rewards alone: by trying moves and gradually crediting the ones that led to good outcomes, it builds up a map of what each move is worth — as long as it balances exploring the unknown against using what it already knows.</strong></p>`,
			notes: `<p>The same idea, with a neural network in place of the table so that similar situations share what was learnt, learned to play backgammon close to the level of the best human players (TD-Gammon, early 1990s) and dozens of Atari video games from the screen pixels (DeepMind, 2015), and was part of AlphaGo, which in 2016 beat Lee Sedol, one of the world's strongest Go players. It is also used to fine-tune chatbots, with human ratings as the reward. A hard part in practice is choosing the reward: an agent pursues exactly what it is paid for, not what its designer meant.</p>`
		}
	]
};
