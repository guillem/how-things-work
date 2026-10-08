import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const pick: Control = {
	type: 'range',
	id: 'pick',
	label: 'Number',
	min: 2,
	max: 100,
	step: 1,
	default: 60,
	help: 'Or click a number on the grid.'
};

const STAGE_NAMES = [
	'nothing struck yet',
	'multiples of 2',
	'… of 2 and 3',
	'… of 2, 3 and 5',
	'… of 2, 3, 5 and 7'
];
const sieveStage: Control = {
	type: 'range',
	id: 'sieve',
	label: 'Struck out',
	min: 0,
	max: 4,
	step: 1,
	default: 1,
	format: (v) => STAGE_NAMES[v] ?? '',
	help: 'Drag back and forth to step through the sieve.'
};

const nextPrime: Control = {
	type: 'action',
	id: 'nextPrime',
	label: 'Next prime',
	action: 'Strike the next prime’s multiples'
};

const hours: Control = {
	type: 'range',
	id: 'hours',
	label: 'Hours on the clock',
	min: 2,
	max: 31,
	step: 1,
	default: 12
};

const addA: Control = {
	type: 'range',
	id: 'addA',
	label: 'Start at',
	min: 0,
	max: 30,
	step: 1,
	default: 9
};
const addB: Control = {
	type: 'range',
	id: 'addB',
	label: 'Add',
	min: 0,
	max: 30,
	step: 1,
	default: 5,
	unit: ' hours'
};

const times: Control = {
	type: 'range',
	id: 'times',
	label: 'Multiply every hour by',
	min: 1,
	max: 30,
	step: 1,
	default: 3
};

const powHours: Control = {
	type: 'range',
	id: 'powHours',
	label: 'Hours on the clock',
	min: 2,
	max: 31,
	step: 1,
	default: 13
};
const base: Control = {
	type: 'range',
	id: 'base',
	label: 'Base',
	min: 2,
	max: 30,
	step: 1,
	default: 2
};

const exponent: Control = {
	type: 'range',
	id: 'exponent',
	label: 'Exponent x',
	min: 1,
	max: 1000,
	step: 1,
	default: 77
};

const target: Control = {
	type: 'range',
	id: 'target',
	label: 'Find x so that 2ˣ lands on',
	min: 1,
	max: 100,
	step: 1,
	default: 61
};

export const spec: ExplainerSpec = {
	slug: 'primes-modular-arithmetic',
	title: 'Prime numbers and clock arithmetic',
	summary:
		'Sieve out the primes from a grid of numbers, then add, multiply and raise to powers on a clock, and see why powers on a prime clock are easy to compute and hard to undo — the idea behind public-key cryptography.',
	chapters: [
		{ id: 'primes', title: 'Primes' },
		{ id: 'clock', title: 'Clock arithmetic' },
		{ id: 'oneway', title: 'Easy one way, hard the other' }
	],
	steps: [
		{
			id: 'primes',
			chapter: 'primes',
			title: 'The building blocks of multiplication',
			scene: 'sieve',
			hints: { phase: 'divisors' },
			duration: 24,
			controls: [pick],
			body: `
<p>A <dfn data-def="A number that divides another exactly, with no remainder: 3 is a divisor of 12, 5 is not.">divisor</dfn> of a number divides it exactly. 12 has six divisors — 1, 2, 3, 4, 6 and 12 — but 13 has only two: 1 and itself. A whole number above 1 with exactly two divisors is a <dfn data-def="A whole number greater than 1 whose only divisors are 1 and itself: 2, 3, 5, 7, 11, 13, …">prime</dfn>; the others are <dfn data-def="A whole number greater than 1 that is not prime: it is the product of two smaller whole numbers.">composite</dfn>.</p>
<p>Pick a number and its divisors light up on the grid. Every composite number breaks down into primes, and in only one way: 60 = 2 × 2 × 3 × 5, whichever order you find them in. Primes are the atoms that every whole number is built from by multiplying.</p>`,
			notes: `<p>1 is neither prime nor composite. If it counted as a prime, factorisations would no longer be unique (60 = 1 × 2 × 2 × 3 × 5 = 1 × 1 × 2 × 2 × 3 × 5 …). The fact that every whole number above 1 factorises into primes in exactly one way is called the fundamental theorem of arithmetic.</p>`
		},
		{
			id: 'sieve',
			chapter: 'primes',
			title: 'The sieve of Eratosthenes',
			scene: 'sieve',
			hints: { phase: 'sieve' },
			duration: 30,
			controls: [sieveStage, nextPrime],
			body: `
<p>How do you find all the primes up to 100 without testing each one? Over 2,000 years ago the Greek scholar Eratosthenes used a <dfn data-def="A method that finds all primes up to a limit by repeatedly striking out the multiples of the smallest number not yet struck out.">sieve</dfn>: 2 is prime, so strike out every multiple of 2 — none of them can be prime. The smallest number left, 3, must be prime (nothing smaller divides it), so strike out its multiples. Then 5, then 7.</p>
<p>Step through it. Each colour marks the prime that struck a number first: that is its smallest prime factor. Notice that each prime's first new victim is its own square — 4, 9, 25, 49 — because the smaller multiples were already struck by smaller primes.</p>`,
			notes: `<p>That is why a computer running the sieve starts striking each prime p at p², not at 2p. Computers still use the sieve to list primes today.</p>`
		},
		{
			id: 'survivors',
			chapter: 'primes',
			title: 'What is left is prime',
			scene: 'sieve',
			hints: { phase: 'done' },
			duration: 22,
			body: `
<p>After 7 comes 11 — but its first new victim would be 11 × 11 = 121, past the end of the grid. Every smaller multiple of 11 (22, 33, … 99) also has a smaller prime factor and is already gone. So the sieve can stop: <strong>every number still standing, apart from 1, is prime</strong>. Up to 100 there are 25 of them.</p>
<p>In general you only have to sieve with the primes up to the square root of the limit. The primes thin out as numbers grow, but never run out: Euclid proved there are infinitely many.</p>`,
			notes: `<p>Euclid's argument: multiply any finite list of primes together and add 1. The result leaves remainder 1 when divided by every prime on the list, so its prime factors are all new — the list was never complete.</p>`
		},
		{
			id: 'clock',
			chapter: 'clock',
			title: 'Arithmetic on a clock',
			scene: 'clock',
			hints: { phase: 'add' },
			duration: 24,
			controls: [hours, addA, addB],
			body: `
<p>It's 9 o'clock; what time is it 5 hours later? Not 14 — it's 2. On a clock, numbers wrap around. This is <dfn data-def="Arithmetic in which numbers wrap around after reaching a fixed number m, the modulus: only the remainder after dividing by m counts.">modular arithmetic</dfn>: on a clock of m hours, only the remainder after dividing by m matters. We write 9 + 5 ≡ 2 (mod 12), where m = 12 is the <dfn data-def="The number of hours on the clock: the number at which counting wraps back to 0.">modulus</dfn>.</p>
<p>Mathematicians put 0 at the top instead of 12, so the hours are 0 to m − 1. Change the number of hours and the numbers to add. However many laps the hand makes, the answer is the remainder.</p>`,
			notes: `<p>You use modular arithmetic all the time: days of the week are arithmetic mod 7, minutes mod 60, and the angle of a turning wheel mod 360°. Computers do it on every addition, since a 64-bit register wraps around at 2⁶⁴.</p>`
		},
		{
			id: 'multiply',
			chapter: 'clock',
			title: 'Multiplying: prime clocks are special',
			scene: 'clock',
			hints: { phase: 'times' },
			duration: 30,
			controls: [hours, times],
			body: `
<p>Multiplying works on a clock too: 3 × 5 = 15 ≡ 3 on 12 hours. The drawing multiplies <em>every</em> hour by the same number. On 12 hours, × 3 lands on only four hours — 0, 3, 6 and 9 — and 3 × 4 lands on 0, although neither is 0. Information is lost: you can't undo it, so there's no dividing by 3.</p>
<p>× 5 is different: it shuffles all 12 hours, and multiplying by 5 again undoes it (5 × 5 = 25 ≡ 1). A multiplier shuffles the clock exactly when it shares no factor with the number of hours. The row of chips shows every multiplier. Now set a <strong>prime</strong> number of hours, like 13: every multiplier shuffles, so on a prime clock you can always divide.</p>`
		},
		{
			id: 'powers',
			chapter: 'clock',
			title: 'Powers go round in a cycle',
			scene: 'clock',
			hints: { phase: 'powers' },
			duration: 30,
			controls: [powHours, base],
			body: `
<p>Now multiply by the same number over and over: powers. On a 13-hour clock, the powers of 2 are 1, 2, 4, 8, then 16 ≡ 3, 6, 12, 24 ≡ 11, 9, 5, 10, 7 — and 2¹² is back to 1. They visit every hour except 0 once, in a jumbled order, before repeating.</p>
<p>On a prime clock of p hours the powers of any base (not a multiple of p) always come back to 1, and at the latest after p − 1 steps — <dfn data-def="For a prime p and a number a that is not a multiple of p, a to the power p − 1 leaves remainder 1 when divided by p.">Fermat's little theorem</dfn>. Some bases, like 3 on 13 hours (1, 3, 9, 1), cycle sooner. On 12 hours the powers of 2 never return to 1 at all: they get stuck at 4, 8, 4, 8, ….</p>`,
			notes: `<p>A base whose powers visit every nonzero hour is called a primitive root. Every prime has one, and the cycle length of any base always divides p − 1.</p>`
		},
		{
			id: 'fast',
			chapter: 'oneway',
			title: 'Powers are quick to compute',
			scene: 'power',
			hints: { phase: 'fast' },
			duration: 26,
			controls: [exponent],
			body: `
<p>Take a bigger prime clock, 101 hours, and work out 2⁷⁷ on it. Multiplying 2 by itself 76 times would work, but there's a shortcut called <dfn data-def="Computing a power by squaring repeatedly (g, g², g⁴, g⁸, …) and multiplying together the squares that the binary form of the exponent picks out.">square-and-multiply</dfn>: square over and over to get 2¹, 2², 2⁴, 2⁸, 2¹⁶, 2³², 2⁶⁴, then multiply the ones that add up to 77 = 64 + 8 + 4 + 1. That's 9 multiplications instead of 76.</p>
<p>After every step you take the remainder, so the numbers never grow past 100 × 100. Doubling the exponent adds only one more squaring: an exponent with 600 digits needs only a few thousand multiplications.</p>`,
			notes: `<p>The exponents are written in binary: each 1 in 77 = 1001101₂ picks a square to multiply in. For an exponent of n bits, square-and-multiply needs at most 2(n − 1) multiplications — 4,094 for a 2048-bit (617-digit) exponent, against more than 10⁶¹⁶ one at a time.</p>`
		},
		{
			id: 'reverse',
			chapter: 'oneway',
			title: '… and hard to reverse',
			scene: 'power',
			hints: { phase: 'reverse' },
			duration: 30,
			controls: [target],
			body: `
<p>Now go backwards: 2ˣ lands on 61 on the 101-hour clock — what is x? Without the clock it would be easy: 2ˣ grows steadily, so you can home in on x. On the clock the powers jump around with no visible pattern. The obvious way is to try x = 0, 1, 2, … until you hit it: 78 tries, against 9 multiplications forwards. This reverse problem is called the <dfn data-def="Given g, p and the remainder y of gˣ divided by p, finding the exponent x.">discrete logarithm</dfn>.</p>
<p>With a prime of 600 digits, computing a power still takes a split second, but nobody knows a way to reverse it on an ordinary computer in less than an astronomical time. <strong>Primes are what is left when every multiple is struck out, and on a prime clock, powers are easy to compute and hard to reverse: public-key cryptography is built on that one-way street.</strong></p>`,
			notes: `<p>Trying every x isn't the best known attack: cleverer methods (baby-step giant-step, index calculus, the number field sieve) are much faster, but still hopeless for the 2048-bit primes used in practice. Nobody has proved that a fast method can't exist, and a large quantum computer running Shor's algorithm could reverse it quickly. In the Diffie–Hellman key exchange (1976), two people each keep a secret exponent and swap only the powers, and end up sharing a secret key that an eavesdropper can't compute. RSA, another public-key system, relies on a related one-way street: multiplying two large primes is easy, finding them again from the product is hard.</p>`
		}
	]
};
