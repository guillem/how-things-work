import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// The numbers quoted here come from the models: ray tracing in ak135 (`earth.ts`), the Gorkha
// recordings (`locate.ts`), Hanks & Kanamori magnitudes and the USGS catalogue (`magnitude.ts`).
// `e2e/earthquakes-model.e2e.ts` checks them.

const quake: Control = {
	type: 'action',
	id: 'quake',
	label: 'Earthquake',
	action: 'Trigger an earthquake',
	help: 'Starts the waves again from the moment the fault slips.'
};

const medium: Control = {
	type: 'select',
	id: 'medium',
	label: 'What the waves travel through',
	default: 'crust',
	options: [
		{ value: 'crust', label: 'Rock of the crust' },
		{ value: 'mantle', label: 'Rock of the mantle, 1,500 km down' },
		{ value: 'core', label: 'Liquid iron of the outer core' }
	]
};

const earth: Control = {
	type: 'select',
	id: 'earth',
	label: 'Which Earth',
	default: 'ak135',
	options: [
		{ value: 'ak135', label: 'The real Earth' },
		{ value: 'uniform', label: 'The same rock all through' }
	]
};

const innerCore: Control = {
	type: 'toggle',
	id: 'innerCore',
	label: 'A solid inner core',
	default: true,
	help: 'Switch it off to see what a core of liquid all the way down would do.'
};

const station: Control = {
	type: 'range',
	id: 'station',
	label: 'Seismometer’s distance from the earthquake',
	min: 2,
	max: 180,
	step: 1,
	default: 40,
	format: (v) => `${v}° · ${Math.round((v * Math.PI * 6371) / 180).toLocaleString('en-GB')} km`,
	help: 'Or drag the seismometer round the Earth.'
};

const minSec = (v: number) =>
	`${Math.floor(v / 60)} min ${String(Math.round(v % 60)).padStart(2, '0')} s`;
const lag = (id: string, name: string, def: number): Control => ({
	type: 'range',
	id,
	label: `S − P at ${name}`,
	min: 120,
	max: 600,
	step: 1,
	default: def,
	format: minSec,
	help: 'Or drag the S marker on the seismogram.'
});
const lagAnkara = lag('lagAnto', 'Ankara', 300);
const lagTaipei = lag('lagTato', 'Taipei', 420);
const lagDiego = lag('lagDgar', 'Diego Garcia', 250);

const mag = (id: string, label: string, def: number): Control => ({
	type: 'range',
	id,
	label,
	min: 2,
	max: 9.5,
	step: 0.1,
	default: def,
	format: (v) => `M ${v.toFixed(1)}`
});

export const spec: ExplainerSpec = {
	slug: 'earthquakes',
	title: 'Earthquakes and the Earth’s interior',
	summary:
		'Trigger an earthquake and follow its P and S waves through a cross-section of the real Earth, bending as they go and casting shadows behind the core, then find the epicentre of the 2015 Nepal earthquake from three real seismograms and compare magnitudes.',
	chapters: [
		{ id: 'quake', title: 'What shakes' },
		{ id: 'inside', title: 'Through the planet' },
		{ id: 'core', title: 'The core’s shadow' },
		{ id: 'locate', title: 'Finding the epicentre' },
		{ id: 'size', title: 'How big' },
		{ id: 'whole', title: 'The whole picture' }
	],
	steps: [
		// ------------------------------------------------------------------ quake
		{
			id: 'slip',
			chapter: 'quake',
			title: 'A fault lets go',
			scene: 'fault',
			duration: 22,
			body: `
<p>The plates of the <a href="../plate-tectonics/">plate tectonics</a> page move a few centimetres a year, but along a <dfn data-def="A crack in the Earth's crust along which the rocks on the two sides have moved.">fault</dfn> between them the rocks are stuck together by friction. So the ground on each side bends, slowly, for decades or centuries, like a ruler you push with your fingers: the road painted across the fault here curves more and more.</p>
<p>Then the rock gives way. In a few seconds the two sides jump past each other, the bent rock springs back straight, and part of the stored energy (most of it heats and breaks the rock along the fault) goes out as <dfn data-def="Waves of shaking that travel through the rock of the Earth, sent out by an earthquake.">seismic waves</dfn>. The rupture starts at the <dfn data-def="The point inside the Earth where an earthquake starts. Also called the focus.">hypocentre</dfn>, usually a few to a few tens of kilometres down; the point on the surface straight above it is the <dfn data-def="The point on the Earth's surface directly above where an earthquake started.">epicentre</dfn>.</p>`,
			notes: `<p>This "elastic rebound" was worked out by Harry Fielding Reid after the 1906 San Francisco earthquake, where fences and roads crossing the San Andreas Fault were shifted by up to 6 m. The drawing speeds up the bending enormously: the slip that took decades to load is released in seconds. The Nepal earthquake of 2015 started 8 km down and tore the fault for more than 100 km.</p>`
		},
		{
			id: 'waves',
			chapter: 'quake',
			title: 'Push waves and shake waves',
			scene: 'waves',
			duration: 24,
			controls: [medium],
			body: `
<p>Like the <a href="../waves-interference/">waves on a rope or in the air</a>, seismic waves carry a disturbance through a material without carrying the material along. They come in two kinds that travel through the inside of the Earth. In a <dfn data-def="Primary wave: a seismic wave that squeezes and stretches the rock along its direction of travel, like sound. The fastest seismic wave.">P wave</dfn> the rock is squeezed and stretched along the way the wave goes, like the push of a slinky — it is a sound wave in rock. In an <dfn data-def="Secondary wave: a seismic wave that shakes the rock from side to side, across its direction of travel. Slower than a P wave, and unable to pass through liquids.">S wave</dfn> the rock is shaken from side to side, across the way the wave goes, like a flick along a rope.</p>
<p>P is always faster: in the crust 5.8 km a second against 3.5 km a second for S, so P arrives first ("primary") and S second ("secondary"). Now switch to the liquid iron of the Earth's core. P still gets through, because a liquid pushes back when it is squeezed — but S doesn't: a liquid can't spring back when it is pushed sideways, so it has nothing to carry a shake. <strong>S waves can't travel through liquid.</strong> Keep that in mind.</p>`,
			notes: `<p>The speeds are those of the reference model ak135 at each depth. A wave's speed depends on how stiff the material is against its kind of deformation, and on its density: P waves feel the resistance to squeezing and to shearing together, S waves only the resistance to shearing. That is why S is always the slower, and why it vanishes in a liquid, which has no resistance to shearing at all. A third family, surface waves, runs along the ground only; they come last and shake the most, but they don't go through the planet.</p>`
		},
		// ------------------------------------------------------------------ inside
		{
			id: 'trigger',
			chapter: 'inside',
			title: 'Across the whole planet',
			scene: 'earth',
			hints: { phase: 'trigger' },
			duration: 26,
			controls: [quake],
			body: `
<p>This is a slice through the Earth, with an earthquake at the top. Trigger it and watch the waves spread out through the planet: <strong class="eq-p">P waves</strong> in front, <strong class="eq-s">S waves</strong> behind them. The clock shows the real time since the earthquake (the animation runs 100 times faster).</p>
<p>The waves are not stopped by the far side of the planet: a big earthquake is recorded by seismometers all over the world. The P wave reaches a point a quarter of the way round the Earth (10,000 km away) in 13 minutes, and the far side, straight through the middle, in 20 minutes. Each line is the path of a little piece of the wave front: a <dfn data-def="The path along which a small piece of a wave front travels, at right angles to the fronts.">ray</dfn>. Notice that the rays are not straight.</p>`,
			notes: `<p>Every ray here is traced through ak135, the standard model of the speeds of seismic waves inside the Earth (Kennett, Engdahl and Buland, 1995), built from millions of recorded arrival times. Its travel times match the published ak135 tables to a fraction of a second. Only waves that go down and come straight back up are drawn; real seismograms also contain waves reflected off the surface and off the boundaries inside.</p>`
		},
		{
			id: 'bending',
			chapter: 'inside',
			title: 'Why the rays curve',
			scene: 'earth',
			hints: { phase: 'bending' },
			duration: 26,
			controls: [earth, quake],
			body: `
<p>Deep rock is squeezed by the weight above it and gets stiffer, so the waves go faster the deeper they are: the chart shows P going from 5.8 km/s in the crust to 13.7 km/s at the bottom of the mantle. A wave front that dips into faster rock runs ahead at its lower end, so it turns, just as light bends when it passes out of water into air, where it speeds up. Each time a ray goes deeper it is bent further from the vertical, until it curves round and heads back up. That is why the rays bow downwards and come back up like a smile.</p>
<p>Switch to an Earth made of the same rock all through: the rays go straight, and the waves arrive far later — P takes 26 minutes to get a quarter of the way round instead of 13. The first seismologists noticed that waves from far-away earthquakes arrived much sooner than straight lines through surface rock allowed: the first clue that the inside of the Earth is different.</p>`,
			notes: `<p>The rule for the bending is Snell's law, the law of refraction of light: at each boundary between layers, sin(angle) ÷ speed stays the same. In a sphere it becomes r × sin(angle) ÷ speed = constant along the whole ray, which is how these rays were traced, through the model cut into about 1,400 thin shells. The jumps in the chart at 410 and 660 km deep are where the minerals of the mantle are squeezed into denser crystal forms.</p>`
		},
		// ------------------------------------------------------------------ core
		{
			id: 's-shadow',
			chapter: 'core',
			title: 'S waves stop at the core',
			scene: 'earth',
			hints: { phase: 's-shadow' },
			duration: 26,
			controls: [quake],
			body: `
<p>Now follow only the <strong class="eq-s">S waves</strong>. They cross the whole <dfn data-def="The thick layer of hot rock between the crust and the Earth's core, 2,900 km deep. It is solid, though it flows very slowly over millions of years.">mantle</dfn> — so the mantle is solid rock, not a sea of molten lava. But every S ray that goes deeper than 2,890 km stops there. No S wave arrives more than about 100° round the Earth from the earthquake: there is an <strong>S-wave shadow</strong> covering the whole far side of the planet.</p>
<p>Remember the last chapter: S waves can't travel through liquid. The shadow means that from 2,890 km down there is a liquid: the <dfn data-def="The layer of liquid iron and nickel between 2,890 and 5,150 km deep. Its churning makes the Earth's magnetic field.">outer core</dfn>, molten iron and nickel; the core's radius is a little over half the Earth's.</p>`,
			notes: `<p>Harold Jeffreys concluded in 1926 that the core is liquid, from the missing S waves and from how much the Earth flexes in the tides. When an S wave hits the core, part of its energy carries on as a P wave through the liquid and back out as an S wave on the far side (seismologists call it SKS); those converted waves are left out here. Sometimes the edge of the shadow is put at 104° or 105°: waves just grazing the core are bent a little round it (diffracted), so their weak tail reaches a bit further.</p>`
		},
		{
			id: 'p-shadow',
			chapter: 'core',
			title: 'A shadow for P waves too',
			scene: 'earth',
			hints: { phase: 'p-shadow' },
			duration: 26,
			controls: [quake],
			body: `
<p>P waves do get into the liquid core, but they slow down sharply there: from 13.7 km/s at the bottom of the mantle to 8.0 km/s at the top of the core. Going into slower material bends a ray towards the vertical, like light going into water, so the P waves that hit the core are bent steeply inwards and come out much further round, beyond about 143°.</p>
<p>Between about 100° and 143° almost nothing arrives: a ring-shaped <strong>P-wave shadow zone</strong>. Its edge tells how big the core is. In 1914 Beno Gutenberg worked out from it that the core begins 2,900 km down — within 10 km of today's value.</p>`,
			notes: `<p>The rays through the core cross each other and pile up near 145°, where the core focuses them like a lens: seismograms there show strong core waves (a caustic). Richard Oldham had first argued for a core in 1906 from waves arriving late on the far side. A few weak waves do turn up inside the shadow, drawn faintly here; the next step is about them.</p>`
		},
		{
			id: 'inner-core',
			chapter: 'core',
			title: 'Something solid in the middle',
			scene: 'earth',
			hints: { phase: 'inner-core' },
			duration: 28,
			controls: [innerCore, quake],
			body: `
<p>In 1936 the Danish seismologist Inge Lehmann noticed faint P waves arriving inside the shadow zone, where none should be. She explained them with an <dfn data-def="A solid ball of iron and nickel at the centre of the Earth, 1,220 km in radius.">inner core</dfn>: a central ball where the waves go faster again, which bends the rays that cross it (or bounces those that graze it) out into the shadow.</p>
<p>Here the rays that reach it are highlighted. Switch the inner core off — make the core liquid all the way to the centre — and the whole shadow zone goes silent. With it, the waves arrive from about 115° on. The inner core is solid iron, 1,220 km in radius: about as hot as the surface of the Sun, but held solid by the enormous pressure.</p>`,
			notes: `<p>In ak135 the P speed jumps from 10.3 to 11.0 km/s at the top of the inner core, 5,150 km down. The waves that bounce off it here are totally reflected; in the real Earth only part of a wave bounces and the rest goes in, so these are weak. The inner core also carries S waves again, very faintly, which confirms it is solid. It is slowly growing as the core freezes from the inside out, and the heat that this releases helps keep the outer core churning and the Earth's magnetic field alive.</p>`
		},
		{
			id: 'seismometer',
			chapter: 'core',
			title: 'Listen anywhere on Earth',
			scene: 'earth',
			hints: { phase: 'station' },
			duration: 30,
			controls: [station, quake],
			body: `
<p>Put a <dfn data-def="An instrument that records the shaking of the ground over time. Its record is a seismogram.">seismometer</dfn> anywhere on the surface: drag it round the Earth. Beside the Earth, its record shows which waves reach it, and when.</p>
<p>Close to the earthquake, P and S arrive within seconds of each other (about 25 s apart at 2°, the nearest shown). Further away the gap grows: the S waves fall further and further behind. Beyond about 100° the direct waves are gone, and only the waves through the core arrive — or nothing at all, in the shadow. A worldwide network of seismometers is like a set of microphones round the planet: every earthquake is a new measurement of the inside of the Earth.</p>`
		},
		// ------------------------------------------------------------------ locate
		{
			id: 's-minus-p',
			chapter: 'locate',
			title: 'The gap tells the distance',
			scene: 'locate',
			hints: { phase: 'lag' },
			duration: 30,
			controls: [lagAnkara],
			body: `
<p>On 25 April 2015 a magnitude 7.8 earthquake struck Nepal. This is a real seismogram of it, recorded in Ankara, Turkey: the ground moving up and down (top) and side to side (bottom). The <strong class="eq-p">P wave</strong> arrives first, then the <strong class="eq-s">S wave</strong> — which shakes the ground mainly sideways, as an S wave should.</p>
<p>Because S falls behind P steadily with distance, the time between them tells how far away the earthquake was. Drag the <strong class="eq-s">S marker</strong> onto the moment the sideways shaking suddenly grows. The chart turns the gap into a distance, using the travel times of the ray model: a station 6½ minutes of gap away is about 44° — 4,900 km — from the earthquake. The dashed line is the same chart for an Earth of the same rock all through: there the same gap would mean a much shorter distance. Reading the distance only works because the waves have already measured the inside of the Earth.</p>`,
			notes: `<p>The recording is from station ANTO of the Global Seismographic Network, from the EarthScope (IRIS) data centre, converted to ground motion and filtered to remove the slow drift of the instrument (the heights are compressed in the drawing). The P arrival was picked automatically, where the up-and-down shaking first jumps. It comes 2 s after the time ak135 predicts: the real Earth is not perfectly layered. The sideways trace is the ground's motion across the line from Nepal, combined from the two horizontal sensors.</p>`
		},
		{
			id: 'locate',
			chapter: 'locate',
			title: 'Three circles, one point',
			scene: 'locate',
			hints: { phase: 'locate' },
			duration: 34,
			controls: [lagAnkara, lagTaipei, lagDiego],
			body: `
<p>One distance isn't enough: the earthquake could be anywhere on a circle that far from Ankara. So read two more seismograms of the same earthquake, from Taipei and from Diego Garcia, an island in the Indian Ocean. Drag each <strong class="eq-s">S marker</strong> onto its S wave and watch the circles change size on the map.</p>
<p>Two circles cross at two points; the third circle picks one of them. Where all three meet is the epicentre. This is the idea behind locating an earthquake, and seismologists once drew it on globes by hand. Today computers do the same with the exact arrival times at hundreds of stations at once, which also gives the depth and the moment it started.</p>`,
			notes: `<p>The circles are drawn on the globe, all points at the same distance from the station, so on a flat map they come out stretched. The distances come from the ak135 travel times for an earthquake 8 km deep. The USGS put the epicentre at 28.23° N, 84.73° E, in the Gorkha district, between Kathmandu and Pokhara.</p>`
		},
		// ------------------------------------------------------------------ size
		{
			id: 'magnitude',
			chapter: 'size',
			title: 'One step, 32 times the energy',
			scene: 'magnitude',
			hints: { phase: 'scale' },
			duration: 28,
			controls: [mag('magA', 'Bigger earthquake', 7.8), mag('magB', 'Smaller earthquake', 5.8)],
			body: `
<p>Earthquakes range from tremors only instruments notice to ones that shake whole countries, so their size is measured on a <dfn data-def="A scale where each step multiplies the quantity by the same factor (here 10 or 32) instead of adding to it.">logarithmic scale</dfn>. Charles Richter set it up in 1935: each step of <dfn data-def="A number for the size of an earthquake; each step up is ten times bigger wiggles on a seismogram and about 32 times more energy.">magnitude</dfn> means wiggles ten times bigger on a seismometer at the same distance.</p>
<p>Today's <strong>moment magnitude</strong> (Hanks and Kanamori, 1979) measures what the fault did — its area times how far it slipped — and keeps the same steps. In energy, each step up is about <strong>32 times</strong> more, and two steps 1,000 times. Each ball's <em>volume</em> here is the energy sent out as seismic waves. Compare: Nepal 2015 (7.8) released about 7.6 million tonnes of TNT in seismic waves; Japan 2011 (9.1) 90 times more.</p>`,
			notes: `<p>Moment magnitude is Mw = ⅔ log₁₀ M₀ − 10.7, with the seismic moment M₀ (in dyne·cm) = the rock's stiffness × the area of the fault × the average slip. The energy follows Gutenberg and Richter's relation log₁₀ E = 1.5 M + 4.8 (E in joules). Richter's original scale, and the other scales that measure a wave's height at one chosen period, stop growing for the largest earthquakes: a big rupture puts its extra energy into longer, slower waves than the ones they measure (a "saturation" of the scale, not of the instrument). That is why big earthquakes are now given moment magnitudes; "the Richter scale" in the news usually means one of these. Magnitude is not the shaking you feel: that depends on the distance, the depth and the ground under you, and is measured on an intensity scale.</p>`
		},
		{
			id: 'how-often',
			chapter: 'size',
			title: 'Big ones are rare',
			scene: 'magnitude',
			hints: { phase: 'often' },
			duration: 24,
			body: `
<p>The catalogue of the plate-tectonics map — every earthquake of magnitude 5.5 or more worldwide from 2015 to 2024 — counted by magnitude. Each step up in magnitude, there are about <strong>ten times fewer</strong>: about 130 a year of magnitude 6 or more, 14 of 7 or more, fewer than one of 8 or more. This pattern is the <dfn data-def="The rule that each step up in magnitude makes earthquakes about ten times rarer, found by Beno Gutenberg and Charles Richter.">Gutenberg–Richter law</dfn>.</p>
<p>But each step up releases 32 times more energy, so the few largest earthquakes win: the 137 of magnitude 7 or more — 3% of the catalogue — released 84% of its energy. A single magnitude 9 releases nearly as much as all 4,516 together.</p>`,
			notes: `<p>Fitting the catalogue gives a "b-value" of 1.0: log₁₀ N = a − b M, with N the number at or above magnitude M. Earthquakes smaller than 5.5 follow the same rule, down to tiny ones: there are about one and a half million earthquakes of magnitude 2 or more every year, mostly too small to feel. The catalogue mixes magnitudes measured in slightly different ways, as real catalogues do.</p>`
		},
		{
			id: 'interior',
			chapter: 'whole',
			title: 'What the waves revealed',
			scene: 'earth',
			hints: { phase: 'summary' },
			duration: 30,
			controls: [quake],
			body: `
<p>No one has ever drilled deeper than 12 km, a fifth of 1% of the way to the centre. Everything we know about the inside of the Earth from there down comes mostly from listening to earthquakes: the bending of the rays, the shadows and the faint waves in between.</p>
<ul>
<li>The <strong>crust</strong> and the solid <strong>mantle</strong> carry both kinds of wave, faster and faster with depth.</li>
<li>The <strong>outer core</strong> stops S waves: it is liquid. It slows P waves and casts their shadow.</li>
<li>The <strong>inner core</strong> speeds P waves up again and sends them into the shadow: it is solid.</li>
</ul>
<p>The same earthquake was recorded by seismometers all round the world: the ones nearby told us where it struck, and the waves reaching the far side crossed the core. Every recording that locates an earthquake is also a reading of the inside of the Earth.</p>`,
			notes: `<p>The sharp boundary at the base of the crust is the Mohorovičić discontinuity, found by Andrija Mohorovičić in 1909 from earthquake waves that had dipped into the faster mantle and overtaken the direct ones. Today seismic tomography goes further: by combining millions of travel times it maps hotter, slower and colder, faster regions inside the mantle in three dimensions — sinking plates and rising plumes.</p>`
		}
	]
};
