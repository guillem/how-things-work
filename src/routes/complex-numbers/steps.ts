import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { radText } from './complex';

// ---- the point z = a + bi on the plane (steps 2–4) ------------------------------------
const zRe: Control = {
	type: 'range',
	id: 'zRe',
	label: 'Real part a',
	min: -3,
	max: 3,
	step: 0.1,
	default: 2,
	format: (v) => v.toFixed(1).replace('-', '−'),
	help: 'Or drag the point z (or focus it and use the arrow keys).'
};
const zIm: Control = {
	type: 'range',
	id: 'zIm',
	label: 'Imaginary part b',
	min: -3,
	max: 3,
	step: 0.1,
	default: 1,
	format: (v) => v.toFixed(1).replace('-', '−')
};

// ---- two numbers to multiply, by length and angle (step 5) ------------------------------
const length = (id: string, name: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label: `Length of ${name}`,
	min: 0.2,
	max: 1.6,
	step: 0.05,
	default: def,
	format: (v) => v.toFixed(2),
	help
});
const angle = (id: string, name: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label: `Angle of ${name}`,
	min: 0,
	max: 360,
	step: 1,
	default: def,
	unit: '°',
	help
});

// ---- the angle of e^(iθ) (steps 6–7) and the number of small turns (step 7) --------------
const theta: Control = {
	type: 'range',
	id: 'theta',
	label: 'Angle θ',
	min: 0,
	max: 360,
	step: 1,
	default: 60,
	format: (v) => {
		const r = radText(v);
		return `${v}° ${r.includes('π') || v === 0 ? '=' : '≈'} ${r} rad`;
	},
	help: 'Or drag the point on the circle.'
};
const turns: Control = {
	type: 'range',
	id: 'n',
	label: 'Number of small steps n',
	min: 1,
	max: 100,
	step: 1,
	default: 3,
	help: 'More, smaller steps: the path hugs the circle.'
};

export const spec: ExplainerSpec = {
	slug: 'complex-numbers',
	title: "Complex numbers and Euler's formula",
	summary:
		'Drag points on the complex plane and watch multiplication turn and stretch them, then follow eⁱᶿ round the unit circle.',
	chapters: [
		{ id: 'plane', title: 'Numbers on a plane' },
		{ id: 'multiply', title: 'Multiplying turns and stretches' },
		{ id: 'euler', title: "Euler's formula" }
	],
	steps: [
		// ------------------------------------------------------------------ plane
		{
			id: 'i',
			chapter: 'plane',
			title: 'A number whose square is −1',
			scene: 'plane',
			hints: { phase: 'i' },
			duration: 14,
			body: `
<p>Square any ordinary number and the answer is never negative: 2² = 4, and (−2)² = 4 too. So the equation <i>x</i>² = −1 has no solution among the numbers on the number line.</p>
<p>In the 1500s, Italian mathematicians solving cubic equations kept running into square roots of negative numbers halfway through their formulas — and, if they carried on calculating with them regardless, they reached correct, real answers. So they took the bold step: <em>invent</em> a number that squares to −1. It is called <strong>i</strong>, and it obeys one new rule:</p>
<p class="formula"><strong>i² = −1</strong></p>
<p>Everything else is ordinary algebra. But i is not bigger or smaller than any number on the line, so it cannot sit on it. It gets a direction of its own: a second axis, at right angles to the number line.</p>`,
			notes: `<p>Gerolamo Cardano published the formulas for cubic equations in 1545; Rafael Bombelli, in 1572, was the first to set out rules for calculating with these new quantities. René Descartes called them “imaginary” in 1637, as a put-down, and the name stuck — though they are no less real than negative numbers, which were also distrusted for centuries.</p>
<p>It is tempting to write i = √−1, but careful: the school rule √<i>a</i> · √<i>b</i> = √(<i>ab</i>) breaks for negative numbers. It would give √−1 · √−1 = √1 = 1, when i · i = −1. Defining i by i² = −1 avoids the trap.</p>`
		},
		{
			id: 'plane',
			chapter: 'plane',
			title: 'The complex plane',
			scene: 'plane',
			hints: { phase: 'plane' },
			controls: [zRe, zIm],
			body: `
<p>Combine an ordinary number with a multiple of i and you get a <dfn data-def="A number of the form a + bi, where a and b are ordinary (real) numbers and i² = −1.">complex number</dfn>:</p>
<p class="formula"><strong>z = <span class="tag re">a</span> + <span class="tag im">b</span>i</strong></p>
<p><span class="tag re">a</span> is its <dfn data-def="The ordinary number a in a + bi: the horizontal coordinate on the complex plane.">real part</dfn> and <span class="tag im">b</span> its <dfn data-def="The number b in a + bi (without the i): the vertical coordinate on the complex plane.">imaginary part</dfn>. Two numbers make a point: go <i>a</i> along the horizontal axis and <i>b</i> up the vertical one. This is the <strong>complex plane</strong>. The ordinary numbers are its horizontal axis, where <i>b</i> = 0.</p>
<p>Drag the point <strong>z</strong>. Adding complex numbers works part by part: (2 + i) + (1 + 2i) = 3 + 3i. On the plane, that is putting two arrows head to tail — adding just slides points around.</p>`,
			notes: `<p>Picturing complex numbers as points of a plane came surprisingly late, more than two centuries after Bombelli: Caspar Wessel described it in 1799 and Jean-Robert Argand in 1806, and Carl Friedrich Gauss made it popular. Before that, many mathematicians used complex numbers without any idea of what they “looked like”.</p>`
		},
		{
			id: 'times-i',
			chapter: 'plane',
			title: 'Multiplying by i is a quarter turn',
			scene: 'plane',
			hints: { phase: 'times' },
			duration: 16,
			controls: [zRe, zIm],
			body: `
<p>Adding slides. Multiplying does something more interesting. Multiply z = <i>a</i> + <i>b</i>i by i, using ordinary algebra and i² = −1:</p>
<p class="formula"><strong>i · (<i>a</i> + <i>b</i>i) = <i>a</i>i + <i>b</i>i² = −<i>b</i> + <i>a</i>i</strong></p>
<p>The point (<i>a</i>, <i>b</i>) has moved to (−<i>b</i>, <i>a</i>): exactly where it lands if you <strong>turn it a quarter turn</strong>, 90° anticlockwise, about 0. For example i · (2 + i) = −1 + 2i. Drag z: whatever it is, i·z is a quarter turn ahead.</p>
<p>Do it twice and z makes a half turn, landing on −z. That is what i² = −1 means: two quarter turns make a half turn, and a half turn is multiplying by −1. Four quarter turns bring it home: i⁴ = 1.</p>`
		},
		{
			id: 'polar',
			chapter: 'plane',
			title: 'Length and angle',
			scene: 'plane',
			hints: { phase: 'polar' },
			controls: [zRe, zIm],
			body: `
<p>A point on a plane can also be given by how far it is from 0 and in which direction. For a complex number these are its</p>
<ul>
<li><dfn data-def="The distance of a complex number from 0: |a + bi| = √(a² + b²). Also called its modulus or absolute value.">length</dfn> <strong>|z| = √(<i>a</i>² + <i>b</i>²)</strong>, by Pythagoras: |1.5 + 2i| = 2.5;</li>
<li><dfn data-def="The angle of a complex number, measured anticlockwise from the positive real axis. Also called its argument.">angle</dfn> φ (phi), measured anticlockwise from the positive real axis, like θ on the unit circle.</li>
</ul>
<p>Shrink z to length 1 and it lands on the unit circle at angle φ, at the point (cos φ, sin φ). Stretching it back by |z| gives <i>a</i> = |z| cos φ and <i>b</i> = |z| sin φ, so</p>
<p class="formula"><strong>z = |z| · (cos φ + i sin φ)</strong></p>
<p>Length and angle are the natural language for multiplication, as the next step shows.</p>`,
			notes: `<p>The angle is often called the <em>argument</em> and the length the <em>modulus</em> or <em>absolute value</em>: for an ordinary number, |−3| = 3 is the same idea — the distance from 0. The angle of 0 itself is undefined, since 0 has no direction.</p>`
		},
		// ------------------------------------------------------------------ multiply
		{
			id: 'multiply',
			chapter: 'multiply',
			title: 'Multiplying: lengths multiply, angles add',
			scene: 'product',
			duration: 20,
			controls: [
				length('zLen', 'z', 1.4, 'Or drag z and w (arrow keys: ← → turn, ↑ ↓ stretch).'),
				angle('zAng', 'z', 20),
				length('wLen', 'w', 1.25),
				angle('wAng', 'w', 45)
			],
			body: `
<p>Multiply two complex numbers out like brackets, then replace i² by −1:</p>
<p class="formula"><strong>(<i>a</i> + <i>b</i>i)(<i>c</i> + <i>d</i>i) = (<i>ac</i> − <i>bd</i>) + (<i>ad</i> + <i>bc</i>)i</strong></p>
<p>The formula hides a simple picture. Drag the two points <strong class="tag z">z</strong> and <strong class="tag w">w</strong> and watch their product <strong class="tag zw">zw</strong>:</p>
<ul>
<li>its <strong>length is the product of their lengths</strong>: |zw| = |z| · |w|;</li>
<li>its <strong>angle is the sum of their angles</strong>.</li>
</ul>
<p>For example (1 + i)(1 + i) = 1 + 2i + i² = 2i. Each factor has length √2 ≈ 1.41 and angle 45°; the product has length √2 · √2 = 2 and angle 45° + 45° = 90°.</p>
<p>So multiplying by w <em>turns</em> by w's angle and <em>stretches</em> by w's length: the shaded triangle 0, 1, z is copied, turned and scaled onto 0, w, zw. Multiplying by i — length 1, angle 90° — was the pure quarter turn.</p>`,
			notes: `<p>Why do the angles add? Write z and w with length and angle, and multiply: (cos α + i sin α)(cos β + i sin β) = (cos α cos β − sin α sin β) + i (sin α cos β + cos α sin β). The two brackets are the angle-addition formulas of trigonometry, cos(α + β) and sin(α + β). The lengths just multiply in front.</p>
<p>When the angles add up to more than 360°, the product has gone round more than once: 200° + 250° = 450°, which points the same way as 90°.</p>`
		},
		// ------------------------------------------------------------------ euler
		{
			id: 'euler',
			chapter: 'euler',
			title: 'eⁱᶿ: the point at angle θ',
			scene: 'euler',
			hints: { phase: 'euler' },
			controls: [theta],
			body: `
<p>Now a surprise. The number <i>e</i> ≈ 2.718 is the base of exponential growth: e<sup><i>x</i></sup> is what you get from growth that is always proportional to the amount already there. What could e raised to an <em>imaginary</em> power mean? Leonhard Euler found the answer, published in 1748:</p>
<p class="formula"><strong>e<sup>iθ</sup> = <span class="tag re">cos θ</span> + i <span class="tag im">sin θ</span></strong></p>
<p>(with θ in radians). Its real part is cos θ and its imaginary part is sin θ, so <strong>e<sup>iθ</sup> is the point at angle θ on the unit circle</strong>. Drag it round: the real part traces the cosine wave and the imaginary part the sine wave.</p>
<p>So any complex number can be written by length and angle as z = |z| · e<sup>iφ</sup>.</p>`,
			notes: `<p>Radians matter here. The formula is only true with θ in radians: the point at 90° is e<sup>iπ/2</sup> = i, not e<sup>90i</sup>. Roger Cotes had found an equivalent result, in the language of logarithms, in 1714.</p>`
		},
		{
			id: 'compound',
			chapter: 'euler',
			title: 'Why: many tiny turns',
			scene: 'euler',
			hints: { phase: 'compound' },
			controls: [turns, theta],
			body: `
<p>Why should e have anything to do with circles? Recall how e arises from compound interest: grow by a fraction 1/<i>n</i>, <i>n</i> times over, and (1 + 1/<i>n</i>)<sup><i>n</i></sup> gets closer and closer to e as <i>n</i> grows. In the same way, e<sup><i>x</i></sup> is what (1 + <i>x</i>/<i>n</i>)<sup><i>n</i></sup> approaches.</p>
<p>Put <i>x</i> = iθ. Each factor 1 + iθ/<i>n</i> is a point just above 1: a <strong>tiny turn</strong>, by about θ/<i>n</i>, with a length barely above 1. Multiplying by it <i>n</i> times adds up <i>n</i> tiny turns: about θ in total, while the length hardly grows.</p>
<p>Raise <i>n</i> and watch the path of 1, 1 + iθ/<i>n</i>, (1 + iθ/<i>n</i>)², … With one step it shoots off to 1 + iθ. With more, smaller steps it hugs the circle and ends ever closer to the point at angle θ. For θ = 180°, 10 steps end at −1.59 + 0.16i, and 100 steps at −1.05.</p>`,
			notes: `<p>Another route to the same formula is the power series e<sup><i>x</i></sup> = 1 + <i>x</i> + <i>x</i>²/2! + <i>x</i>³/3! + …: put <i>x</i> = iθ and collect the real and imaginary terms, and out come the series of cos θ and sin θ. The model behind this page computes e<sup>iθ</sup> both ways — the series and the compounding — without using cosine or sine, and checks that both land on (cos θ, sin θ).</p>`
		},
		{
			id: 'identity',
			chapter: 'euler',
			title: "Half a turn: Euler's identity",
			scene: 'euler',
			hints: { phase: 'identity' },
			duration: 16,
			body: `
<p>Turn by θ = π radians, half a turn, and e<sup>iθ</sup> lands on −1:</p>
<p class="formula"><strong>e<sup>iπ</sup> = −1</strong>, or <strong>e<sup>iπ</sup> + 1 = 0</strong></p>
<p>— one line joining five of the most important numbers in mathematics: 0, 1, e, i and π.</p>
<p>The rule for powers, e<sup>iα</sup> · e<sup>iβ</sup> = e<sup>i(α + β)</sup>, is the rule you saw for products: angles add. With lengths, (|z| e<sup>iα</sup>)(|w| e<sup>iβ</sup>) = |z||w| e<sup>i(α + β)</sup>.</p>
<p><strong>The takeaway:</strong> multiplying by a complex number rotates and scales — turn by its angle, stretch by its length — and e<sup>iθ</sup> is simply the point at angle θ on the unit circle. That is why complex numbers are the natural language of everything that turns or oscillates: alternating current, waves, quantum mechanics, and the Fourier transform that splits a signal into frequencies.</p>`,
			notes: `<p>Repeatedly squaring and adding complex numbers — z → z² + c — turns each point of the plane round and stretches it again and again. Whether the result stays bounded or flies off to infinity draws the Mandelbrot set (see chaos and fractals).</p>`
		}
	]
};
