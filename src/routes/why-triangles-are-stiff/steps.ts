import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const pushIt: Control = {
	type: 'action',
	id: 'push',
	label: 'Push',
	action: 'Push the top corner',
	help: 'A steady push sideways on the top left corner.'
};

const another: Control = {
	type: 'action',
	id: 'another',
	label: 'Shape',
	action: 'Try another shape',
	help: 'Join the same sticks again, another way.'
};

const diagonal: Control = {
	type: 'toggle',
	id: 'diagonal',
	label: 'Add a diagonal stick',
	default: false
};

const brace: Control = {
	type: 'toggle',
	id: 'brace',
	label: 'Add a brace',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'why-triangles-are-stiff',
	title: 'Why triangles are stiff',
	summary:
		'Pin sticks together into a square and push it: it leans over. Make a triangle and push: nothing moves. Find out why, then stiffen a wobbly tower and a sagging garden gate with as few extra sticks as you can.',
	chapters: [
		{ id: 'shapes', title: 'Squares and triangles' },
		{ id: 'build', title: 'Building' }
	],
	steps: [
		// ------------------------------------------------------------------ shapes
		{
			id: 'square',
			chapter: 'shapes',
			title: 'A square of sticks',
			scene: 'frame',
			hints: { phase: 'square' },
			duration: 16,
			controls: [pushIt],
			body: `
<p>Here are four pins, the bottom two fixed to the ground. Click a pin, then another, to join them with a stick, and build a square of four sticks. A pin holds the sticks together but lets them turn, like the joint in a pair of scissors. (Here the sticks can’t bend or stretch, and everything moves flat on the screen.)</p>
<p>Now push the top corner. The square leans over and becomes a squashed diamond. None of the sticks got longer or shorter: only the corners changed their angles.</p>`
		},
		{
			id: 'triangle',
			chapter: 'shapes',
			title: 'A triangle of sticks',
			scene: 'frame',
			hints: { phase: 'triangle' },
			duration: 14,
			controls: [pushIt],
			body: `
<p>Now join three pins with three sticks to make a triangle, and try pushing its top corner too.</p>
<p>Nothing moves. The pins can turn just as freely as before, but the triangle keeps its shape. It is <strong>stiff</strong>.</p>`
		},
		{
			id: 'why',
			chapter: 'shapes',
			title: 'Three sticks, one shape',
			scene: 'frame',
			hints: { phase: 'why' },
			duration: 20,
			controls: [another],
			body: `
<p>Here is why. Take three sticks of fixed lengths and join their ends. However you try, you always get the same triangle: once the three sides are fixed, there is only one place each corner can go.</p>
<p>Four sticks are different. Join them again and you can make a square, or a diamond leaning one way, or the other way: the same four lengths fit many shapes. Press the button to try another. The square was never “broken” when it leaned over; it was just one of its many possible shapes.</p>`
		},
		{
			id: 'diagonal',
			chapter: 'shapes',
			title: 'One diagonal',
			scene: 'frame',
			hints: { phase: 'diagonal' },
			duration: 18,
			controls: [diagonal],
			body: `
<p>The square here is being pushed back and forth, and sways. Add one diagonal stick from corner to corner.</p>
<p>The swaying stops. The diagonal cuts the square into two triangles, and each triangle keeps its shape, so the whole square does too. You see this trick everywhere: in bridges, cranes, roof frames, bicycle frames and electricity pylons.</p>`
		},
		// ------------------------------------------------------------------ build
		{
			id: 'tower',
			chapter: 'build',
			title: 'A tall tower',
			scene: 'frame',
			hints: { phase: 'tower' },
			duration: 26,
			body: `
<p>Here is a tower of four square spaces, one above the other. The ground holds its two bottom corners in place, so the lowest space needs no bottom stick. With no diagonals it can wobble in four different ways: each box can lean on its own.</p>
<p>Click a box to put a diagonal in it, or click again to take it out. Each diagonal takes away one way to wobble. Find the fewest diagonals that make the tower stiff: you need one in every box, four in all, and it doesn’t matter which way each one goes.</p>`
		},
		{
			id: 'gate',
			chapter: 'build',
			title: 'A garden gate',
			scene: 'frame',
			hints: { phase: 'gate' },
			duration: 20,
			controls: [brace],
			body: `
<p>A wooden gate is a rectangle of planks, hung on two hinges on one side. Its own weight pulls the far end down, and the rectangle slowly leans out of shape: the gate sags and scrapes the ground.</p>
<p>Add one diagonal plank, a brace, from corner to corner. The rectangle becomes two triangles and the sagging stops. (The animation just tries moving the far end down to show how the gate can change shape; it doesn’t work out how fast a real gate sags.) That is why so many garden gates have a diagonal plank across them.</p>`
		},
		{
			id: 'fewest',
			chapter: 'build',
			title: 'Counting sticks',
			scene: 'frame',
			hints: { phase: 'fewest' },
			duration: 18,
			body: `
<p>There is a counting rule. Every corner that isn’t fixed to the ground can move two ways, across and up. Each stick, if it is placed well, takes away one of those ways. So a frame needs at least two sticks for every free corner to be stiff.</p>
<p>The tower has eight free corners (its two bottom ones stand on the ground), so it needs at least sixteen sticks. Its frame has twelve, and the four diagonals make sixteen. Fewer than that and it must be able to wobble.</p>`,
			notes: `<p>The count is necessary but not enough on its own: the sticks have to be in the right places. Sixteen sticks with two diagonals crammed into one box and none in another still leave a wobble. Engineers check stiffness by asking whether any movement of the corners leaves every stick’s length unchanged, which is what this page computes; for frames like the ones here, that tells us how many independent ways they can wobble.</p>`
		},
		{
			id: 'strong',
			chapter: 'build',
			title: 'Stiff is not the same as strong',
			scene: 'frame',
			hints: { phase: 'strong' },
			duration: 16,
			body: `
<p>A triangle keeps its <em>shape</em>. That doesn’t mean it can hold any weight: push hard enough and a stick will bend or snap, whatever shape it is in. How strong a frame is depends on the sticks themselves, how thick they are and what they are made of.</p>
<p>So a triangle is the shape that makes a frame stiff, not something that makes it unbreakable.</p>`
		},
		{
			id: 'next',
			chapter: 'build',
			title: 'Read next',
			scene: 'frame',
			hints: { phase: 'next' },
			duration: 14,
			body: `
<p>A triangle is the one shape whose sides fix its corners, so a floppy frame goes stiff the moment a diagonal cuts it into triangles.</p>
<p>The page on <a href="../bridges-structures/">bridges and structures</a> puts loads on bridges made of triangles and shows which sticks are being pulled and which are being squeezed.</p>`
		}
	]
};
