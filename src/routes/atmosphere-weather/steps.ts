import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const transport: Control = {
	type: 'range',
	id: 'transport',
	label: 'Heat carried by winds and currents',
	min: 0,
	max: 2,
	step: 0.05,
	default: 1,
	format: (v) => (v === 0 ? 'none' : v === 1 ? 'as on Earth' : `${v.toFixed(2)} × Earth's`)
};

const spin: Control = {
	type: 'range',
	id: 'spin',
	label: 'How fast the planet spins',
	min: 0,
	max: 3,
	step: 0.05,
	default: 1,
	format: (v) =>
		v === 0
			? 'not at all'
			: v === 1
				? 'like Earth (1 day)'
				: `${v.toFixed(2)} × Earth (a ${(24 / v).toFixed(1)}-hour day)`
};

const launch: Control = {
	type: 'action',
	id: 'launch',
	label: 'Send off more air',
	action: 'Send off more air',
	help: 'Push new parcels of air north, south, east and west.'
};

const hemisphere: Control = {
	type: 'select',
	id: 'hemisphere',
	label: 'Hemisphere',
	default: 'north',
	options: [
		{ value: 'north', label: 'Northern' },
		{ value: 'south', label: 'Southern' }
	]
};

const addLow: Control = { type: 'action', id: 'addLow', label: 'Add a low', action: 'Add a low' };
const addHigh: Control = {
	type: 'action',
	id: 'addHigh',
	label: 'Add a high',
	action: 'Add a high'
};
const clearMap: Control = {
	type: 'action',
	id: 'clearMap',
	label: 'Clear the map',
	action: 'Clear the map',
	help: 'Drag the H and L markers to move them; drag their edge to make them stronger or weaker.'
};

const sst: Control = {
	type: 'range',
	id: 'sst',
	label: 'Sea surface temperature',
	min: 20,
	max: 31,
	step: 0.5,
	default: 29,
	unit: ' °C'
};

const latitude: Control = {
	type: 'range',
	id: 'latitude',
	label: 'Latitude',
	min: 0,
	max: 40,
	step: 1,
	default: 15,
	unit: '° N'
};

const restartStorm: Control = {
	type: 'action',
	id: 'restartStorm',
	label: 'Start a new storm',
	action: 'Start a new storm'
};

export const spec: ExplainerSpec = {
	slug: 'atmosphere-weather',
	title: 'Why the wind blows',
	summary:
		'Heat a planet unevenly and spin it: watch convection cells, trade winds and westerlies appear, steer air round highs and lows, and warm the sea to grow a hurricane.',
	chapters: [
		{ id: 'heat', title: 'Too hot, too cold' },
		{ id: 'spin', title: 'A spinning planet' },
		{ id: 'weather', title: 'Highs, lows and fronts' },
		{ id: 'storms', title: 'Hurricanes' }
	],
	steps: [
		// ------------------------------------------------------------------ heat
		{
			id: 'sunlight',
			chapter: 'heat',
			title: 'Uneven sunshine',
			scene: 'balance',
			hints: { phase: 'sunlight' },
			duration: 20,
			body: `
<p>The Sun heats the Earth unevenly. Near the equator it is high in the sky and its light falls almost straight down; near the poles the same beam of light arrives at a slant and is spread over a much larger area. Averaged over a year, the top of the atmosphere at the equator gets about 420 watts of sunlight on every square metre, the poles less than half that.</p>
<p>The Earth also loses heat, radiating it to space as invisible <dfn data-def="Light with longer wavelengths than red light, which we feel as heat. Everything warm gives it off.">infrared</dfn> light — and warmer places radiate more. Compare the two curves: in the tropics more sunlight is absorbed than heat is radiated away; towards the poles, more is radiated than absorbed.</p>`,
			notes: `<p>Not all the sunlight is absorbed: clouds, ice and snow reflect some of it straight back (about 30% on average, more near the poles). The curves on the right are from a simple <dfn data-def="A model that balances, at each latitude, the sunlight absorbed, the heat radiated to space and the heat carried to or from neighbouring latitudes.">energy-balance model</dfn> of the climate (Budyko and Sellers, 1969).</p>`
		},
		{
			id: 'transport',
			chapter: 'heat',
			title: 'Weather moves the heat',
			scene: 'balance',
			hints: { phase: 'transport' },
			duration: 24,
			controls: [transport],
			body: `
<p>If each place had to balance its own books — radiating exactly what it absorbs — the equator would bake at nearly 60 °C and the poles freeze below −55 °C. Slide the heat transport to zero to see that world.</p>
<p>The real Earth is far milder, because the extra heat of the tropics is <strong>carried towards the poles</strong>, by the winds and the ocean currents. At its peak, near 35° latitude, about 6 <dfn data-def="Petawatt: a million billion watts (10¹⁵ W). 6 PW is several hundred times all the power humanity uses.">petawatts</dfn> flow polewards in each hemisphere — hundreds of times all the power humanity uses.</p>
<p>That is what weather is, on the largest scale: <strong>the atmosphere moving heat from the equator towards the poles</strong>. The rest of this page is about how it does it.</p>`,
			notes: `<p>In the model, the heat flow from a warm latitude to a cooler one is taken to be proportional to the temperature difference, like heat spreading along a metal bar. The atmosphere does most of the job outside the tropics, the oceans a large share inside them; the transport slider stands for both. The model's averages come out close to today's: about 28 °C at the equator, 14 °C for the whole planet.</p>`
		},
		// ------------------------------------------------------------------ spin
		{
			id: 'convection',
			chapter: 'spin',
			title: 'A giant convection loop',
			scene: 'cells',
			hints: { phase: 'convection', spin: 0 },
			duration: 22,
			body: `
<p>How does air carry heat? The same way a pan of water heated from below does: warm air is less dense, so it rises; cool air sinks. Over the hot equator, air rises high into the atmosphere, flows towards the poles up there, cools, sinks, and flows back to the equator along the ground. This loop is a <dfn data-def="A circulation driven by heating from below: warm fluid rises, spreads, cools, sinks and flows back to be heated again.">convection cell</dfn>.</p>
<p>If the Earth did not spin, there would be one huge cell in each hemisphere, and the wind at the ground would blow steadily from the poles to the equator everywhere. George Hadley proposed this picture in 1735. It is not what we see: at our latitudes the wind blows mostly from the west. The missing piece is the Earth's spin.</p>`
		},
		{
			id: 'coriolis',
			chapter: 'spin',
			title: 'The Coriolis effect',
			scene: 'coriolis',
			hints: { phase: 'coriolis' },
			duration: 26,
			controls: [spin, launch],
			body: `
<p>The Earth turns once a day, and we turn with it. Air that is set moving keeps going in a straight line in space — but the ground turns underneath it. Seen from the ground, moving air seems to be pushed sideways: to the <strong>right</strong> in the northern hemisphere, to the <strong>left</strong> in the southern. This apparent push is the <dfn data-def="The apparent sideways deflection of anything moving freely over a rotating planet, seen by someone turning with the planet. It acts at right angles to the motion: to the right in the northern hemisphere, to the left in the southern.">Coriolis effect</dfn>.</p>
<p>Watch parcels of air pushed off in different directions. They curve into loops — a couple of hundred kilometres across at the speed of a fresh breeze — and the turn is strongest near the poles and vanishes at the equator. Slow the planet's spin and the curving fades; stop it and the air goes straight.</p>`,
			notes: `<p>The size of the effect is set by f = 2Ω sin(latitude), where Ω is the Earth's rate of turning. A parcel with nothing else pushing it goes round an "inertial circle" of radius speed ÷ f, once every half a <em>pendulum day</em> (about 17 hours at 45°).</p>`
		},
		{
			id: 'cells',
			chapter: 'spin',
			title: 'Three cells and the prevailing winds',
			scene: 'cells',
			hints: { phase: 'cells' },
			duration: 26,
			controls: [spin],
			body: `
<p>On the spinning Earth the single loop breaks up. Air flowing back to the equator along the ground is turned to its right (in the north): it becomes the steady <strong>trade winds</strong>, blowing from the north-east. The cell they belong to, the <dfn data-def="The circulation between the equator and about 30° latitude: rising air at the equator, sinking air in the subtropics, trade winds at the surface.">Hadley cell</dfn>, only reaches about 30° before the sideways push makes it unable to go further.</p>
<p>Beyond it, from about 30° to 60°, lie the <strong>westerlies</strong>, which bring weather to Europe and North America from the west; near the poles, cold easterlies. Slide the spin: a slower planet has a wider Hadley cell and fewer bands; a faster one more, narrower bands — like the stripes of Jupiter, which turns once every ten hours.</p>`,
			notes: `<p>The Hadley cell's width here comes from Held and Hou's theory (1980), which predicts it shrinks in proportion to the spin rate. The other cells are drawn to fill the rest of each hemisphere; the middle-latitude "Ferrel cell" is really the average effect of the passing highs and lows of the next chapter, not a smooth loop. Where air sinks, near 30°, skies are clear and dry: most of the great deserts lie there.</p>`
		},
		{
			id: 'sink',
			chapter: 'spin',
			title: 'Not in your sink',
			scene: 'coriolis',
			hints: { phase: 'scale' },
			duration: 22,
			body: `
<p>A popular story says the Coriolis effect makes water swirl one way down a plughole in the northern hemisphere and the other way in the southern. It doesn't.</p>
<p>The Coriolis effect only matters for motions that last long enough for the Earth to turn appreciably while they happen — many hours. The <dfn data-def="Speed ÷ (Coriolis parameter × size). Much bigger than 1: the Earth's spin barely matters. About 1 or less: it shapes the flow.">Rossby number</dfn> compares the two: for a sink it is thousands — the water drains in seconds, and the way it swirls is set by the shape of the basin and how the water was moving when the plug was pulled. For a hurricane it is about 1, and for a weather system a thousand kilometres across about 0.1: there, the Earth's spin is in control.</p>`,
			notes: `<p>Careful experiments in perfectly still water, left to settle for a day in a large round tank, have detected the Coriolis effect on draining water (Shapiro, 1962). Your kitchen sink is not that experiment.</p>`
		},
		// ------------------------------------------------------------------ weather
		{
			id: 'pressure',
			chapter: 'weather',
			title: 'Highs and lows',
			scene: 'map',
			hints: { phase: 'pressure' },
			duration: 30,
			controls: [addLow, addHigh, clearMap, hemisphere],
			body: `
<p>Zoom in to a weather map. Air pressure varies from place to place: a <dfn data-def="An area where the air pressure at the ground is lower than around it; associated with rising air, clouds and rain.">low</dfn> (L) is a region of lower pressure, a <dfn data-def="An area where the air pressure at the ground is higher than around it; associated with sinking air and settled, dry weather.">high</dfn> (H) of higher pressure. The lines are <dfn data-def="Lines joining places with the same air pressure.">isobars</dfn>. Air is pushed from high pressure towards low — but on its way the Coriolis effect turns it, until the push and the turn balance and the wind blows <em>along</em> the isobars, round the centres.</p>
<p>In the northern hemisphere, winds go anticlockwise round lows and clockwise round highs; switch to the southern hemisphere and they reverse. Near the ground, friction slows the wind and it drifts in towards the low, which is why air rises there, cools and makes clouds and rain. Drag the systems around and add your own.</p>`,
			notes: `<p>The winds drawn are the <dfn data-def="The wind for which the push from high to low pressure is exactly balanced by the Coriolis effect, blowing along the isobars; a good approximation above the lowest kilometre of air.">geostrophic wind</dfn> above the ground, and near the ground the same turned about 30° towards low pressure and slowed. The closer together the isobars, the stronger the wind.</p>`
		},
		{
			id: 'fronts',
			chapter: 'weather',
			title: 'Fronts',
			scene: 'map',
			hints: { phase: 'fronts' },
			duration: 30,
			controls: [addLow, addHigh, clearMap],
			body: `
<p>In the middle latitudes, warm air from the south meets cold air from the north. A low stirs them: its winds carry warm air north on one side and cold air south on the other, and squeeze them together into narrow zones where the temperature changes sharply — <dfn data-def="The boundary at the ground between two air masses of different temperature. Where cold air advances it is a cold front; where warm air advances, a warm front.">fronts</dfn>.</p>
<p>Watch the colours: within a day or two the low wraps the air into a spiral. Where warm air pushes forward it rides up over the cold air in a long gentle slope, a <strong>warm front</strong> with steady rain; where cold air pushes forward it digs under the warm air, a <strong>cold front</strong> with a sharp band of showers. Place a low somewhere else and watch new fronts form.</p>`,
			notes: `<p>Here the air's temperature is simply carried along by the winds of the systems on the map, which stay put; in reality the low itself grows from the temperature contrast, moves east with the westerlies and eventually wraps itself up and fades.</p>`
		},
		// ------------------------------------------------------------------ storms
		{
			id: 'hurricane',
			chapter: 'storms',
			title: 'A hurricane: an engine run on warm sea',
			scene: 'storm',
			hints: { phase: 'hurricane' },
			duration: 30,
			controls: [sst, latitude, restartStorm],
			body: `
<p>A hurricane is a heat engine. Over a warm sea, water evaporates into the wind; as the moist air spirals in and rises in tall thunderstorms around the eye, the water vapour condenses and releases its heat, which drives the winds faster still, which evaporate more water.</p>
<p>It only works over a sea warmer than about <strong>26.5 °C</strong>: warm the sea and the storm can grow stronger, up to category 5. Cool it below that and the storm dies away — as hurricanes do when they move over land or cool water. And it needs the Coriolis effect to start spinning: within about 5° of the equator, where it fades away, hurricanes almost never form.</p>
<p>In the end a hurricane is the most violent example of the rule of this page: it moves heat — from the warm ocean, up into the atmosphere and towards the poles.</p>`,
			notes: `<p>The strongest wind a storm can reach over a given sea temperature here follows an empirical fit to Atlantic hurricanes (DeMaria and Kaplan, 1994). The growth over a few days is a smooth sketch: real storms are also weakened by winds that change with height, dry air and the cooler water they churn up. The same storms are called typhoons in the north-west Pacific and cyclones in the Indian Ocean; in the southern hemisphere they spin the other way.</p>`
		}
	]
};
