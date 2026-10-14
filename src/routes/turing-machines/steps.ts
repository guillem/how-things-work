import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { MAX_STEPS } from './turing';

const play: Control = {
	type: 'toggle',
	id: 'play',
	label: 'Run by itself',
	default: true,
	help: 'Off: one step at a time. Press Step, or focus the marker on the timeline and use the arrow keys.'
};

const pace: Control = {
	type: 'range',
	id: 'pace',
	label: 'Speed',
	min: 1,
	max: 30,
	step: 1,
	default: 2,
	unit: ' steps/s'
};

const tick: Control = {
	type: 'action',
	id: 'tick',
	label: 'Step',
	action: 'Step once',
	help: 'Pauses the machine and applies the next rule.'
};

const rewind: Control = {
	type: 'action',
	id: 'rewind',
	label: 'Start again',
	action: 'Start again',
	help: 'Back to the starting tape, the head on the first cell.'
};

const incInput: Control = {
	type: 'select',
	id: 'incInput',
	label: 'Number on the tape',
	default: '1011',
	options: [
		{ value: '1011', label: '1011 (11)' },
		{ value: '100111', label: '100111 (39)' },
		{ value: '1111', label: '1111 (15)' },
		{ value: '0', label: '0' }
	]
};

const palInput: Control = {
	type: 'select',
	id: 'palInput',
	label: 'String on the tape',
	default: '0110',
	options: [
		{ value: '0110', label: '0110' },
		{ value: '10101', label: '10101' },
		{ value: '10011', label: '10011' },
		{ value: '1101011', label: '1101011' },
		{ value: '01100110', label: '01100110' }
	]
};

const example: Control = {
	type: 'select',
	id: 'example',
	label: 'Load a rule table',
	default: 'increment',
	options: [
		{ value: 'increment', label: 'Add one' },
		{ value: 'palindrome', label: 'Palindrome check' },
		{ value: 'beaver', label: 'Two-state busy beaver' }
	],
	help: 'Loading a table replaces the text in the editor and the tape.'
};

const reload: Control = {
	type: 'action',
	id: 'reload',
	label: 'Reset',
	action: 'Reset to the table',
	help: 'Puts the chosen table and its tape back, undoing your edits.'
};

const beaver: Control = {
	type: 'select',
	id: 'beaver',
	label: 'States',
	default: '3',
	options: [
		{ value: '2', label: '2 states' },
		{ value: '3', label: '3 states' },
		{ value: '4', label: '4 states' }
	]
};

const beaverPace: Control = { ...pace, id: 'bbPace', default: 6, max: 40 };

const argument: Control = {
	type: 'range',
	id: 'argument',
	label: 'Step of the argument',
	min: 1,
	max: 5,
	step: 1,
	default: 1,
	format: (v) =>
		[
			'',
			'1 · the table',
			'2 · suppose H',
			'3 · build D',
			'4 · D is not in the table',
			'5 · D on D'
		][v] ?? String(v)
};

const cityCount: Control = {
	type: 'range',
	id: 'cities',
	label: 'Cities',
	min: 4,
	max: 9,
	step: 1,
	default: 6
};

const tourPace: Control = {
	type: 'range',
	id: 'tourPace',
	label: 'Speed',
	min: 1,
	max: 400,
	step: 1,
	default: 12,
	unit: ' tours/s'
};

const reshuffle: Control = {
	type: 'action',
	id: 'reshuffle',
	label: 'New cities',
	action: 'New cities',
	help: 'The same number of cities, at other made-up places.'
};

const growthN: Control = {
	type: 'range',
	id: 'growthN',
	label: 'Cities',
	min: 3,
	max: 30,
	step: 1,
	default: 20
};

const stepper = [play, pace, tick, rewind];

export const spec: ExplainerSpec = {
	slug: 'turing-machines',
	title: 'Turing machines and the limits of computation',
	summary:
		'Program a tape-and-head machine with a small rule table, see why one such machine can run every other, then meet the limits: a question no program can answer, the busy beavers that grow faster than anything computable, and a puzzle whose search explodes.',
	chapters: [
		{ id: 'machine', title: 'The machine' },
		{ id: 'power', title: 'One machine for all' },
		{ id: 'halting', title: 'What no program can do' },
		{ id: 'hard', title: 'What no known program does fast' }
	],
	steps: [
		// ------------------------------------------------------------------ machine
		{
			id: 'machine',
			chapter: 'machine',
			title: 'A tape, a head and a table',
			scene: 'tape',
			hints: { program: 'increment', intro: true },
			duration: 30,
			body: `
<p>In 1936 Alan Turing asked what it means to compute something “by a definite method”. His answer was a machine so simple it can be drawn in a few lines:</p>
<ul>
<li>a <strong>tape</strong> of cells, unbounded in both directions, each holding one symbol (here 0, 1 or blank);</li>
<li>a <strong>head</strong> that sits on one cell, reads it, writes it and moves one cell left or right;</li>
<li>a <dfn data-def="Which of a fixed, finite set of situations the machine is in. The state is all it remembers apart from the tape.">state</dfn>, and a <strong>rule table</strong> that says, for each state and symbol read: what to write, which way to move, and the next state.</li>
</ul>
<p>Formally the table is a function δ(<i>q</i>, <i>a</i>) = (<i>q′</i>, <i>b</i>, L or R). One <strong>step</strong> applies one rule. When no rule matches, the machine <dfn data-def="Stops for good. The tape it leaves is the output.">halts</dfn>. That is all: no arithmetic, no memory addresses, no variables.</p>`,
			notes: `<p>A. M. Turing, “On Computable Numbers, with an Application to the Entscheidungsproblem”, <i>Proceedings of the London Mathematical Society</i>, series 2, vol. 42, pp. 230–265 (1936–37). Turing modelled a person working with pencil and paper: finitely many states of mind, a finite alphabet, attention on one square at a time. Variants with several tapes, a one-way tape or more symbols compute exactly the same functions (some faster), which is one reason the definition has stuck.</p>`
		},
		{
			id: 'increment',
			chapter: 'machine',
			title: 'Adding one',
			scene: 'tape',
			hints: { program: 'increment' },
			duration: 30,
			controls: [incInput, ...stepper],
			body: `
<p>This table adds one to a <a href="../binary/#add">binary</a> number. In state <code>right</code> the head walks to the right end of the number. Reading the blank past the end, it steps back and switches to <code>carry</code>.</p>
<p>In <code>carry</code>, a 1 becomes 0 and the carry moves left; a 0 (or the blank left of the number) becomes 1 and the machine moves to <code>done</code>, a state with no rules, so it halts.</p>
<p>1011 + 1 = 1100 takes <strong>8 steps</strong>: five to find the end, three to carry. Try 1111: the carry runs off the left end and the number grows a digit. The highlighted row of the table is the rule being applied.</p>`
		},
		{
			id: 'palindrome',
			chapter: 'machine',
			title: 'Checking a palindrome',
			scene: 'tape',
			hints: { program: 'palindrome' },
			duration: 40,
			controls: [palInput, ...stepper],
			body: `
<p>A harder task: does a string of 0s and 1s read the same backwards? The machine has no memory but its state, so it remembers one symbol at a time <em>in the state</em>. It erases the first symbol and goes to <code>have0</code> or <code>have1</code>, runs to the right end, and checks that the last symbol matches (<code>last0</code>, <code>last1</code>). If it does, it erases that one too and runs back (<code>back</code>) to start over on the shorter string.</p>
<p>It halts in <code>yes</code> when nothing is left, or in <code>no</code> at the first mismatch.</p>
<p>All that running back and forth costs: a palindrome of <i>n</i> symbols takes (<i>n</i> + 1)(<i>n</i> + 2)/2 steps, about <i>n</i>²/2 — 15 for 0110, 231 for twenty symbols. The same quadratic growth as <a href="../sorting/#bubble">bubble sort</a>, and for the same reason: each pass does a little work and walks a long way.</p>`,
			notes: `<p>With two tapes (copy the input, then read one forwards and one backwards) the check takes about 3<i>n</i> steps. On a single tape, any machine needs on the order of <i>n</i>² steps for palindromes (a classic lower bound proved with “crossing sequences”). Models differ in speed, but not in what they can compute.</p>`
		},
		{
			id: 'program',
			chapter: 'machine',
			title: 'Write your own table',
			scene: 'tape',
			hints: { edit: true },
			duration: 60,
			controls: [example, reload, ...stepper],
			body: `
<p>Now edit the rule table on the left. One rule per line:</p>
<p><code>state symbol -> write move next</code></p>
<p>Symbols are single characters (<code>_</code> is the blank), moves are <code>L</code> or <code>R</code>, and the first rule’s state is the start state. A state with no rule for the symbol under the head halts. <code>#</code> starts a comment. Type the starting tape in the box above it: the head starts on its first cell.</p>
<p>An exercise: turn <em>Add one</em> into <em>subtract one</em>. Only the <code>carry</code> rules need to change: a 0 becomes 1 and the borrow moves on; a 1 becomes 0 and you are done.</p>`,
			notes: `<p>The page stops a machine after ${MAX_STEPS} steps, so a table that never halts can’t hang it. Notice what that limit cannot tell you: whether a machine stopped at step ${MAX_STEPS} would have halted at step ${MAX_STEPS + 1}, or never. That question is the subject of the next chapter.</p>`
		},
		// ------------------------------------------------------------------ power
		{
			id: 'universal',
			chapter: 'power',
			title: 'One machine that runs them all',
			scene: 'universal',
			duration: 40,
			body: `
<p>Each table so far is a separate machine. But a rule table is just text, and text can be written on a tape. Turing’s key step was a <dfn data-def="A Turing machine that, given the description of any machine M and an input, does what M would do on that input.">universal machine</dfn> <i>U</i>: its tape holds the <strong>description</strong> of another machine <i>M</i>, <i>M</i>’s current state and <i>M</i>’s tape. For each step of <i>M</i>, <i>U</i> reads the symbol under <i>M</i>’s head, walks over to the description to find the matching rule, and walks back to carry it out.</p>
<p>Here <i>U</i> is running the add-one table on 1011. It takes many of <i>U</i>’s own steps to do one of <i>M</i>’s, but the result is the same tape.</p>
<p>That is the stored-program computer: the <a href="../cpu/">processor</a> you met earlier is a universal machine (with a finite memory) whose program sits in memory like data. One fixed piece of hardware runs any program.</p>`,
			notes: `<p>The drawing is a sketch of what <i>U</i> does, not its rule table: a real universal machine marks cells as it goes and needs hundreds of steps per simulated step. They can be very small. Marvin Minsky found one with 7 states and 4 symbols in 1962; Yurii Rogozhin later gave universal machines with (states, symbols) of (4, 6), (5, 5), (6, 4) and others (as listed in Wikipedia’s “Universal Turing machine”). How descriptions are written doesn’t matter, as long as <i>U</i> can decode them; the next chapter uses one encoding as a string of 0s and 1s.</p>`
		},
		{
			id: 'thesis',
			chapter: 'power',
			title: 'What “computable” means',
			scene: 'universal',
			hints: { thesis: true },
			duration: 30,
			body: `
<p>In 1936 Alonzo Church reached the same limits by a completely different route (the λ-calculus), and the two definitions turned out to compute exactly the same functions. So do every programming language, every processor, and odd systems like Conway’s Game of Life or the cellular automaton Rule 110.</p>
<p>The <dfn data-def="The claim that anything computable by an effective, step-by-step method can be computed by a Turing machine. A definition of 'method', so it cannot be proved, only supported.">Church–Turing thesis</dfn> says this is no accident: whatever can be computed by any step-by-step method can be computed by a Turing machine. It is a claim about the world, not a theorem, and nothing has broken it since 1936.</p>
<p>So a question about Turing machines is a question about <em>all</em> programs. If no Turing machine can do something, no computer will, however fast.</p>`,
			notes: `<p>Speed is another matter. A Turing machine can simulate a modern computer with only a polynomial slowdown, so “solvable in polynomial time” doesn’t depend on the model either. Quantum computers compute the same functions as Turing machines; the open question is whether they solve some problems faster.</p>`
		},
		// ------------------------------------------------------------------ halting
		{
			id: 'halting',
			chapter: 'halting',
			title: 'Will it ever stop?',
			scene: 'halting',
			hints: { table: true },
			duration: 30,
			body: `
<p>Every machine has a description, a string of 0s and 1s, and any string can be a machine’s input. So we can run each machine on each description. The grid shows six small machines, each run on the descriptions of all six: <strong>H</strong> where it halts, <strong>∞</strong> where it runs forever.</p>
<p>These entries were worked out by running each machine and watching for a repeat: the same configuration seen twice, or the head walking off into blank tape in the same state. That works here. The <dfn data-def="Given a program and its input, decide whether it eventually halts or runs forever.">halting problem</dfn> asks for more: one program <i>H</i> that answers correctly for <em>every</em> machine and input.</p>
<p>Running and waiting is not enough: if a machine hasn’t halted after a million steps, it may halt at the next one.</p>`,
			notes: `<p>The description used here writes each rule <i>q a</i> → <i>b</i> <i>m</i> <i>q′</i> as 1<sup><i>q</i>+1</sup>0 1<sup><i>a</i>+1</sup>0 1<sup><i>b</i>+1</sup>0 1<sup><i>m</i>+1</sup>0 1<sup><i>q′</i>+1</sup>00, with states and symbols numbered. Any decodable encoding would do. The rows are: add one, the palindrome checker, “walk right forever”, “halt if the length is even”, “halt if the number of 1s divides by 4” and “halt if the length divides by 3”.</p>`
		},
		{
			id: 'diagonal',
			chapter: 'halting',
			title: 'No program can always tell',
			scene: 'halting',
			hints: { argument: true },
			duration: 50,
			controls: [argument],
			body: `
<p>Turing’s proof, in five moves (use the slider):</p>
<ol>
<li>List <em>every</em> machine, in order of their descriptions: an infinite version of the grid.</li>
<li>Suppose some machine <i>H</i> decides halting: given <i>M</i> and an input <i>x</i>, it always halts, with “yes” if <i>M</i> halts on <i>x</i> and “no” if it doesn’t.</li>
<li>Use <i>H</i> to build <i>D</i>: given a description <i>M</i>, ask <i>H</i> about <i>M</i> run on <i>M</i> itself, the <strong>diagonal</strong>, and do the opposite. If <i>H</i> says “halts”, loop forever; if “runs forever”, halt.</li>
<li><i>D</i> is a machine, so it has a row. But it differs from every row on the diagonal: from machine <i>k</i> in column <i>k</i>. So it is in no row.</li>
<li>Or ask directly: does <i>D</i> halt on its own description? If it does, it loops; if it loops, it halts. Contradiction.</li>
</ol>
<p>So <i>H</i> cannot exist. <strong>The halting problem is undecidable</strong>: no program answers it for every program and input. That does not stop us deciding it for particular machines, like the six above.</p>`,
			notes: `<p>This is Cantor’s diagonal argument (which shows there are more real numbers than whole numbers) turned on programs. It also shows that most functions are not computable at all: there are countably many machines but uncountably many functions from strings to yes/no. Rice’s theorem extends the result: every non-trivial question about what a program computes (does it ever print 7? does it compute the same thing as this other program?) is undecidable in general. That is why compilers and virus scanners have to approximate.</p>`
		},
		{
			id: 'beaver',
			chapter: 'halting',
			title: 'Busy beavers',
			scene: 'beaver',
			duration: 40,
			controls: [
				beaver,
				{
					...play,
					help: 'Off: drag the marker on the timeline, or focus it and use the arrow keys.'
				},
				beaverPace
			],
			body: `
<p>Tibor Radó turned the halting problem into a game in 1962. Take every machine with <i>n</i> states and the symbols 0 and 1, start each on a blank tape, and among those that halt, find the one that runs longest. Its number of steps is <dfn data-def="The largest number of steps that an n-state, 2-symbol Turing machine started on a blank tape can take and still halt.">S(<i>n</i>)</dfn>, the busy beaver number.</p>
<p>Each row of the picture is the tape after one more step, time running down; the outlined cell is the head. The champions: <strong>S(2) = 6</strong> steps (4 ones), <strong>S(3) = 21</strong> (5 ones), <strong>S(4) = 107</strong> (13 ones).</p>
<p>If S(<i>n</i>) were computable, the halting problem for blank tapes would be easy: run an <i>n</i>-state machine for S(<i>n</i>) steps; if it hasn’t halted by then, it never will. So S grows faster than any computable function.</p>`,
			notes: `<p>Champions in the Busy Beaver Challenge’s list (wiki.bbchallenge.org, “Champions”): S(2) found by Radó, S(3) proved by Shen Lin (1963), S(4) by Allen Brady (1983). The most 1s three states can leave, Σ(3) = 6, comes from a different machine, which halts in 14 steps. The transition into the halt state is counted as a step.</p>`
		},
		{
			id: 'bb5',
			chapter: 'halting',
			title: 'Five states: 47,176,870 steps',
			scene: 'beaver',
			hints: { five: true },
			duration: 40,
			body: `
<p>With five states the champion, found by Heiner Marxen and Jürgen Buntrock in 1989, halts after <strong>47,176,870 steps</strong>, leaving 4,098 ones. The picture shows its first steps; the whole run fits in a fraction of a second on this page’s simulator, which reproduces both numbers.</p>
<p>Proving that no other 5-state machine runs longer took until <strong>2024</strong>. The Busy Beaver Challenge, an online collaboration largely of amateurs, decided every one of the 181,385,789 machines it had to consider, halting or not, with deciders checked in the Coq proof assistant: <strong>S(5) = 47,176,870</strong>.</p>
<p>No single program can decide halting, but people with many clever, special-purpose arguments decided it for every 5-state machine. For six states the record holder runs for a number of steps far too large to write out, and some 6-state machines halt only if open problems in number theory, much like the Collatz problem, come out a certain way.</p>`,
			notes: `<p>The bbchallenge Collaboration, “Determination of the fifth Busy Beaver value”, arXiv:2509.12337 (2025); the result was announced on 2 July 2024. Wikipedia (“Busy beaver”) gives the best known lower bound for six states as Σ(6) &gt; 2↑↑↑5 in Knuth’s up-arrow notation, a tower of powers of 2 whose height is itself a tower.</p>`
		},
		// ------------------------------------------------------------------ hard
		{
			id: 'tsp',
			chapter: 'hard',
			title: 'Solvable, but slowly: the travelling salesman',
			scene: 'tsp',
			duration: 40,
			controls: [
				cityCount,
				{
					...play,
					id: 'tspPlay',
					help: 'Off: drag the marker on the timeline, or focus it and use the arrow keys.'
				},
				tourPace,
				reshuffle
			],
			body: `
<p>Some problems are computable but seem to need an enormous search. Visit every city once and return home by the shortest round trip: the <dfn data-def="Find the shortest closed route through a set of cities that visits each exactly once.">travelling salesman problem</dfn>.</p>
<p>Brute force tries every tour. Fix the starting city; the other <i>n</i> − 1 can come in (<i>n</i> − 1)! orders, and each tour is counted twice (once each way): <strong>(<i>n</i> − 1)!/2 tours</strong>. Six cities have 60; nine have 20,160. Watch the search try them and keep the shortest so far (green). The dashed tour is a greedy guess, always going to the nearest unvisited city: fast, often good, sometimes not the best.</p>`,
			notes: `<p>The cities are made up (random, from a fixed seed). Better exact methods exist: the Held–Karp dynamic program takes about <i>n</i>² 2<sup><i>n</i></sup> steps instead of <i>n</i>!, and branch-and-cut solvers routinely solve instances with thousands of cities. But every known exact method takes exponential time in the worst case.</p>`
		},
		{
			id: 'explosion',
			chapter: 'hard',
			title: 'How fast the search explodes',
			scene: 'growth',
			duration: 40,
			controls: [growthN],
			body: `
<p>The chart puts the number of tours, (<i>n</i> − 1)!/2, next to the growth you met in <a href="../sorting/#growth">sorting</a>, <i>n</i>² and <i>n</i> log₂ <i>n</i>, and Held–Karp’s <i>n</i>² 2<sup><i>n</i></sup>, on a scale where each line is ten times the one below.</p>
<p>At a billion tours a second, 20 cities take about <strong>2 years</strong> of brute force; 25 take about <strong>10 million years</strong>. Held–Karp does 25 cities in about 20 seconds, but doubles its work with every city added. A faster computer only moves the wall a few cities along.</p>
<p>Nobody knows a method that solves every instance in polynomial time, nor has anyone proved that none exists: that is the P versus NP question, open since 1971. So there are three kinds of problem: those solved quickly, those solvable only (as far as anyone knows) by searches that explode, and those, like halting, that <strong>no program can solve at all</strong>. And all of it is measured on a machine as simple as a tape and a head.</p>`,
			notes: `<p>P is the class of yes/no problems solvable in polynomial time; NP those whose “yes” answers can be checked in polynomial time (“is there a tour shorter than <i>L</i>?” — given a tour, adding up its length is quick). The decision version of the travelling salesman problem is NP-complete (Karp, 1972): a polynomial-time method for it would give one for every problem in NP. Stephen Cook posed the question in 1971.</p>`
		}
	]
};
