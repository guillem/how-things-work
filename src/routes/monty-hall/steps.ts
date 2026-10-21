import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const newGame: Control = {
	type: 'action',
	id: 'newgame',
	label: 'Another game',
	action: 'New game'
};

const games: Control = {
	type: 'range',
	id: 'games',
	label: 'Games played with each plan',
	min: 0,
	max: 300,
	step: 10,
	default: 100,
	format: (v) => `${v} games`
};

const firstPick: Control = {
	type: 'select',
	id: 'first',
	label: 'Your first pick',
	default: '0',
	options: [
		{ value: '0', label: 'Door 1' },
		{ value: '1', label: 'Door 2' },
		{ value: '2', label: 'Door 3' }
	]
};

const doors: Control = {
	type: 'range',
	id: 'doors',
	label: 'Number of doors',
	min: 3,
	max: 10,
	step: 1,
	default: 10,
	format: (v) => `${v} doors`
};

const knows: Control = {
	type: 'toggle',
	id: 'knows',
	label: 'The host knows where the car is',
	default: true
};

export const spec: ExplainerSpec = {
	slug: 'monty-hall',
	title: 'The three doors',
	summary:
		'A car is behind one of three doors, goats behind the other two. You pick a door, the host opens another to show a goat, and you may switch. Should you? Play it, then let the page play hundreds of games, and find out why switching wins twice as often, and when it doesn’t.',
	chapters: [
		{ id: 'game', title: 'The game' },
		{ id: 'why', title: 'Why switching wins' }
	],
	steps: [
		// ------------------------------------------------------------------ game
		{
			id: 'play',
			chapter: 'game',
			title: 'Pick a door',
			scene: 'doors',
			hints: { phase: 'play' },
			duration: 30,
			controls: [newGame],
			body: `
<p>On a TV game show there are three closed doors. Behind one is a car; behind the other two, a goat each. You pick a door. Then the host, who knows where the car is, opens one of the other two doors and shows you a goat. Now he asks: do you want to stay with your door, or switch to the other closed one?</p>
<p>Click a door to pick it. After the host opens a door, click your door again to stay, or the other closed door to switch. Play a few games, sometimes staying and sometimes switching. Does it matter?</p>`
		},
		{
			id: 'tally',
			chapter: 'game',
			title: 'Hundreds of games',
			scene: 'doors',
			hints: { phase: 'tally' },
			duration: 22,
			controls: [games],
			body: `
<p>Most people feel that once a goat is shown, two doors are left, so it’s even: half and half. A few games by hand can’t settle it, so let the page play many games, picking at random each time. One player always stays. Another always switches.</p>
<p>Each dot is a car won. Slide the number of games up: the switcher wins about twice as many cars as the stayer, about two games in every three against one in three.</p>`
		},
		// ------------------------------------------------------------------ why
		{
			id: 'cases',
			chapter: 'why',
			title: 'Three places the car could be',
			scene: 'doors',
			hints: { phase: 'cases' },
			duration: 24,
			controls: [firstPick],
			body: `
<p>Here is why. Say you pick a door. The car can be in three places, and each is just as likely. Each row is one of them.</p>
<p>In one row the car is behind your door: staying wins. In the other two rows the car is behind one of the doors you didn’t pick. The host can’t open that door, so he opens the goat door, and the door he leaves closed is the car. Switching wins in those two rows. Pick any first door: it is always one row for staying and two for switching.</p>
<p>Your first pick is right only one time in three, and the host doesn’t change that. When it is wrong, the host’s choice points straight at the car.</p>`
		},
		{
			id: 'ten',
			chapter: 'why',
			title: 'Ten doors',
			scene: 'doors',
			hints: { phase: 'ten' },
			duration: 22,
			controls: [doors],
			body: `
<p>Still not sure? Try more doors. With ten doors you pick one, and the host, who knows, opens eight of the others, all goats, leaving just one other door closed.</p>
<p>Your first pick was a one-in-ten guess. The host carefully skipped one door out of nine. Which would you rather have? Switching now wins about nine games in ten. Slide back down to three doors and it is two in three again.</p>`
		},
		{
			id: 'random',
			chapter: 'why',
			title: 'A host who doesn’t know',
			scene: 'doors',
			hints: { phase: 'random' },
			duration: 22,
			controls: [knows],
			body: `
<p>All of this depends on the host knowing where the car is and always opening a goat door. Switch that off: now the host opens one of your two other doors at random.</p>
<p>About one game in three he opens the car door by accident, and that game is spoiled. In the games where he happens to show a goat, the two closed doors really are even: staying and switching each win about half of them. His door is no longer a clue, because he wasn’t choosing it.</p>`
		},
		{
			id: 'clue',
			chapter: 'why',
			title: 'A door that is a clue',
			scene: 'doors',
			hints: { phase: 'clue' },
			duration: 18,
			body: `
<p>So the answer is: switch, and you win two times in three. The open door feels as if it tells you nothing, but it does, because the host chose it knowing where the car was. Information changes the chances, and how much depends on how it was chosen.</p>
<p>Working out new chances from a clue has a name, Bayes’ rule, and doctors use it to understand test results. The page on <a href="../bayes-theorem/">Bayes’ theorem</a> does it by counting people instead of doors.</p>`,
			notes: `<p>The puzzle is named after Monty Hall, host of the American TV show <em>Let’s Make a Deal</em>. It became famous in 1990, when Marilyn vos Savant answered “switch” in her magazine column and thousands of readers, many of them with maths degrees, wrote in to say she was wrong. She wasn’t: the answer depends on rules the host always follows, and with these rules switching wins two times in three. The real show didn’t always follow them.</p>`
		}
	]
};
