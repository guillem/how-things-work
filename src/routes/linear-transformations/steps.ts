import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { num } from './matrix';

// ---- the vector v (steps 1, 2 and 4) ---------------------------------------------------
const vx: Control = {
	type: 'range',
	id: 'vx',
	label: 'v: steps right (x)',
	min: -4,
	max: 4,
	step: 0.5,
	default: 2,
	format: (v) => num(v),
	help: 'Or drag the tip of v (or focus it and use the arrow keys).'
};
const vy: Control = {
	type: 'range',
	id: 'vy',
	label: 'v: steps up (y)',
	min: -4,
	max: 4,
	step: 0.5,
	default: 1,
	format: (v) => num(v)
};

// ---- the matrix [[a, b], [c, d]]: î lands on (a, c), ĵ on (b, d) --------------------------
const entry = (id: string, label: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: -3,
	max: 3,
	step: 0.1,
	default: def,
	format: (v) => num(v),
	help
});
const matrix: Control[] = [
	entry('a', 'a: where î lands, across', 1.5),
	entry('c', 'c: where î lands, up', 0.5),
	entry('b', 'b: where ĵ lands, across', -0.5),
	entry(
		'd',
		'd: where ĵ lands, up',
		1,
		'Or drag the tips of î and ĵ on the stage (or focus one and use the arrow keys).'
	)
];

const area: Control = {
	type: 'toggle',
	id: 'area',
	label: 'Show areas',
	default: true,
	help: 'The unit square and the F, with their areas before and after.'
};
const eigenToggle: Control = {
	type: 'toggle',
	id: 'eigen',
	label: 'Show eigenvectors',
	default: true,
	help: 'The directions the matrix only stretches, with their stretch factors λ.'
};

const example: Control = {
	type: 'select',
	id: 'example',
	label: 'Example',
	default: 'rotate',
	options: [
		{ value: 'rotate', label: 'Rotate by 30°' },
		{ value: 'stretch', label: 'Stretch sideways' },
		{ value: 'shear', label: 'Shear' },
		{ value: 'mirror', label: 'Mirror' },
		{ value: 'flatten', label: 'Flatten onto a line' },
		{ value: 'identity', label: 'Do nothing (identity)' }
	],
	help: 'Then drag î and ĵ to see how each column changes it.'
};
const special: Control = {
	type: 'select',
	id: 'special',
	label: 'Example',
	default: 'rotate',
	options: [
		{ value: 'rotate', label: 'Rotate by 30°' },
		{ value: 'shear', label: 'Shear' },
		{ value: 'scale', label: 'Scale everything by 1.5' },
		{ value: 'diagonal', label: 'Mirror in the diagonal' }
	]
};
const order: Control = {
	type: 'select',
	id: 'order',
	label: 'Order',
	default: 'rs',
	options: [
		{ value: 'rs', label: 'Rotate first, then shear (SR)' },
		{ value: 'sr', label: 'Shear first, then rotate (RS)' }
	]
};

/** A 2 × 2 matrix in the narrative, e.g. m('a', 'b', 'c', 'd'). */
const m = (a: string, b: string, c: string, d: string) =>
	`<span class="mat"><span>${a}</span><span>${b}</span><span>${c}</span><span>${d}</span></span>`;
/** A column vector in the narrative. */
const col = (x: string, y: string) =>
	`<span class="mat col"><span>${x}</span><span>${y}</span></span>`;

export const spec: ExplainerSpec = {
	slug: 'linear-transformations',
	title: 'Vectors, matrices and linear transformations',
	summary:
		'Drag two arrows and watch the whole plane follow: a matrix is a transformation of space, fully determined by where it sends the basis vectors.',
	chapters: [
		{ id: 'vectors', title: 'Vectors' },
		{ id: 'transform', title: 'Transforming the plane' },
		{ id: 'area', title: 'Areas and the determinant' },
		{ id: 'eigen', title: 'Eigenvectors' },
		{ id: 'combine', title: 'Putting it together' }
	],
	steps: [
		// ------------------------------------------------------------------ vectors
		{
			id: 'arrows',
			chapter: 'vectors',
			title: 'A vector is an arrow and a pair of numbers',
			scene: 'plane',
			hints: { phase: 'arrows' },
			controls: [vx, vy],
			body: `
<p>A <dfn data-def="A quantity with a size and a direction, drawn as an arrow. In the plane it is written as a pair of numbers.">vector</dfn> is an arrow: it has a length and a direction. Put its tail at the <dfn data-def="The point (0, 0), where the two axes cross.">origin</dfn> of a grid and its tip lands on a point, so the arrow and a pair of numbers are the same thing: <strong class="tag v">v</strong> = (2, 1) means “2 steps right, 1 step up”. Negative numbers go left or down.</p>
<p>Vectors can be <strong>scaled</strong>: multiplying v by a number s multiplies both of its numbers by s. The arrow s·v stays on the same line through the origin, s times as long; a negative s turns it round. On the stage the faint arrow is s·v, with s sweeping from −1 to 2.</p>
<p>Drag the tip of v (or focus it and use the arrow keys) and watch its two numbers change.</p>`
		},
		{
			id: 'basis',
			chapter: 'vectors',
			title: 'Every vector is built from î and ĵ',
			scene: 'plane',
			hints: { phase: 'basis' },
			controls: [vx, vy],
			body: `
<p>Two vectors are special: <strong class="tag i">î</strong> = (1, 0), one step right, and <strong class="tag j">ĵ</strong> = (0, 1), one step up (read “i-hat” and “j-hat”).</p>
<p>Vectors are <strong>added</strong> tip to tail: put the second arrow's tail on the first one's tip, and the sum goes from the first tail to the last tip. So every vector can be built from î and ĵ:</p>
<p class="formula"><strong>(x, y) = x·î + y·ĵ</strong></p>
<p>x steps of î, then y steps of ĵ. For v = (2, 1): two î's and one ĵ. Because every vector is built from them in exactly one way, î and ĵ are called a <dfn data-def="A set of vectors from which every vector can be built in exactly one way by scaling and adding. î and ĵ are the standard basis of the plane.">basis</dfn> of the plane.</p>
<p>This looks like bookkeeping, but it is the key to everything that follows: know what happens to î and ĵ, and you know what happens to every vector.</p>`
		},
		// ------------------------------------------------------------------ transform
		{
			id: 'transform',
			chapter: 'transform',
			title: 'Move î and ĵ, and the whole plane follows',
			scene: 'transform',
			hints: { phase: 'drag' },
			body: `
<p>A <dfn data-def="A way of moving every point of the plane at once that keeps the origin in place and keeps grid lines straight, parallel and evenly spaced.">linear transformation</dfn> moves every point of the plane at once, following three rules: the origin stays put, straight lines stay straight, and parallel, evenly spaced lines stay parallel and evenly spaced.</p>
<p>Watch the grid move at the start: the squares become identical <dfn data-def="A four-sided shape whose opposite sides are parallel and equal in length.">parallelograms</dfn>. The faint grid behind is where the plane was.</p>
<p>Now drag the tips of <strong class="tag i">î</strong> and <strong class="tag j">ĵ</strong> (or focus one with Tab and use the arrow keys; Shift for bigger steps). The grid and the <strong class="tag f">F</strong> drawn on it go along. You can turn the plane, stretch it, lean it over or flip it, but never bend it.</p>`,
			notes: `<p>Why “linear”? Because these are exactly the moves that respect scaling and adding: transforming s·v gives s times the transformed v, and transforming v + w gives the sum of the transformed vectors. That is what keeps grid lines straight and evenly spaced. Moves that also shift the origin, such as sliding the whole plane sideways, are called <em>affine</em>; they are a linear transformation followed by a shift.</p>`
		},
		{
			id: 'follow',
			chapter: 'transform',
			title: 'Where î and ĵ land decides everything',
			scene: 'transform',
			hints: { phase: 'follow' },
			controls: [vx, vy],
			body: `
<p>Before the move, <strong class="tag v">v</strong> = x·î + y·ĵ. A linear transformation keeps scaling and adding intact, so afterwards v is still “x of î plus y of ĵ” — only with î and ĵ where they have landed:</p>
<p class="formula"><strong>v lands on x·(where î lands) + y·(where ĵ lands)</strong></p>
<p>On the stage, v is drawn faintly where it was and in full where it lands, built tip to tail from x copies of the moved î and y copies of the moved ĵ. Drag î or ĵ, or change v with the sliders: the recipe never changes, only the ingredients.</p>
<p>So a whole transformation of the plane is pinned down by just four numbers: where î lands (two numbers) and where ĵ lands (two more).</p>`
		},
		{
			id: 'matrix',
			chapter: 'transform',
			title: 'The matrix: where î and ĵ land, side by side',
			scene: 'transform',
			hints: { phase: 'matrix' },
			controls: matrix,
			body: `
<p>Write those four numbers in a square, with where <strong class="tag i">î</strong> lands as the first column and where <strong class="tag j">ĵ</strong> lands as the second. That square is a 2 × 2 <dfn data-def="A rectangular table of numbers. A 2 × 2 matrix has 2 rows and 2 columns and describes a linear transformation of the plane.">matrix</dfn>: ${m('a', 'b', 'c', 'd')}. It sends î to (a, c) and ĵ to (b, d).</p>
<p>Multiplying the matrix by a vector is the recipe of the last step, in numbers:</p>
<p class="formula">${m('a', 'b', 'c', 'd')} ${col('x', 'y')} = x ${col('a', 'c')} + y ${col('b', 'd')} = ${col('ax + by', 'cx + dy')}</p>
<p>The stage works it out for v. Change the entries with the sliders and watch î, ĵ and the grid move — or drag the arrows and watch the numbers change. It is the same thing either way: a matrix is a transformation, written down.</p>`,
			notes: `<p>The same idea works in any number of dimensions. A 3 × 3 matrix holds where the three basis vectors of space land, one per column. Computer graphics moves every corner of a 3D scene this way, many millions of times a second; it uses 4 × 4 matrices so that the same multiplication can also shift objects and add perspective.</p>`
		},
		{
			id: 'gallery',
			chapter: 'transform',
			title: 'A gallery of transformations',
			scene: 'transform',
			hints: { phase: 'gallery', load: 'example' },
			controls: [example],
			body: `
<p>Pick an example from the menu, and read its two columns as “where î lands” and “where ĵ lands”:</p>
<ul>
<li><strong>Rotate by 30°</strong>: î turns to about (0.87, 0.5) and ĵ to (−0.5, 0.87). Lengths and angles are kept.</li>
<li><strong>Stretch sideways</strong>: î doubles to (2, 0) and ĵ stays put. Every horizontal distance doubles.</li>
<li><strong>Shear</strong>: î stays, ĵ slides over to (1, 1). The squares lean over like a pushed deck of cards.</li>
<li><strong>Mirror</strong>: î flips to (−1, 0). The F appears back to front.</li>
<li><strong>Flatten onto a line</strong>: î lands on (1, 0.5) and ĵ on (2, 1), on the same line through the origin, so the whole plane is squashed onto that line.</li>
<li><strong>Do nothing</strong>: the <dfn data-def="The matrix with 1s on the diagonal and 0s elsewhere: it leaves every vector where it is.">identity matrix</dfn> ${m('1', '0', '0', '1')}.</li>
</ul>`
		},
		// ------------------------------------------------------------------ area
		{
			id: 'determinant',
			chapter: 'area',
			title: 'The determinant: how much areas grow',
			scene: 'transform',
			hints: { phase: 'area', load: 'area' },
			controls: [area],
			body: `
<p>The square with sides î and ĵ has area 1. The transformation turns it into the parallelogram with sides where î and ĵ land (shaded). Its area is the <dfn data-def="For a 2 × 2 matrix (a b; c d), the number ad − bc: the factor by which the transformation multiplies every area. It is negative when the transformation flips the plane over.">determinant</dfn> of the matrix:</p>
<p class="formula"><strong>det ${m('a', 'b', 'c', 'd')} = ad − bc</strong></p>
<p>The stage starts with î landing on (2, 0) and ĵ on (1, 1.5): a parallelogram with base 2 and height 1.5, so area 3 — and ad − bc = 2 × 1.5 − 1 × 0 = 3.</p>
<p>Every square of the grid becomes an identical copy of that parallelogram, so <em>every</em> area is multiplied by the same factor: the area of the F grows by exactly the determinant too. Drag î or ĵ and compare the numbers.</p>`,
			notes: `<p>Where does ad − bc come from? When both columns point into the top-right quarter, with ĵ to the left of î, the parallelogram fits in a box (a + b) wide and (c + d) tall. The box's corners outside the parallelogram are two triangles of area ac/2, two of area bd/2 and two rectangles of area bc. Take them away: (a + b)(c + d) − ac − bd − 2bc = ad − bc.</p>`
		},
		{
			id: 'flip',
			chapter: 'area',
			title: 'Negative and zero: flipped and flattened',
			scene: 'transform',
			hints: { phase: 'flip', load: 'flip' },
			controls: [area],
			body: `
<p>The stage now starts with î landing on (0.5, 1.5) and ĵ on (1.5, 0.5). Watch the start: as the plane moves, the F gets thinner, is squashed flat and then opens out again — mirrored. Normally ĵ is a quarter turn anticlockwise from î; now it is clockwise of î. The plane has been turned over, like a page.</p>
<p>The determinant records this with its sign: ad − bc = 0.5 × 0.5 − 1.5 × 1.5 = −2. Areas are doubled (|−2| = 2), and the minus sign says the <dfn data-def="Which way round a shape's corners run: anticlockwise or clockwise. A transformation with a negative determinant reverses it.">orientation</dfn> is flipped.</p>
<p>At the moment the F was flat, the determinant was 0. Drag ĵ onto the line through î to get there yourself: the whole plane is squashed onto a line (or, if both arrows land on the origin, onto a single point). Many points then land on the same spot, so nothing can undo the move: a matrix with determinant 0 has no <dfn data-def="The transformation that undoes another one. A 2 × 2 matrix has an inverse exactly when its determinant is not 0.">inverse</dfn>.</p>`
		},
		// ------------------------------------------------------------------ eigen
		{
			id: 'eigenvectors',
			chapter: 'eigen',
			title: 'Eigenvectors: directions that only stretch',
			scene: 'transform',
			hints: { phase: 'eigen', load: 'eigen' },
			controls: [eigenToggle],
			body: `
<p>Most vectors are knocked off their own line by a transformation. On the stage a thin arrow sweeps round, and the bold arrow is where the matrix sends it: they usually point in different directions.</p>
<p>But some directions are special: a vector along them lands on its own line, only stretched, shrunk or reversed. These are the <dfn data-def="A non-zero vector that a transformation only scales: Mv = λv.">eigenvectors</dfn> of the matrix, and the stretch factor is the <dfn data-def="The factor λ by which a transformation scales its eigenvector. A negative λ reverses it.">eigenvalue</dfn> λ (lambda):</p>
<p class="formula"><strong>M v = λ v</strong></p>
<p>Turn on <em>Show eigenvectors</em>. The stage starts with ${m('2', '1', '0.5', '1.5')}: arrows along (2, 1) are stretched 2.5 times, and arrows along (1, −1) are left exactly as they are (λ = 1). When the sweeping arrow passes over one of these lines, its image lines up with it. Drag î and ĵ and the eigen-directions move.</p>`,
			notes: `<p>To find them, look for the λ for which M − λI squashes some direction to zero, which means det(M − λI) = 0. For a 2 × 2 matrix that is λ² − (a + d)λ + (ad − bc) = 0. Here: λ² − 3.5λ + 2.5 = 0, so λ = 2.5 or λ = 1. A quadratic can have two, one or no real solutions — which is the next step.</p>`
		},
		{
			id: 'no-eigen',
			chapter: 'eigen',
			title: 'Two, one, none or all',
			scene: 'transform',
			hints: { phase: 'special', load: 'special' },
			controls: [special, eigenToggle],
			body: `
<p>Not every matrix has two eigen-directions. Pick an example:</p>
<ul>
<li>A <strong>rotation</strong> by 30° turns every arrow by 30°, so none stays on its line: no eigenvectors at all. (The eigenvalue equation has no real solutions, only complex ones.)</li>
<li>A <strong>shear</strong> has just one eigen-direction: arrows along the <i>x</i>-axis stay where they are (λ = 1); every other arrow leans over.</li>
<li><strong>Scaling everything by 1.5</strong> stretches every arrow by 1.5: every direction is an eigen-direction.</li>
<li>A <strong>mirror in the diagonal</strong> keeps arrows along the mirror line (λ = 1) and reverses arrows at right angles to it (λ = −1): reversed, but still on their own line.</li>
</ul>`
		},
		{
			id: 'repeat',
			chapter: 'eigen',
			title: 'Again and again: how PageRank finds an eigenvector',
			scene: 'transform',
			hints: { phase: 'repeat', load: 'eigen' },
			controls: [eigenToggle],
			body: `
<p>Apply a matrix to a vector, then apply it again to the result, and again: v, Mv, M²v, … The lengths soon grow too fast to draw, so the stage draws each one's <em>direction</em> at the same length and lists the lengths beside it.</p>
<p>Any starting vector is a mix of the two eigenvectors. Each round stretches its part along (2, 1) by 2.5 but its part along (1, −1) only by 1, so the first part soon swamps the second: after a few rounds the arrow lies along the eigen-direction with the biggest stretch, and from then on simply grows 2.5 times per round. This is the <dfn data-def="Finding the eigenvector with the biggest eigenvalue by applying the matrix over and over to a starting vector.">power method</dfn>.</p>
<p>It is how Google's <strong>PageRank</strong> is computed: the ranks of all the pages of the web form an eigenvector of one enormous matrix built from the links between them, found by applying that matrix over and over. Drag î and ĵ into a rotation and the arrow never settles: there is no eigen-direction to find.</p>`
		},
		// ------------------------------------------------------------------ combine
		{
			id: 'compose',
			chapter: 'combine',
			title: 'One after another: multiplying matrices',
			scene: 'transform',
			hints: { phase: 'compose' },
			duration: 16,
			controls: [order],
			body: `
<p>Do one transformation and then another, and the result is again a linear transformation, with its own matrix: the <dfn data-def="The matrix of “first N, then M”, written MN: the one applied first stands on the right, next to the vector.">product</dfn> of the two.</p>
<p>The stage rotates the plane a quarter turn, R = ${m('0', '−1', '1', '0')}, then shears it, S = ${m('1', '1', '0', '1')}. To find the product SR, follow î and ĵ: the rotation sends î to (0, 1) and the shear sends that on to (1, 1); ĵ goes to (−1, 0), which the shear leaves where it is. So SR = ${m('1', '−1', '1', '0')}.</p>
<p>Now switch the order. Shear first: î stays at (1, 0) and ĵ goes to (1, 1); the rotation then sends them to (0, 1) and (−1, 1), so RS = ${m('0', '−1', '1', '1')} — a different transformation. Order matters. Determinants, on the other hand, simply multiply, det(SR) = det S × det R, because areas are scaled by one and then by the other.</p>`
		},
		{
			id: 'takeaway',
			chapter: 'combine',
			title: 'A matrix is a transformation',
			scene: 'transform',
			hints: { phase: 'all' },
			controls: [area, eigenToggle],
			body: `
<p>Everything on this page came from two arrows. Drag î and ĵ anywhere: the grid, the F, the matrix, the determinant and the eigenvectors all follow, because where the two basis vectors land fixes where every other vector lands.</p>
<p>That is the idea to keep: <strong>a matrix is a transformation of space, and its columns are where it sends the basis vectors</strong>. Its determinant says how it scales areas, and whether it flips them over; its eigenvectors are the directions it only stretches.</p>
<p>The same holds in any number of dimensions: a 3 × 3 matrix moves 3D space by moving three basis arrows. Computer graphics, physics, statistics and machine learning all run on this idea, with matrices far bigger than 2 × 2.</p>`
		}
	]
};
