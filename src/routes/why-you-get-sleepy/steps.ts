import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { clockText } from './model';

const bedtime: Control = {
	type: 'range',
	id: 'bedtime',
	label: 'Bedtime',
	min: 19,
	max: 27,
	step: 0.25,
	default: 22.5,
	format: clockText,
	help: 'The alarm still rings at 7:00.'
};

const alarm: Control = {
	type: 'range',
	id: 'wake',
	label: 'Alarm',
	min: 5,
	max: 10,
	step: 0.25,
	default: 7,
	format: clockText,
	help: 'Bedtime stays at 22:30.'
};

const skip: Control = {
	type: 'toggle',
	id: 'skip',
	label: 'Stay up all night on day 2',
	default: false
};

const nap: Control = {
	type: 'range',
	id: 'nap',
	label: 'Afternoon nap at 15:00',
	min: 0,
	max: 120,
	step: 10,
	default: 0,
	format: (v) => (v === 0 ? 'no nap' : `${v} minutes`)
};

const pressure =
	'<dfn data-def="The need for sleep that builds up in your brain the longer you are awake, and drains away while you sleep. The page draws it as a tank.">sleep pressure</dfn>';
const bodyClock =
	'<dfn data-def="A timer in your brain that keeps ticking even in a cave with no daylight, on a beat a little longer than 24 hours; daylight locks that beat to the day. It makes sleep easy to fall into at some hours and hard at others.">body clock</dfn>';
const rem =
	'<dfn data-def="The part of sleep when most dreams happen: your eyes dart about under the lids, and the rest of your body goes floppy so that you don’t act out the dream. Its grown-up name is REM sleep.">dreaming sleep</dfn>';

export const spec: ExplainerSpec = {
	slug: 'why-you-get-sleepy',
	title: 'Why you get sleepy',
	summary:
		'A tank of sleep pressure fills all day and drains at night, and a body clock sets the hours when sleep comes easily: sleepiness is the gap between them. Move your bedtime and your alarm, stay up all night, take a nap, and look inside one night’s ninety-minute rounds of light, deep and dreaming sleep.',
	chapters: [
		{ id: 'two', title: 'A tank and a clock' },
		{ id: 'play', title: 'Playing with bedtime' },
		{ id: 'inside', title: 'Inside the night' }
	],
	steps: [
		// ------------------------------------------------------------------ two
		{
			id: 'sleepy',
			chapter: 'two',
			title: 'Why do you get sleepy at night?',
			scene: 'days',
			hints: { phase: 'tank' },
			duration: 24,
			body: `
<p>In the morning you jump out of bed; by bedtime you can hardly keep your eyes open. What changed? You have been <strong>awake all day</strong>, and your brain keeps count.</p>
<p>Think of a <strong>tank</strong> in your head. Every hour you are awake, it fills up a little more with ${pressure}. Every hour you sleep, it drains, and it drains <strong>about twice as fast</strong> as it fills: eight hours in bed empty what sixteen hours awake put in.</p>
<p>Watch three ordinary days: to bed at 22:30, up at 7:00. The tank starts the morning almost empty, is <strong>a bit more than half full</strong> by bedtime, and is almost empty again when the alarm rings. The face shows how you feel.</p>`,
			notes: `<p>Nobody has found a real tank, of course. Scientists measure the pressure by the slow, deep brain waves of sleep: the longer someone has been awake, the bigger those waves are when they fall asleep, and they shrink through the night. Part of it is a chemical called adenosine, which builds up in the brain while you are awake. Coffee keeps you awake by blocking the parts of brain cells that adenosine acts on. It does not empty the tank: adenosine keeps building up while you are awake.</p><p>The page’s numbers are for a grown-up, who needs about 8 hours a night. Children need more: doctors advise 9 to 12 hours for ages 6 to 12, and 8 to 10 for teenagers.</p>`
		},
		{
			id: 'clock',
			chapter: 'two',
			title: 'A body clock opens the door to sleep',
			scene: 'days',
			hints: { phase: 'clock' },
			duration: 24,
			body: `
<p>The tank is only half the story. You also have a ${bodyClock}, a timer in your brain that keeps a 24-hour beat. It moves the <strong>sleep line</strong> on the tank, the dashed orange line: when the tank fills up to it, sleep comes.</p>
<p>The clock lifts the line <strong>high in the late afternoon and evening</strong>, so a fairly full tank still doesn’t put you to sleep, and lowers it <strong>at night</strong>, so sleep comes easily. How sleepy you feel is the <strong>gap</strong> between the tank and the line: the closer the tank gets to the line, the heavier your eyelids.</p>
<p>A second, lower line is where you <strong>wake up by yourself</strong>: when the tank drains down to it, you wake, even without an alarm. Left alone, this grown-up would sleep from about 23:00 to 7:30.</p>`,
			notes: `<p>This is the <em>two-process model</em> of sleep, put forward by the Swiss sleep scientist Alexander Borbély in 1982: one process is the pressure, the other the clock. The page uses the numbers of a 2014 study of the model by Anne Skeldon, Derk-Jan Dijk and Gianne Derks.</p>`
		},
		// ------------------------------------------------------------------ play
		{
			id: 'bedtime',
			chapter: 'play',
			title: 'Early to bed is not early to sleep',
			scene: 'days',
			hints: { phase: 'bedtime' },
			duration: 24,
			controls: [bedtime],
			body: `
<p><strong>Move your bedtime.</strong> The light part of the bar under the graph is time in bed lying awake; the dark part is sleep.</p>
<p>Go to bed at <strong>20:00</strong> and you lie awake for almost <strong>three hours</strong>: the tank is not up to the sleep line yet, and the clock is holding the line high. You fall asleep at about the same time as on a normal night. You can’t sleep early just by trying.</p>
<p>Go to bed at <strong>1:00</strong> instead and the tank has gone past the line long before: you fight to stay awake, fall asleep the moment you lie down, and the alarm at 7:00 rings while the tank still holds almost twice as much as usual.</p>`
		},
		{
			id: 'alarm',
			chapter: 'play',
			title: 'An early alarm leaves the tank fuller',
			scene: 'days',
			hints: { phase: 'alarm' },
			duration: 22,
			controls: [alarm],
			body: `
<p><strong>Move the alarm.</strong> Set it to <strong>5:00</strong> and you get out of bed before the tank has drained: it starts the day with nearly two-thirds as much again as after a full night. The face looks tired sooner, and by 22:00 you are already past the sleep line.</p>
<p>Let it ring at <strong>8:00</strong> or later and you are already awake: the tank reaches the waking line at about 7:30. A later alarm does not add sleep; stay in bed and the tank starts filling again.</p>`,
			notes: `<p>In this simple model a routine of short nights settles into a new, more tired normal after a few days. Real experiments find something worse: people kept to six hours a night for two weeks did as badly on attention tests as people kept awake for a whole night, while saying they felt only a little sleepy.</p>`
		},
		{
			id: 'all-nighter',
			chapter: 'play',
			title: 'Skip a night and the tank overflows',
			scene: 'days',
			hints: { phase: 'skip' },
			duration: 24,
			controls: [skip],
			body: `
<p><strong>Stay up all night</strong> on day 2. The tank never drains: it keeps filling past the sleep line, and by the next evening it is <strong>almost full to the brim</strong>.</p>
<p>The <strong>morning after</strong> is awful: the tank is far over the sleep line, which the clock keeps low around dawn. Then something odd happens: in the afternoon you feel a little <strong>less</strong> sleepy, although the tank is fuller than ever. The clock is lifting the line, as it does every afternoon: a “second wind”. By the evening the line drops again and it is worse than ever.</p>
<p>The next night you fall asleep the moment your head touches the pillow, and the tank drains fast.</p>`,
			notes: `<p>After a lost night people don’t pay back all the hours they missed. The first night of recovery is deeper (more of the slow waves of deep sleep) and somewhat longer, and that is enough to bring the pressure back down.</p>`
		},
		{
			id: 'nap',
			chapter: 'play',
			title: 'A nap borrows from tonight',
			scene: 'days',
			hints: { phase: 'nap' },
			duration: 22,
			controls: [nap],
			body: `
<p><strong>Take a nap</strong> at 15:00 on day 2. While you nap the tank drains, so it is lower all evening and reaches the sleep line later: you go to bed at 22:30 as usual and lie awake.</p>
<p>A <strong>20-minute</strong> nap puts tonight’s sleep about 40 minutes later. A <strong>90-minute</strong> nap puts it more than two hours later. A short nap can still be useful: it takes the edge off a sleepy afternoon, as long as tonight can wait a little.</p>`,
			notes: `<p>The page puts you to sleep for the nap at 15:00 even if the tank has not reached the sleep line. Real naps are easiest in the early afternoon, when many people feel a dip; this simple clock doesn’t draw that dip.</p>`
		},
		// ------------------------------------------------------------------ inside
		{
			id: 'night',
			chapter: 'inside',
			title: 'Inside one night: rounds of about ninety minutes',
			scene: 'days',
			hints: { phase: 'night' },
			duration: 24,
			body: `
<p>Sleep is not one long even dip. Zoom into the first night: you go round a loop about <strong>every ninety minutes</strong>, from light sleep down into <strong>deep sleep</strong>, back up, and into ${rem}. A night of eight hours is about <strong>five rounds</strong>.</p>
<p>Deep sleep is when the tank drains fastest, and it comes mostly in the <strong>first rounds</strong>, while the tank is full: about 45 minutes in the first round, almost none in the last. Dreaming sleep goes the other way: a few minutes at first, then longer and longer towards morning. That is why you often wake up from a dream.</p>`,
			notes: `<p>This strip is a sketch, not part of the two-process model: it gives each round of about ninety minutes some deep sleep in proportion to how full the tank is, and more dreaming sleep later in the night, as real recordings show. Real rounds vary from 70 to 120 minutes and from night to night, and most people wake for a few seconds between rounds without remembering it.</p>`
		},
		{
			id: 'next',
			chapter: 'inside',
			title: 'What the toy leaves out',
			scene: 'days',
			hints: { phase: 'next' },
			duration: 16,
			body: `
<p>Sleepiness is a pressure that builds all day and drains at night, and a body clock that opens a window for sleep. When the two agree you fall asleep quickly and wake up fresh; when they disagree you lie awake tired, or nod off in the afternoon.</p>
<p>The toy keeps the body clock fixed, but a real one <strong>moves</strong>. Morning daylight pulls it earlier; bright screens in the evening and late lie-ins push it later. That is why a weekend of sleeping in makes Monday morning feel like jet lag: your clock has drifted later, and the alarm rings before it is ready.</p>
<p>And the page shows <strong>when</strong> you get sleepy, not <strong>why</strong> animals sleep at all. Sleep, or something like it, has been found in animals from jellyfish to humans, but what it is for is still an open question. The page on <a href="../homeostasis/">homeostasis</a> shows another way your body keeps itself steady, by feedback.</p>`
		}
	]
};
