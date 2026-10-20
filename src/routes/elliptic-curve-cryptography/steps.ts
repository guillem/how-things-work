import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { FIELDS, KEY_SIZES, TOY_N } from './ecc';

const height = (id: string, label: string, value: number): Control => ({
	type: 'range',
	id,
	label,
	min: -12,
	max: 12,
	step: 0.1,
	default: value,
	format: (v) => `y = ${v.toFixed(1)}`
});
const py = height('py', 'Point P', -2.5);
const qy = height('qy', 'Point Q', 3.5);

const prime: Control = {
	type: 'select',
	id: 'prime',
	label: 'Field size p',
	default: '97',
	options: FIELDS.map((p) => ({ value: String(p), label: `p = ${p}` }))
};

const pointIndex = (id: string, label: string, value: number): Control => ({
	type: 'range',
	id,
	label,
	min: 1,
	max: TOY_N - 1,
	step: 1,
	default: value,
	help: id === 'pi' ? 'Or drag P and Q on the stage.' : undefined,
	format: (v) => `point ${v} of ${TOY_N - 1}`
});
const pi = pointIndex('pi', 'Point P', 1);
const qi = pointIndex('qi', 'Point Q', 38);

const secret = (id: string, label: string, value: number): Control => ({
	type: 'range',
	id,
	label,
	min: 1,
	max: TOY_N - 1,
	step: 1,
	default: value
});
const k = secret('k', 'Secret k', 53);
const a = secret('a', 'Alice’s secret a', 29);
const b = secret('b', 'Bob’s secret b', 64);

const security: Control = {
	type: 'select',
	id: 'security',
	label: 'Security level',
	default: '128',
	options: KEY_SIZES.map((r) => ({ value: String(r.security), label: `${r.security} bits` }))
};

/**
 * Scenes: `real` (y² = x³ + 7 over the reals; hint `phase` 'curve' | 'chord' | 'tangent' |
 * 'infinity'), `field` (the same equation over F_p; hint `phase` 'scatter' | 'add'),
 * `multiply` (double-and-add on F₉₇; hint `phase` 'multiply' | 'dlog'), `ecdh`, `standard`
 * (hint `phase` 'secp' | 'x25519') and `sizes`.
 */
export const spec: ExplainerSpec = {
	slug: 'elliptic-curve-cryptography',
	title: 'Elliptic-curve cryptography',
	summary:
		'Drag two points on y² = x³ + 7 and add them with a chord, then watch the same equation over a finite field turn into a scatter on which the same rule still works. Multiply a point by a secret with double-and-add, see that the result gives no clue to the secret, run Diffie–Hellman on the curve, check the real standards secp256k1 and X25519 in your browser, and see why 256 bits do the work of 3,072.',
	chapters: [
		{ id: 'picture', title: 'A curve you can see' },
		{ id: 'field', title: 'The same rule, mod p' },
		{ id: 'oneway', title: 'Easy one way, hard the other' },
		{ id: 'dh', title: 'Diffie–Hellman on a curve' }
	],
	steps: [
		// ------------------------------------------------------------------ picture
		{
			id: 'curve',
			chapter: 'picture',
			title: 'Not an ellipse',
			scene: 'real',
			hints: { phase: 'curve' },
			duration: 22,
			controls: [py],
			body: `
<p>The <a href="../cryptography/#dh-shared">Diffie–Hellman exchange</a> raised numbers to secret powers on a prime clock. Elliptic-curve cryptography keeps the idea and swaps the clock for the points of a curve. This one is y² = x³ + 7, the very equation behind Bitcoin's keys.</p>
<p>An <dfn data-def="The set of solutions of y² = x³ + ax + b (with 4a³ + 27b² ≠ 0, so that it has no cusps or crossings), plus one extra point 'at infinity'.">elliptic curve</dfn> is the set of points with y² = x³ + ax + b. Because only y² appears, it is mirror-symmetric about the x-axis: every point P has a twin −P below or above it. Drag P along the curve.</p>
<p><strong>"Elliptic" has nothing to do with ellipses.</strong> The name is inherited from elliptic integrals, which first came up in measuring the length of an ellipse's arc; these curves turned up when mathematicians studied those integrals. And this smooth picture over the real numbers is for intuition only: the cryptography will live somewhere with no curve to see.</p>`
		},
		{
			id: 'chord',
			chapter: 'picture',
			title: 'Add two points with a line',
			scene: 'real',
			hints: { phase: 'chord' },
			duration: 26,
			controls: [py, qy],
			body: `
<p>Here is the strange part: the points can be <em>added</em>. Draw the line through P and Q. A cubic meets a line in three points (counted properly), so the line hits the curve once more, at R. Mirror R in the x-axis and call the result <strong>P + Q</strong>.</p>
<p>In coordinates, with slope λ = (y<sub>Q</sub> − y<sub>P</sub>) / (x<sub>Q</sub> − x<sub>P</sub>): x<sub>P+Q</sub> = λ² − x<sub>P</sub> − x<sub>Q</sub>, and y<sub>P+Q</sub> = λ(x<sub>P</sub> − x<sub>P+Q</sub>) − y<sub>P</sub>. Only additions, multiplications and one division. Drag P and Q: as Q approaches P, the chord approaches the tangent; as Q approaches −P, the line steepens and the third point runs far beyond the picture.</p>`,
			notes: `<p>Why the mirror? Without it, "the third point on the line" would not have a neutral element. With it, the <dfn data-def="The chord-and-tangent rule for adding points on an elliptic curve; with the point at infinity as zero it makes the points a commutative group.">chord-and-tangent rule</dfn> makes the points a commutative group: P + Q = Q + P (the line doesn't care about order), and (P + Q) + R = P + (Q + R). That last law is far from obvious from the picture; it is a theorem (one proof uses Cayley–Bacharach on cubics through nine points), and this page's tests check it point by point on small curves.</p>`
		},
		{
			id: 'tangent',
			chapter: 'picture',
			title: 'Add a point to itself',
			scene: 'real',
			hints: { phase: 'tangent' },
			duration: 22,
			controls: [py],
			body: `
<p>Slide Q onto P and the chord turns into the <strong>tangent</strong> at P. It touches the curve at P (that counts twice) and crosses it once more; mirror that point and you have P + P = <strong>2P</strong>, the <dfn data-def="Adding a point to itself on an elliptic curve, using the tangent line at that point.">doubling</dfn> of P.</p>
<p>The slope is now the curve's own steepness at P, λ = 3x<sub>P</sub>² / 2y<sub>P</sub> (for y² = x³ + ax + b it is (3x<sub>P</sub>² + a) / 2y<sub>P</sub>), and the same formulas give the coordinates. Doubling is what will make multiplying a point by a large number fast.</p>`
		},
		{
			id: 'infinity',
			chapter: 'picture',
			title: 'The point at infinity',
			scene: 'real',
			hints: { phase: 'infinity' },
			duration: 22,
			controls: [py],
			body: `
<p>Add P to its mirror twin −P. The line through them is vertical and never meets the curve again. Rather than give up, add one extra point, <strong>O</strong>, "at infinity", where every vertical line is taken to end. Then P + (−P) = O.</p>
<p>O is the zero of this addition: P + O = P, because the line through P and O is the vertical through P, which meets the curve at −P, whose mirror is P. So every point has an opposite and there is a zero: the points form a <dfn data-def="A set with an operation that is associative, has a neutral element and an inverse for every element.">group</dfn>, just like the numbers on the prime clock did under multiplication. That is all Diffie–Hellman needs.</p>`,
			notes: `<p>Drag P to the x-axis, the point (−∛7, 0): there the tangent is vertical, so 2P = O, and the point is its own opposite. In projective coordinates (X : Y : Z) with x = X/Z, y = Y/Z, O is the honest point (0 : 1 : 0), and real implementations compute in such coordinates to avoid a division at every step.</p>`
		},
		// ------------------------------------------------------------------ field
		{
			id: 'field',
			chapter: 'field',
			title: 'Mod p: a scatter of points',
			scene: 'field',
			hints: { phase: 'scatter' },
			duration: 24,
			controls: [prime],
			body: `
<p>Now keep the equation and change the numbers. Over the <dfn data-def="The whole numbers 0 to p − 1 with addition and multiplication done mod p (p a prime); every number but 0 has an inverse, so division works too.">finite field</dfn> F<sub>p</sub>, x and y are whole numbers from 0 to p − 1 and y² = x³ + 7 is required to hold mod p, on a clock of p hours. The curve becomes a scatter of dots. With p = 97 there are 78 of them, plus O: 79 points.</p>
<p>The symmetry survives (y and p − y are mirror twins about the middle line), and little else. <strong>There is no curve to see here, and this is where the cryptography lives.</strong> The picture over the real numbers was the intuition; its smooth shape plays no part in the security.</p>
<p>Change p. The count is never far from p + 1: <dfn data-def="Helmut Hasse's theorem (1933): a curve over F_p has N points with |N − (p + 1)| ≤ 2√p.">Hasse's theorem</dfn> keeps it within 2√p, the band drawn under the grid.</p>`,
			notes: `<p>Why about p + 1? For each x, the right-hand side x³ + 7 is a square mod p about half the time, and then it has two square roots. So about p/2 values of x give two points each, plus O. The counts here are made by trying every x and y. For a 256-bit p that is impossible, and the count is computed by Schoof's algorithm and its successors; the standards publish it.</p>`
		},
		{
			id: 'field-add',
			chapter: 'field',
			title: 'Lines still meet in three points',
			scene: 'field',
			hints: { phase: 'add' },
			duration: 26,
			controls: [pi, qi],
			body: `
<p>The addition rule carries over word for word: the same formulas, with "divide by" meaning "multiply by the inverse mod 97". The line through P and Q becomes the 97 grid points with y ≡ λx + c (mod 97), a line that wraps around the grid like the hands of a clock, drawn as small dots.</p>
<p>Its meetings with the curve are P, Q and a third, R, counting a point twice where the line is a tangent there (then R is P or Q itself), and with O as the third for a vertical line. Mirror R (y → 97 − y) and you have P + Q, again a point of the scatter. Drag P and Q, or move the sliders: it never fails, and the group laws hold as before.</p>`
		},
		// ------------------------------------------------------------------ one way
		{
			id: 'multiply',
			chapter: 'oneway',
			title: 'Double and add',
			scene: 'multiply',
			hints: { phase: 'multiply' },
			duration: 30,
			controls: [k],
			body: `
<p>Pick a starting point G, the <dfn data-def="A fixed, public point on the curve whose multiples are used for keys.">generator</dfn>, here (1, 28). Multiplying it by a whole number k means adding it to itself: kG = G + G + … + G. With k = 53 that sounds like 52 additions, but <dfn data-def="Computing kG from the binary digits of k: double for every digit after the first, and also add G when the digit is 1. The curve's version of square-and-multiply.">double-and-add</dfn> does it in 8: 53 is 110101 in binary, so double, add, double, double, add, double, double, add.</p>
<p>It is the <a href="../cryptography/#dh-public">square-and-multiply</a> of the prime clock with "multiply" renamed "add". The work grows with the number of digits of k, not with k: a 256-bit secret takes about 255 doublings and 128 additions. Watch the steps hop across the grid.</p>`,
			notes: `<p>Real implementations don't branch on the bits of the secret, because the time an add takes can leak them. They use a <dfn data-def="A way of computing kP that does the same operations for every bit of k, swapping two running values instead of branching.">Montgomery ladder</dfn> or other constant-time methods: X25519, later on this page, uses the ladder.</p>`
		},
		{
			id: 'dlog',
			chapter: 'oneway',
			title: 'Undoing it: the discrete logarithm',
			scene: 'multiply',
			hints: { phase: 'dlog' },
			duration: 30,
			controls: [k],
			body: `
<p>Now be Eve. She sees G and the point Q = kG, and wants k: the <dfn data-def="Given points G and Q = kG on an elliptic curve over a finite field, finding k.">elliptic-curve discrete logarithm</dfn>. On the scatter, G, 2G, 3G, … jump around with no pattern (the line joins them in order), so landing on Q says nothing about how many steps it took. She tries G, 2G, 3G, … until one is Q.</p>
<p>On this toy curve that takes at most 78 tries. On secp256k1, the curve behind Bitcoin, there are about 1.16 × 10<sup>77</sup> points. The best known attack, Pollard's rho, is cleverer than trying them in order but still needs about √n ≈ 2<sup>128</sup> ≈ 3 × 10<sup>38</sup> point additions. <strong>Multiplying is quick; undoing it is out of reach</strong>, and the hardness comes from this discrete logarithm, not from the curve's shape.</p>`,
			notes: `<p>Pollard's rho walks pseudo-randomly through combinations aG + bQ until two collide, which by the birthday paradox takes about √(πn/2) steps for a plain walk, or √(πn/4) using the negation map, which identifies P with −P (<a href="https://eprint.iacr.org/2011/003">Bernstein, Lange and Schwabe, 2011</a>). A 112-bit prime-field example was solved in 2009 on a cluster of PlayStation 3 consoles, and a 114-bit one, on a curve with extra symmetries that help the attack, in 2017. Some curves are weak despite their size: if the number of points equals p ("anomalous" curves) or the curve is "supersingular", the logarithm can be moved to an easier problem, which is why standard curves are chosen with care.</p>`
		},
		// ------------------------------------------------------------------ dh
		{
			id: 'ecdh',
			chapter: 'dh',
			title: 'Diffie–Hellman with points',
			scene: 'ecdh',
			duration: 28,
			controls: [a, b],
			body: `
<p>Everything public: the curve, the field and G. Alice picks a secret a = 29 and sends A = 29G; Bob picks b = 64 and sends B = 64G. Each multiplies the other's point by their own secret: Alice computes 29B, Bob 64A. Both are 29 · 64 · G, the same point S, and its x-coordinate is shared secret material, from which a key-derivation function makes their encryption keys.</p>
<p>This is <dfn data-def="Elliptic-curve Diffie–Hellman: Diffie–Hellman with scalar multiplication of curve points in place of powers on a prime clock.">ECDH</dfn>: exactly the exchange on the prime clock, with "raise to a power" replaced by "multiply a point". Move the sliders: the two sides always agree. Eve sees G, A and B. Finding either secret (a discrete logarithm) would let her compute S; computing S straight from the public points is the <dfn data-def="Given G, aG and bG, computing abG. Solving the discrete logarithm solves it; no other way to solve it is known for well-chosen curves.">computational Diffie–Hellman problem</dfn>, and on well-chosen curves no practical way to do either is known.</p>`
		},
		{
			id: 'secp256k1',
			chapter: 'dh',
			title: 'A real curve: secp256k1',
			scene: 'standard',
			hints: { phase: 'secp' },
			duration: 24,
			body: `
<p>The same equation on a field big enough to matter. <strong>secp256k1</strong>, published in the SEC 2 standard and used for the signatures of Bitcoin and Ethereum, is y² = x³ + 7 over F<sub>p</sub> with p = 2<sup>256</sup> − 2<sup>32</sup> − 977. The standard fixes the generator G and the number of its multiples, n, a 256-bit prime; every point is a multiple of G.</p>
<p>Your browser has just checked the standard with this page's own code: G satisfies the equation mod p, and n·G, worked out by double-and-add in exact 256-bit arithmetic, is O. A private key is a number from 1 to n − 1; the public key is the point kG.</p>`,
			notes: `<p>Neal Koblitz and Victor Miller proposed elliptic curves for cryptography independently in 1985. Signatures on a curve (ECDSA, and Schnorr signatures, which Bitcoin added in 2021) use the same one-way multiplication. secp256k1's p is close to a power of 2 so that reducing mod p is cheap, and its a = 0 allows a further speed-up.</p>`
		},
		{
			id: 'x25519',
			chapter: 'dh',
			title: 'X25519, checked against the standard',
			scene: 'standard',
			hints: { phase: 'x25519' },
			duration: 26,
			body: `
<p>The key exchange behind most HTTPS connections today, on its own or paired with a post-quantum scheme, is <strong>X25519</strong>: Diffie–Hellman on Daniel Bernstein's Curve25519, y² = x³ + 486662x² + x over p = 2<sup>255</sup> − 19, standardised in RFC 7748. It is a different shape of equation, but its points add by the same chord-and-tangent rule. It works with x-coordinates alone, with a Montgomery ladder, and keys are 32 bytes.</p>
<p>The page runs the exchange of the RFC's test vector: Alice's and Bob's secret keys, their public keys, and both sides of the shared secret. The values your browser computes match the ones printed in the standard, to the last hex digit.</p>`,
			notes: `<p>X25519 is offered by almost every TLS 1.3 connection, and by SSH and the Signal protocol. Its secret keys are "clamped" before use (the low three bits cleared, so the result lands in the large prime-order subgroup despite the curve's cofactor of 8, and the top bit set, so the ladder always runs the same number of steps). The base point is the point with x = 9.</p>`
		},
		{
			id: 'sizes',
			chapter: 'dh',
			title: '256 bits instead of 3,072',
			scene: 'sizes',
			duration: 26,
			controls: [security],
			body: `
<p>Why bother, when the prime clock works? Size. For the same security, NIST's key-management guideline pairs a 256-bit curve with a <strong>3,072-bit</strong> modulus for Diffie–Hellman or RSA, and the gap widens at higher levels: 512 bits against 15,360. Change the level.</p>
<p>The difference is in the attacks. On the prime clock, the number field sieve exploits the structure of whole numbers (factoring into small primes) and runs far faster than trying, so the modulus must be huge. On a well-chosen curve no such shortcut is known; the best attack is the generic √n of Pollard's rho, so a curve of 2s bits gives s bits of security. <strong>Multiplying a point by a secret is quick, recovering the secret is not, and that lets a 256-bit curve key do the job of a 3,072-bit modular one.</strong></p>`,
			notes: `<p>Sizes from NIST SP 800-57 Part 1 Rev. 5 (2020), Table 2: 80, 112, 128, 192 and 256 bits of security for moduli of 1,024, 2,048, 3,072, 7,680 and 15,360 bits and curves of 160, 224, 256, 384 and 512 bits (the low end of each of NIST's curve ranges). Nobody has proved the curve discrete logarithm hard. A large quantum computer running Shor's algorithm would break curves and the prime clock alike, which is why the <a href="../quantum-computing/">post-quantum</a> standards of 2024 are being rolled out alongside X25519.</p>`
		}
	]
};
