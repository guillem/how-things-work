import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const rate: Control = {
	type: 'range',
	id: 'hr',
	label: 'Heart rate',
	min: 40,
	max: 150,
	step: 1,
	default: 75,
	format: (v) => `${v} beats/min`
};

const width: Control = {
	type: 'range',
	id: 'width',
	label: 'Width of the small arteries',
	help: '100% is healthy; narrower vessels resist the flow more.',
	min: 70,
	max: 100,
	step: 1,
	default: 90,
	unit: '%'
};

const valve: Control = {
	type: 'select',
	id: 'valve',
	label: 'Leaky valve',
	default: 'mitral',
	options: [
		{ value: 'mitral', label: 'Mitral' },
		{ value: 'aortic', label: 'Aortic' }
	]
};

const leak: Control = {
	type: 'range',
	id: 'leak',
	label: 'Size of the leak',
	help: 'Area of the gap left when the valve shuts (0 = it seals).',
	min: 0,
	max: 0.5,
	step: 0.01,
	default: 0.4,
	format: (v) => `${v.toFixed(2)} cm²`
};

export const spec: ExplainerSpec = {
	slug: 'heart-circulation',
	title: 'How the heart pumps blood',
	summary:
		'Watch a beating heart open and shut its valves in time with its electrical signal, then speed it up, narrow the arteries or make a valve leak.',
	chapters: [
		{ id: 'pumps', title: 'Two pumps' },
		{ id: 'beat', title: 'One beat' },
		{ id: 'trouble', title: 'When something goes wrong' }
	],
	steps: [
		{
			id: 'heart',
			chapter: 'pumps',
			title: 'A pump with four rooms',
			scene: 'heart',
			hints: { phase: 'anatomy' },
			duration: 20,
			body: `
<p>Your heart is a fist-sized bag of muscle that squeezes about 75 times a minute — more than 100,000 times a day. Cut it open and you find four hollow chambers: two thin-walled <dfn data-def="The two upper chambers of the heart. They collect the blood coming back to the heart and top up the ventricles below.">atria</dfn> on top, which collect blood, and two muscular <dfn data-def="The two lower chambers of the heart, the real pumps. They squeeze blood out into the arteries.">ventricles</dfn> below, which pump it out.</p>
<p>A wall, the <dfn data-def="The muscular wall that divides the heart into a right side and a left side, so that their blood never mixes.">septum</dfn>, splits the heart into a right side and a left side whose blood never mixes. The <strong>right side</strong> receives blood that has given up its oxygen to the body and sends it to the lungs. The <strong>left side</strong> receives oxygen-rich blood from the lungs and sends it to the rest of the body. The heart is really two pumps, side by side.</p>`,
			notes: `<p>As in every anatomy book, the heart is drawn as if you were facing its owner, so its right side is on <em>your</em> left. Blood low in oxygen is drawn blue by tradition; real blood is never blue, only a darker red. The chambers in the picture shrink and swell with the volumes computed by the model.</p>`
		},
		{
			id: 'loop',
			chapter: 'pumps',
			title: 'Two pumps in series',
			scene: 'loop',
			hints: { phase: 'loop' },
			duration: 24,
			body: `
<p>Follow one drop of blood. From the body it comes back through the <dfn data-def="Vessels that carry blood back to the heart.">veins</dfn> to the right side, which pumps it through the lungs. There it picks up oxygen and gets rid of carbon dioxide. It returns to the left side, which pumps it out through the <dfn data-def="Vessels that carry blood away from the heart, under pressure.">arteries</dfn> to every organ, which take some of its oxygen. Then it comes back to the right side again.</p>
<p>Every drop passes through both pumps in turn: they are connected <dfn data-def="One after the other, so that everything that goes through the first must then go through the second.">in series</dfn>. So the two sides must pump exactly the same amount — about 75 mL per beat each, some 5½ litres a minute, roughly all your blood every minute. Blood leaves the lungs 98% saturated with oxygen and comes back from the body at rest still about three-quarters saturated.</p>
<p>The lungs are close by and delicate, so the right pump works at a low pressure, about a fifth of the left pump's. The left pump must push blood around the whole body, which is why the wall of the left ventricle is about three times thicker.</p>`
		},
		{
			id: 'valves',
			chapter: 'pumps',
			title: 'Valves keep it one way',
			scene: 'heart',
			hints: { phase: 'valves' },
			duration: 24,
			body: `
<p>Four <dfn data-def="Flaps of tissue that let blood through in one direction only: pushed from behind they open, pushed from the front they shut.">valves</dfn> keep the blood moving one way: one between each atrium and its ventricle (the <em>tricuspid</em> on the right, the <em>mitral</em> on the left) and one at each exit (the <em>pulmonary</em> and the <em>aortic</em> valve). Nothing pulls them open or shut: pushed from behind they open, pushed from the front they slam shut. Only the pressure on each side decides.</p>
<p>In each beat the relaxed ventricles fill through the open inlet valves, and the atria give them a final squeeze. Then the ventricles contract: their pressure rises, and the inlet valves snap shut — the “lub” of the heartbeat. When the pressure beats the pressure in the arteries, the exit valves open and blood rushes out. The ventricles relax, the exit valves shut — “dub” — and filling begins again.</p>`
		},
		{
			id: 'signal',
			chapter: 'beat',
			title: 'An electrical spark sets the beat',
			scene: 'monitor',
			hints: { phase: 'signal' },
			duration: 24,
			body: `
<p>Each beat starts with an electrical signal from a small patch of cells in the right atrium, the <dfn data-def="The heart's natural pacemaker: a patch of cells in the wall of the right atrium that fires an electrical signal regularly, starting each beat.">sinoatrial node</dfn>. The signal spreads over both atria, which squeeze together. It then reaches the <dfn data-def="A small knot of cells between the atria and the ventricles. It is the only electrical path between them, and it delays the signal for about a tenth of a second.">atrioventricular node</dfn>, which holds it back for about a tenth of a second so that the ventricles can finish filling, then races down the septum and spreads through both ventricles, which squeeze together.</p>
<p>Electrodes on the skin pick up these signals: the <dfn data-def="A recording of the heart's electrical activity, picked up by electrodes on the skin. Also called ECG or EKG.">electrocardiogram</dfn> (ECG). The small <strong>P</strong> wave is the signal crossing the atria, the tall <strong>QRS</strong> spike the signal crossing the ventricles, and the <strong>T</strong> wave the ventricles recovering for the next beat. Because one signal drives both sides, the two pumps always beat in step.</p>`
		},
		{
			id: 'pressure',
			chapter: 'beat',
			title: 'Pressure, beat by beat',
			scene: 'monitor',
			hints: { phase: 'pressure' },
			duration: 24,
			body: `
<p>The graph shows the pressure inside the left ventricle, in the left atrium and in the <dfn data-def="The body's main artery, which leaves the left ventricle and branches to every organ.">aorta</dfn>, the main artery. When the ventricle squeezes, its pressure soars. The moment it passes the pressure in the aorta, the aortic valve opens and blood pours out; when it falls below again, the valve shuts. While the ventricle is relaxed and its pressure is below the atrium's, the mitral valve is open and it fills.</p>
<p>The aorta's elastic wall stretches with each beat and springs back in between, so the pressure in the arteries never drops to zero: it swings between about 120 and 80 <dfn data-def="Millimetres of mercury: a unit of pressure. 120 mmHg is the pressure that would push a column of mercury 12 cm up a tube.">mmHg</dfn>. That is the “120 over 80” of a blood-pressure reading: the <dfn data-def="The highest pressure in the arteries, at the end of each squeeze.">systolic</dfn> pressure over the <dfn data-def="The lowest pressure in the arteries, just before the next squeeze.">diastolic</dfn> one.</p>`,
			notes: `<p>The right side's curves have the same shape, about five times lower: the lung artery swings between roughly 25 and 10 mmHg. The model behind the graph treats each chamber as an elastic bag that stiffens while its muscle is activated, and the vessels as elastic tubes joined by resistances; it has no nerves or hormones to adjust things.</p>`
		},
		{
			id: 'rate',
			chapter: 'beat',
			title: 'Faster and slower',
			scene: 'monitor',
			hints: { phase: 'rate' },
			duration: 24,
			controls: [rate],
			body: `
<p>How much blood the heart pumps each minute, its <dfn data-def="The volume of blood a ventricle pumps per minute: heart rate × stroke volume. About 5 litres a minute at rest.">cardiac output</dfn>, is the heart rate times the volume of each beat, the <dfn data-def="The volume of blood a ventricle pumps out in one beat, about 70 mL at rest.">stroke volume</dfn>. At 75 beats a minute and about 75 mL per beat, that makes some 5½ litres a minute.</p>
<p>Speed the heart up and each beat comes sooner, giving the ventricles less time to fill. At 150 beats a minute each beat pumps only about 47 mL, so twice the rate gives only about a quarter more blood. Slow it down to 40 and each beat is bigger, but the output falls, and the body has to take more oxygen out of every litre: the blood comes back with less.</p>`,
			notes: `<p>During exercise, nerves and adrenaline do more than speed the heart up: they also make each squeeze stronger and open up the vessels of the working muscles, so the output can rise to about four times its resting value. This model changes only the rate.</p>`
		},
		{
			id: 'narrow',
			chapter: 'trouble',
			title: 'Narrowed arteries',
			scene: 'monitor',
			hints: { phase: 'narrow' },
			duration: 24,
			controls: [width],
			body: `
<p>Blood leaves the arteries through countless tiny branches, the <dfn data-def="The smallest arteries. Muscle in their walls can narrow or widen them, which controls how easily blood flows out of the arteries.">arterioles</dfn>. How easily it gets through depends enormously on their width: a tube's resistance to flow grows as one over its radius to the <em>fourth</em> power. Make them 10% narrower and the resistance goes up by half; 20% narrower and it is nearly 2½ times as large.</p>
<p>Against a higher resistance the pressure in the arteries climbs — <strong>high blood pressure</strong> — and the left ventricle has to squeeze against it: it empties less with each beat. In this model, with none of the body's reflexes, arteries 10% narrower raise the average pressure from about 100 to about 135 mmHg. The dashed curves show the healthy heart for comparison.</p>`,
			notes: `<p>The fourth-power law is Poiseuille's law for steady flow through a tube. Over years, a ventricle that works against a high pressure thickens and stiffens, like any muscle that is overloaded. A single narrowed artery, as in a heart attack or a stroke, mostly starves the organ it feeds; here all the small arteries of the body narrow together.</p>`
		},
		{
			id: 'leak',
			chapter: 'trouble',
			title: 'A leaking valve',
			scene: 'monitor',
			hints: { phase: 'leak' },
			duration: 24,
			controls: [valve, leak],
			body: `
<p>A valve that does not close properly lets blood back. If the <strong>mitral</strong> valve leaks, every squeeze pushes some blood backwards into the left atrium instead of forwards into the aorta: through a gap of 0.4 cm² about 50 mL of each beat goes the wrong way. The ventricle swells, squeezes out more to make up for it, and the pressure backs up into the lungs, which can make a person breathless.</p>
<p>If the <strong>aortic</strong> valve leaks, blood falls back from the aorta into the ventricle between beats, and the diastolic pressure drops from about 80 to about 35 mmHg. Through a stethoscope, a doctor hears a leak as a <dfn data-def="An extra sound between the normal heart sounds, often the whoosh of blood squirting through a narrowed or leaking valve.">murmur</dfn>: the whoosh of blood squirting the wrong way.</p>`,
			notes: `<p>The backflow through the gap is computed with Bernoulli's law as cardiologists use it: a jet driven by a pressure difference ΔP (mmHg) moves at √ΔP ÷ 2 metres a second. Because the two pumps are in series, the right side still sends the same volume to the lungs per beat as the left side sends forward to the body.</p>`
		},
		{
			id: 'summary',
			chapter: 'trouble',
			title: 'Two pumps, one beat',
			scene: 'loop',
			hints: { phase: 'summary' },
			duration: 24,
			controls: [rate],
			body: `
<p><strong>The heart is two pumps in series — the right one for the lungs, the left one for the rest of the body — kept in step by one electrical signal.</strong> Everything else follows: the two sides pump the same volume per beat; the valves, pushed only by pressure, keep the blood moving one way; and the ECG shows the signal that starts each beat.</p>
<p>Change the heart rate and watch both pumps follow the same rhythm, each sending the same amount of blood round its own circuit.</p>`
		}
	]
};
