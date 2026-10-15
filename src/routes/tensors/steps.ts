import type { Control, ExplainerSpec, Params } from '#lib/explainer/index.ts';
import { num } from './tensor';

// ---- the grown block (step "block") ----------------------------------------------------
const axes: Control = {
	type: 'range',
	id: 'axes',
	label: 'Number of axes',
	min: 0,
	max: 3,
	step: 1,
	default: 3,
	format: (v) => `${v}: ${['a scalar', 'a vector', 'a matrix', 'a 3D block'][v] ?? ''}`,
	help: 'Grow a single number into a vector, a matrix and a block, or shrink it back.'
};
const len = (id: string, label: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: 1,
	max: 5,
	step: 1,
	default: def,
	help
});
const lengths: Control[] = [
	len('n0', 'Number of layers', 2),
	len('n1', 'Number of rows', 3),
	len(
		'n2',
		'Number of columns',
		4,
		'Or drag the handles at the ends of the axes. An axis exists only while the block has that many axes.'
	)
];

// ---- the photograph -------------------------------------------------------------------
const row: Control = {
	type: 'range',
	id: 'row',
	label: 'Pixel row (axis 0)',
	min: 0,
	max: 47,
	step: 1,
	default: 24,
	help: 'Or drag the marker on the picture.'
};
const col: Control = {
	type: 'range',
	id: 'col',
	label: 'Pixel column (axis 1)',
	min: 0,
	max: 35,
	step: 1,
	default: 22
};
const AXIS_LENGTHS: Record<string, number> = { height: 48, width: 36, channel: 3 };
const sliceAxis: Control = {
	type: 'select',
	id: 'sliceAxis',
	label: 'Slice along',
	default: 'channel',
	options: [
		{ value: 'height', label: 'Axis 0: height (one row)' },
		{ value: 'width', label: 'Axis 1: width (one column)' },
		{ value: 'channel', label: 'Axis 2: channel (one colour)' }
	]
};
const sliceAt: Control = {
	type: 'range',
	id: 'sliceAt',
	label: 'At index',
	min: 0,
	max: 47,
	bounds: (p: Params) => [0, (AXIS_LENGTHS[String(p.sliceAxis ?? 'channel')] ?? 48) - 1],
	step: 1,
	default: 0,
	help: 'Or drag the slice through the block.'
};
const shape: Control = {
	type: 'select',
	id: 'shape',
	label: 'Read the numbers as',
	default: 'pixels',
	options: [
		{ value: 'image', label: '(48, 36, 3): the picture' },
		{ value: 'pixels', label: '(1728, 3): a list of pixels' },
		{ value: 'flat', label: '(5184,): one long list' },
		{ value: 'reshape3', label: 'reshape to (3, 48, 36)' },
		{ value: 'transpose', label: 'transpose to (3, 48, 36)' }
	]
};

// ---- matrix × vector --------------------------------------------------------------------
const vlen: Control = {
	type: 'select',
	id: 'vlen',
	label: 'The vector',
	default: 'match',
	options: [
		{ value: 'match', label: '4 numbers: the axes match' },
		{ value: 'short', label: '3 numbers: they don’t' }
	]
};

// ---- grey -----------------------------------------------------------------------------
const weight = (id: string, label: string, def: number, help?: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0,
	max: 1,
	step: 0.001,
	default: def,
	format: (v) => num(v, 3),
	help
});
const weights: Control[] = [
	weight('wr', 'Weight of red', 0.299),
	weight('wg', 'Weight of green', 0.587),
	weight(
		'wb',
		'Weight of blue',
		0.114,
		'The defaults are the BT.601 luma weights. Try 1, 0, 0: the grey picture is then just the red channel.'
	)
];
const combineAxes: Control = {
	type: 'select',
	id: 'combine',
	label: 'Average away',
	default: 'hw',
	options: [
		{ value: 'c', label: 'the channels: keep (48, 36)' },
		{ value: 'h', label: 'the height: keep (36, 3)' },
		{ value: 'w', label: 'the width: keep (48, 3)' },
		{ value: 'hw', label: 'height and width: keep (3,)' },
		{ value: 'hwc', label: 'all three: keep ()' }
	]
};

// ---- physics --------------------------------------------------------------------------
const theta: Control = {
	type: 'range',
	id: 'theta',
	label: 'Turn the axes by θ',
	min: -180,
	max: 180,
	step: 0.5,
	default: -20,
	unit: '°',
	help: 'Or drag the end of the x′ axis (or focus it and use the arrow keys).'
};
const cut: Control = {
	type: 'range',
	id: 'cut',
	label: 'Direction of the cut’s normal n',
	min: -180,
	max: 180,
	step: 1,
	default: 0,
	unit: '°',
	help: 'Or drag the tip of n.'
};

/** A small matrix in the narrative: m(2, 'a', 'b', 'c', 'd'), filled row by row. */
const m = (cols: number, ...cells: string[]) =>
	`<span class="mat" style="--cols:${cols}">${cells.map((c) => `<span>${c}</span>`).join('')}</span>`;

export const spec: ExplainerSpec = {
	slug: 'tensors',
	title: 'Tensors: numbers with axes',
	summary:
		'Grow a number into a vector, a matrix and a block, slice and reshape a real photograph as a 48 × 36 × 3 block of numbers, multiply along matching axes, then turn the coordinate axes and see what a physicist means by a tensor.',
	chapters: [
		{ id: 'axes', title: 'Axes' },
		{ id: 'image', title: 'A picture is a block' },
		{ id: 'combine', title: 'Keep or combine' },
		{ id: 'physics', title: 'Tensors in physics' }
	],
	steps: [
		// ------------------------------------------------------------------ axes
		{
			id: 'scalar',
			chapter: 'axes',
			title: 'One number: no axes at all',
			scene: 'grow',
			hints: { axes: 0 },
			body: `
<p>Start with a single number, say 7: a price, a temperature, anything. To read it you don't have to say <em>which</em> number you mean: there is only one. In the language of computing it is a <dfn data-def="A single number. As a tensor it has no axes, and its shape is the empty list ().">scalar</dfn>, a tensor with <strong>no axes</strong>, and its <dfn data-def="The list of how many numbers there are along each axis of a tensor. A 3 × 4 matrix has shape (3, 4).">shape</dfn> is the empty list, written ().</p>
<p>This page is about <dfn data-def="In computing: an array of numbers arranged along some number of axes (0, 1, 2, 3 or more). In physics the word also means a quantity whose numbers change by a fixed rule when the coordinate axes change.">tensors</dfn> as programmers use the word, in libraries such as NumPy and PyTorch: arrays of numbers laid out along some number of axes. The last chapter shows what a physicist adds to that.</p>`
		},
		{
			id: 'vector',
			chapter: 'axes',
			title: 'A row of numbers: one axis',
			scene: 'grow',
			hints: { axes: 1 },
			body: `
<p>Put several numbers in a row and you need one number to say which one you mean: its <dfn data-def="The position of a number along an axis, counted from 0 in most programming languages.">index</dfn>, counted from 0. The row has one <dfn data-def="A direction along which the numbers of a tensor are laid out. Picking a number needs one index per axis.">axis</dfn>, and its shape is (4,): four numbers along that axis. This is a <strong>vector</strong>, like the arrows of <a href="../linear-transformations/">linear transformations</a>, where v = (2, 1) was two numbers.</p>
<p>A word of warning: a vector of four numbers is often called “four-dimensional”, because it describes a point in a 4D space, yet as an array it has just <strong>one axis</strong>. Libraries also say “dimension” for an axis (NumPy's <code>ndim</code> is the number of axes), so the same word means two things. On this page, <em>axes</em> counts the directions of the array and <em>length</em> the numbers along each one.</p>`
		},
		{
			id: 'matrix',
			chapter: 'axes',
			title: 'A table: two axes',
			scene: 'grow',
			hints: { axes: 2 },
			body: `
<p>Stack three such rows and you have a table, a <strong>matrix</strong>, of shape (3, 4): 3 rows along axis 0, and 4 numbers in each row along axis 1. Picking a number now takes two indices, row and column: M[1, 2] is row 1, column 2 (both counted from 0). The frame on the stage walks through the numbers one by one and the panel reads their indices.</p>
<p>The 2 × 2 matrices of <a href="../linear-transformations/">linear transformations</a> are tensors of this kind: two axes, each of length 2. There, a matrix was a transformation of the plane; here we only care that it is a grid of numbers with two axes. Both views will come back.</p>`
		},
		{
			id: 'block',
			chapter: 'axes',
			title: 'A block: three axes, and more',
			scene: 'grow',
			hints: { axes: 3 },
			controls: [axes, ...lengths],
			body: `
<p>Stack two matrices one behind the other and the block has three axes: shape (2, 3, 4), and three indices pick one number, such as B[1, 0, 3] (layer 1, the one behind; row 0; column 3). Nothing stops there: a fourth axis would be a row of blocks, a fifth a table of blocks, and so on. A tensor is just numbers laid out along any number of axes.</p>
<p>So <strong>scalars, vectors and matrices are tensors with 0, 1 and 2 axes</strong>. Grow and shrink the block with the sliders, or drag the handles at the ends of the axes: the total count of numbers is always the product of the lengths, 2 × 3 × 4 = 24 here.</p>`,
			notes: `<p>The number of axes goes by several names: NumPy's <code>ndim</code>, PyTorch's <code>dim()</code>, the <em>order</em> of the tensor, and often its <em>rank</em>. That last one clashes with the rank of a matrix in linear algebra (how many independent directions it keeps: a 3 × 4 matrix has matrix rank anywhere from 0 to 3, but always 2 axes), so this page avoids it.</p>`
		},
		// ------------------------------------------------------------------ image
		{
			id: 'image',
			chapter: 'image',
			title: 'A colour photo is a height × width × channel block',
			scene: 'image',
			hints: { phase: 'image' },
			controls: [row, col],
			body: `
<p>Here is a real photograph, a scarlet macaw, shrunk to 48 × 36 pixels so that each one stays visible. A screen makes every pixel from red, green and blue light, so the picture is stored as three numbers per pixel, each from 0 (none of that colour) to 255 (full).</p>
<p>That makes it a tensor with three axes: <strong>height</strong> (48 rows), <strong>width</strong> (36 columns) and <strong>channel</strong> (3 colours). Its shape is (48, 36, 3), 48 × 36 × 3 = 5184 numbers. Watch the picture come apart into its three <dfn data-def="One of the colour layers of an image: red, green or blue. Each holds one number per pixel.">channels</dfn>: the red feathers are bright in the red layer and nearly black in the other two, the yellow feathers are bright in both red and green, and the blue feathers of the tail are brightest in the blue one. The leaves behind the bird are only mid-grey, even in the green layer.</p>
<p>Drag the marker to pick a pixel: two indices (row and column) leave three numbers, the pixel's colour.</p>`,
			notes: `<p>The photograph is “Scarlet Macaw” by Adrian Pingstone (public domain, Wikimedia Commons), averaged down from 750 × 1002 pixels. Most image libraries store pictures this way, height first and channels last; PyTorch prefers channels first, (3, 48, 36), and a batch of 32 pictures for a neural network is a tensor with four axes, (32, 3, 48, 36).</p>`
		},
		{
			id: 'slice',
			chapter: 'image',
			title: 'Slice along any axis',
			scene: 'image',
			hints: { phase: 'slice' },
			controls: [sliceAxis, sliceAt],
			body: `
<p>Fix one index and let the others run: that is a <dfn data-def="The part of a tensor where one index is fixed. It has one axis fewer than the tensor.">slice</dfn>. It has one axis fewer than the block.</p>
<ul>
<li>Fix the <strong>channel</strong>: one colour layer, a 48 × 36 matrix of numbers. In NumPy, <code>img[:, :, 0]</code> is the red one (the colon means “all of this axis”).</li>
<li>Fix the <strong>height</strong> index: one row of the picture, 36 pixels × 3 colours, shape (36, 3): <code>img[30, :, :]</code>.</li>
<li>Fix the <strong>width</strong> index: one column, shape (48, 3).</li>
</ul>
<p>Pick an axis and slide through the block. Slicing again drops another axis, and fixing all three indices leaves a single number: a scalar, shape ().</p>`
		},
		{
			id: 'reshape',
			chapter: 'image',
			title: 'Reshape: the same numbers, read another way',
			scene: 'image',
			hints: { phase: 'reshape' },
			controls: [shape],
			body: `
<p>In memory, a tensor is just one long list. The 5184 numbers of the photo are stored pixel by pixel along each row, and row after row: red, green, blue of pixel (0, 0), then of pixel (0, 1), and so on. The shape only tells the computer how to read the list. To <dfn data-def="To give a tensor a new shape with the same number of numbers, leaving the stored list unchanged.">reshape</dfn> is to keep the list and change the shape, as long as the lengths still multiply to 5184.</p>
<ul>
<li><strong>(1728, 3)</strong>: a matrix with one row per pixel, the form you use to treat every pixel alike.</li>
<li><strong>(5184,)</strong>: one long vector, the form a simple neural network takes as input.</li>
<li><strong>reshape to (3, 48, 36)</strong>: the right shape for channels first, but the wrong picture. The list is chopped into three pieces of 1728 that each mix red, green and blue. That is a classic bug.</li>
<li><strong>transpose to (3, 48, 36)</strong>: <dfn data-def="To reorder the axes of a tensor, moving the numbers so that each keeps its meaning: element (i, j, k) of the picture becomes element (k, i, j).">transposing</dfn> reorders the axes and moves the numbers with them, so each layer really is one colour.</li>
</ul>`
		},
		// ------------------------------------------------------------------ combine
		{
			id: 'matvec',
			chapter: 'combine',
			title: 'Matrix times vector: match one axis, sum it away',
			scene: 'matvec',
			hints: { phase: 'matvec' },
			controls: [vlen],
			body: `
<p>Now the operations that combine numbers. Multiplying a matrix by a vector, as in <a href="../linear-transformations/">linear transformations</a>, works along one axis: each row of the matrix is laid against the vector, matching numbers are multiplied, and the products are added up.</p>
<p class="formula">${m(4, '1', '2', '0', '−1', '0', '1', '3', '2', '2', '−1', '1', '0')} ${m(1, '2', '1', '−1', '3')} = ${m(1, '1', '4', '2')}</p>
<p>Look at the axes on the stage. The matrix's <strong class="tag combine">columns</strong> axis (length 4) meets the vector's only axis (length 4): they must have the same length, and that axis is <em>summed away</em>. The <strong class="tag keep">rows</strong> axis (length 3) is <em>kept</em>, so the answer has shape (3,). In short, (3, <strong class="tag combine">4</strong>) times (<strong class="tag combine">4</strong>,) gives (3,).</p>
<p>Switch to a vector of 3 numbers: the lengths along the shared axis no longer match, and there is nothing to multiply the fourth column by. A library refuses with a “shapes not aligned” error.</p>`,
			notes: `<p>Many libraries write such an operation as a string of axis letters, <code>einsum('ij,j->i', M, v)</code>: the letter that appears in both inputs and not in the output (j) is multiplied and summed; the ones left in the output (i) are kept. A matrix product is <code>'ij,jk->ik'</code>, and the sum over the channels on the next step is <code>'hwc,c->hw'</code>.</p>`
		},
		{
			id: 'grey',
			chapter: 'combine',
			title: 'The same move on the photo: colour to grey',
			scene: 'image',
			hints: { phase: 'grey' },
			controls: weights,
			body: `
<p>To turn the photo grey, give each channel a weight and add up, pixel by pixel: grey = 0.299 × red + 0.587 × green + 0.114 × blue. These are the <dfn data-def="Weights for the brightness of a pixel from its red, green and blue values, from the television standard ITU-R BT.601. Green gets the most weight because the eye is most sensitive to it.">BT.601 luma weights</dfn>, still the classic recipe; green weighs most because the eye is most sensitive to it, and the weights add up to 1, so white stays white.</p>
<p>It is the matrix–vector product again. The image has shape (48, 36, <strong class="tag combine">3</strong>) and the weights (<strong class="tag combine">3</strong>,): the <strong class="tag combine">channel</strong> axis matches and is summed away; <strong class="tag keep">height</strong> and <strong class="tag keep">width</strong> are kept. The result is a (48, 36) grey picture.</p>
<p>Change the weights. With 1, 0, 0 the grey picture is just the red channel, and the red parrot glows. With 0, 1, 0 the red feathers go dark and the yellow ones stay bright, while the leaves are only mid-grey: their green values are smaller than you might think.</p>`,
			notes: `<p>The weights are applied to the stored (gamma-encoded) values, which is what BT.601 specifies and what most simple converters do. Weighing true light intensities instead would mean undoing the sRGB encoding first; the result looks a little different. Strictly, sRGB pictures use the primaries of BT.709, whose weights are 0.2126, 0.7152 and 0.0722; the 601 weights remain the common default.</p>`
		},
		{
			id: 'average',
			chapter: 'combine',
			title: 'Which axes to keep, which to combine',
			scene: 'image',
			hints: { phase: 'average' },
			controls: [combineAxes],
			body: `
<p>Adding up or averaging is another way to combine an axis. Choose which axes of the photo to average away:</p>
<ul>
<li>the <strong>channels</strong>: a (48, 36) grey picture (with equal weights this time);</li>
<li>the <strong>height</strong>: each column's average colour, shape (36, 3);</li>
<li>the <strong>width</strong>: each row's average colour, shape (48, 3);</li>
<li><strong>height and width</strong>: the photo's average colour, three numbers;</li>
<li><strong>all three</strong>: one number, the average brightness.</li>
</ul>
<p>Slicing, reshaping, products and averages are all choices about axes: <strong>which to keep and which to combine</strong>. A neural network is built mostly from these operations, plus simple nonlinear functions, applied to tensors with millions of numbers, which is why graphics chips, built to do thousands of multiply-and-adds at once, run it so well.</p>`
		},
		// ------------------------------------------------------------------ physics
		{
			id: 'axes-turn',
			chapter: 'physics',
			title: 'In physics, the numbers depend on your axes',
			scene: 'frame',
			hints: { phase: 'arrow' },
			controls: [theta],
			body: `
<p>Physicists used the word first, and they mean something more. Take a force: an arrow of 5 newtons, pointing up and to the right. Measured along the usual axes x and y it is the pair (4, 3) N. But nothing in nature chose those axes. Turn your axes by an angle θ, to x′ and y′, and the same arrow is described by other numbers.</p>
<p>The rule is fixed. With R the rotation by θ from <a href="../linear-transformations/">linear transformations</a>, the new numbers are</p>
<p class="formula"><strong>F′ = Rᵀ F</strong></p>
<p>(Rᵀ, R <dfn data-def="The matrix with its rows and columns swapped. For a rotation it is the rotation the other way, which undoes it.">transposed</dfn>, turns the other way: turning the axes forward is like turning the arrow back). Drag the end of the x′ axis: the arrow stays put, its two numbers change, and its length, √(F′x² + F′y²) = 5 N, never does. Turn by 180° and both numbers flip sign.</p>`
		},
		{
			id: 'stress',
			chapter: 'physics',
			title: 'The stress tensor: put in a direction, get a force',
			scene: 'frame',
			hints: { phase: 'stress' },
			controls: [cut],
			body: `
<p>Inside a loaded steel plate, every bit of material pushes and pulls on its neighbours. How hard depends on the direction you look in. Imagine a cut through the plate whose <dfn data-def="The unit arrow at right angles to a surface, pointing out of it.">normal</dfn> n points in some direction: the material on the side n points to pulls on the cut with a force per area, the <dfn data-def="The force per unit area acting across a cut through a material, in MPa (newtons per square millimetre). It is a vector: it can pull straight out, slide along the cut, or both.">traction</dfn> t. The <dfn data-def="The 3 × 3 (in a flat plate 2 × 2) table σ that gives the force per area on a cut through a material from the cut's normal: t = σ n. Its components change by σ′ = Rᵀ σ R when the axes turn.">stress tensor</dfn> σ is the machine that gives t for any n:</p>
<p class="formula"><strong>t = σ n</strong>, &nbsp; σ = ${m(2, 'σxx', 'τxy', 'τxy', 'σyy')} = ${m(2, '80', '30', '30', '20')} MPa</p>
<p>Here σxx = 80 MPa (megapascals, newtons per square millimetre) pulls along x, σyy = 20 MPa along y, and the shear τxy = 30 MPa slides neighbouring layers past each other; ordinary structural steel starts to yield at about 250 MPa. Turn the cut: t is rarely parallel to n, because the shear drags it sideways. The stress-tensor matrix eats one direction and returns an arrow; its two axes stand for the two directions involved.</p>`,
			notes: `<p>Read as a <dfn data-def="A function of several vectors that is linear in each one separately: double one input and the output doubles.">multilinear</dfn> map, σ takes two directions and gives a number: m · (σ n) is the force per area, on the cut with normal n, in the direction m. Double either arrow and the answer doubles. This is the general definition: a tensor with k indices is a machine that is linear in each of k directions. In a solid body σ is 3 × 3; the page uses <em>plane stress</em>, the 2 × 2 part that matters in a thin plate loaded in its own plane. σ is symmetric (τxy = τyx) because otherwise each tiny square would spin.</p>`
		},
		{
			id: 'rotate',
			chapter: 'physics',
			title: 'Turn the axes: the rule for two axes',
			scene: 'frame',
			hints: { phase: 'rotate' },
			controls: [theta],
			body: `
<p>Describe the same stress in turned axes and its four numbers change, with one factor of R for each of its two indices (its two array axes):</p>
<p class="formula"><strong>σ′ = Rᵀ σ R</strong></p>
<p>On the stage, the little square of material is drawn along x′ and y′, with the stresses on its faces. Drag the axes round. σ′ changes, but some things never do: σ′xx + σ′yy = 100 MPa, and the determinant σ′xx σ′yy − τ′xy² = 700 MPa², because the material and its load haven't changed, only the description.</p>
<p>At θ = 22.5° the shear vanishes. These are the <dfn data-def="The axes in which the stress tensor has no shear. The stresses along them, the principal stresses, are the largest and smallest normal stresses in the material at that point.">principal axes</dfn>: pure pulls of 92.4 and 7.6 MPa, the largest and smallest normal stresses on any cut through that point, and the eigenvalues of σ. Engineers start from them when they check whether the steel will hold. Turn by 180°: an arrow's components flip sign, but every component of σ comes back unchanged, because it picks up the sign twice.</p>`,
			notes: `<p>For rotations, Rᵀ undoes R, so σ′ = R⁻¹ σ R as well: the same rule as changing the basis of the matrix of a linear transformation. For skewed axes the two rules differ, and physicists keep track with upper and lower indices: a quantity that eats arrows (like σ read as m · σ n) changes as Pᵀ σ P, while a transformation changes as P⁻¹ M P. In the general theory a tensor is defined by such a rule, one factor per index.</p>`
		},
		{
			id: 'meanings',
			chapter: 'physics',
			title: 'Two meanings of one word',
			scene: 'frame',
			hints: { phase: 'meanings' },
			controls: [theta],
			body: `
<p>So “tensor” means two related things:</p>
<ul>
<li>In <strong>computing</strong>, any array of numbers with axes: the photo, a batch of photos, the weights of a neural network. Operations are choices about which axes to keep and which to combine.</li>
<li>In <strong>physics</strong>, a quantity whose numbers follow a fixed rule when the coordinate axes turn: one factor of R per index. Stress, the inertia of a spinning body, and the curvature of spacetime in general relativity are tensors in this sense.</li>
</ul>
<p>Turn the axes once more. The stress components change by the rule. The colour of a pixel, (red, green, blue), is an array with one axis too, but that axis lists colours, not directions in space. Turning the axes does not mix its numbers the way it mixed F's, so it is not a vector in the physicist's sense, just three separate numbers. Every physics tensor can be stored as an array, but not every array is a physics tensor.</p>`
		}
	]
};
