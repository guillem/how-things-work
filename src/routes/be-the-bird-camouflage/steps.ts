import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const hunt: Control = {
	type: 'action',
	id: 'hunt',
	label: 'Your turn as the bird',
	action: 'Hunt / next generation',
	help: 'Press to begin. Tap moths for twelve seconds; press again to finish early. After the hunt, press for their offspring. With reduced motion, the hunt is untimed.'
};
const bark: Control = {
	type: 'toggle',
	id: 'soot',
	label: 'Sooty bark',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'be-the-bird-camouflage',
	title: 'Camouflage: you are the hungry bird',
	summary:
		'Be the bird: tap the moths you can see on the bark. Only the ones you miss have babies. Hunt a few generations, darken the tree, then keep hunting: the moths never choose a new colour, but the population can change.',
	chapters: [
		{ id: 'hunt', title: 'Be the bird' },
		{ id: 'change', title: 'Who has babies?' }
	],
	steps: [
		{
			id: 'tree',
			chapter: 'hunt',
			title: 'There are moths on this tree',
			scene: 'bark',
			body: `<p>A hungry bird lands beside a tree. There are 24 moths resting on the bark. Some are pale, some dark, and some in between. Which ones can you spot first?</p><p>Some colours stand out against the bark. Others are harder to see. Blending in with a background is called <dfn data-def="A colour, pattern or shape that makes an animal harder to notice against its surroundings.">camouflage</dfn>. In a moment, you will be the bird.</p>`,
			duration: 18
		},
		{
			id: 'hunt',
			chapter: 'hunt',
			title: 'Catch the ones you can see',
			scene: 'bark',
			controls: [hunt],
			body: `<p>Press <strong>Hunt / next generation</strong>, then tap every moth you spot. You have twelve seconds. The stage clock pauses when you pause the page, and the hunt is untimed if your device asks for reduced motion. You can also focus a moth with Tab and catch it with Enter or Space.</p><p>The moths you catch disappear. The ones you miss stay alive. This time, <em>you</em> decide who gets eaten: the computer does not secretly favour any colour. Press the button again if you want to finish early.</p>`,
			duration: 24
		},
		{
			id: 'survive',
			chapter: 'hunt',
			title: 'The ones you miss have babies',
			scene: 'bark',
			controls: [hunt],
			body: `<p>After a hunt, the little bars show the shades of the moths still alive. Did you catch more dark ones than pale ones? If so, more of the parents left behind are pale.</p><p>Press the button for the next generation. Each new moth takes its shade from a randomly chosen survivor, with a little variation. The eaten moths have no babies. The population returns to 24, unless you caught every moth: then this colony has died out, and the button starts a separate new colony.</p>`,
			duration: 24
		},
		{
			id: 'generations',
			chapter: 'change',
			title: 'Hunt a few generations',
			scene: 'bark',
			controls: [hunt],
			body: `<p>Keep hunting and breeding. Each row on the right records the shades at the start of a generation. The newest row sits at the bottom. Compare the rows: is the population getting paler?</p><p>There is no promised result. If you catch pale moths instead, you leave darker parents. If you catch none, chance still changes the mix a little. <dfn data-def="When inherited differences affect who survives to have offspring, those differences can become more or less common over generations.">Natural selection</dfn> needs a difference in who has babies, not simply a change of scenery.</p>`,
			duration: 25
		},
		{
			id: 'soot',
			chapter: 'change',
			title: 'Now change the tree',
			scene: 'bark',
			controls: [bark],
			body: `<p>Turn on <strong>Sooty bark</strong>. The tree gets darker, but look closely: every moth keeps exactly the shade it already had. Which ones are easier to spot now?</p><p>In industrial Britain, pollution darkened many tree surfaces and damaged pale lichens. Dark forms of the peppered moth became common in many polluted places. After pollution fell, pale forms became common again. Bird predation was an important part of that change.</p>`,
			duration: 22
		},
		{
			id: 'reverse',
			chapter: 'change',
			title: 'The winners can change',
			scene: 'bark',
			controls: [hunt],
			body: `<p>Keep hunting on whichever bark you chose. If the tree is dark, the pale moths may now be the easiest meals. More dark moths can survive, have babies, and gradually become common.</p><p>That change can take many generations, especially if hardly any dark moths remain. A new background does not summon the colour an animal needs. In this toy, only inherited shade, small random differences, chance and your hunting change the population.</p>`,
			duration: 25
		},
		{
			id: 'not-choice',
			chapter: 'change',
			title: 'Nobody chooses a new colour',
			scene: 'bark',
			controls: [hunt],
			body: `<p>A moth does not think “I should be darker” and repaint its wings. Every adult keeps its shade. What changes is the mix of moths from one generation to the next, because some survive to leave more offspring.</p><p>This is a simplified inheritance toy, with a whole range of shades. Real peppered moths have inherited colour forms controlled by genes, not a smooth shade dial. Their real hiding places, patterns and the birds’ eyesight matter too. Our moths and bark are drawn by the program; these are not measured moth populations.</p>`,
			duration: 22
		},
		{
			id: 'next',
			chapter: 'change',
			title: 'Small differences, many generations',
			scene: 'bark',
			body: `<p>Camouflage can help an animal avoid being eaten. When that advantage is inherited, the survivors’ colours can become more common over generations. Change the background and the advantage may change too.</p><p>The page on <a href="../evolution/">evolution and natural selection</a> lets you explore this over many more generations. <a href="../meiosis-inheritance/">Meiosis and inheritance</a> opens up how parents pass genes to their offspring.</p>`,
			duration: 18
		}
	]
};
