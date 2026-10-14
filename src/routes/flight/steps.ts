import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

// ---- controls ------------------------------------------------------------------------

const angle = (max = 15): Control => ({
	type: 'range',
	id: 'angle',
	label: 'Angle of attack',
	min: -6,
	max,
	step: 0.5,
	default: 5,
	format: (v) => `${v.toFixed(1)}°`,
	help: 'The tilt of the wing against the oncoming air.'
});
const angleWide = angle(20);
const angleIdeal = angle(15);

const camber: Control = {
	type: 'range',
	id: 'camber',
	label: 'Camber (curve of the centre line)',
	min: 0,
	max: 6,
	step: 0.5,
	default: 2,
	format: (v) => `${v.toFixed(1)}% of the chord`
};
const thickness: Control = {
	type: 'range',
	id: 'thickness',
	label: 'Thickness',
	min: 6,
	max: 18,
	step: 1,
	default: 12,
	format: (v) => `${v}% of the chord`
};

const speed: Control = {
	type: 'range',
	id: 'speed',
	label: 'Airspeed',
	min: 45,
	max: 120,
	step: 1,
	default: 100,
	format: (v) => `${v} kt (${Math.round(v * 1.852)} km/h)`,
	help: 'True airspeed, in knots (nautical miles per hour), the unit pilots use.'
};
const altitude: Control = {
	type: 'range',
	id: 'altitude',
	label: 'Altitude',
	min: 0,
	max: 14000,
	step: 500,
	default: 0,
	format: (v) =>
		`${v.toLocaleString('en-GB')} ft (${Math.round(v * 0.3048).toLocaleString('en-GB')} m)`,
	help: 'Up to the 172’s service ceiling, 14 000 ft.'
};
const thrust: Control = {
	type: 'range',
	id: 'thrust',
	label: 'Thrust',
	min: 0,
	max: 2500,
	step: 10,
	default: 1630,
	format: (v) => `${v.toLocaleString('en-GB')} N`,
	help: 'The propeller’s pull, set directly.'
};
const view: Control = {
	type: 'select',
	id: 'view',
	label: 'Plot',
	default: 'speed',
	options: [
		{ value: 'speed', label: 'drag against speed' },
		{ value: 'polar', label: 'drag polar' }
	]
};

export const spec: ExplainerSpec = {
	slug: 'flight',
	title: 'Flight',
	summary:
		'Tilt a wing in a stream of air and watch the air turn downwards, the pressure drop above it and lift grow until the wing stalls. Then balance lift, weight, thrust and drag to fly a real Cessna 172 at any speed and height.',
	chapters: [
		{ id: 'air', title: 'Air round a wing' },
		{ id: 'lift', title: 'How much lift' },
		{ id: 'fly', title: 'Flying an aeroplane' }
	],
	steps: [
		// ------------------------------------------------------------------ air
		{
			id: 'wing',
			chapter: 'air',
			title: 'A wing in a stream of air',
			scene: 'flow',
			hints: { phase: 'wing' },
			duration: 18,
			controls: [angleIdeal, speed],
			body: `
<p>An aeroplane in flight moves through still air. Seen from the wing, the air streams past it: the same thing, as in a wind tunnel. Here is a slice through a wing, a <dfn data-def="The shape of a slice through a wing, from front to back; also called an aerofoil or airfoil.">wing section</dfn>, with the air arriving from the left. The lines are <dfn data-def="Lines that follow the air's motion: at every point the air moves along the line through it. Air never crosses a streamline.">streamlines</dfn>, the paths the air follows, and the dots are small parcels of air carried along them.</p>
<p>The straight line from the rounded front, the <em>leading edge</em>, to the sharp back, the <em>trailing edge</em>, is the <dfn data-def="The straight line from a wing section's leading edge to its trailing edge; its length is the chord length.">chord</dfn>. The angle between the chord and the oncoming air is the <dfn data-def="The angle between a wing's chord line and the direction of the oncoming air.">angle of attack</dfn>. Tilt the wing and watch the streamlines: the air is bent round the wing, and the upward arrow, the <strong>lift</strong>, grows.</p>
<p>Speed changes nothing in the pattern, only how fast the air runs along it, and how strong the push.</p>`,
			notes: `<p>The flow is exact for an ideal fluid: no viscosity, no compression. It is computed with the <dfn data-def="The map z = ζ + 1/ζ, which turns a circle into a wing-like shape. The flow round a circle is easy to write down, and the map carries it over to the wing.">Joukowski transform</dfn>, which turns the known flow round a cylinder into the flow round a wing-like section. The section shown, 12% thick with 2% camber, is close to the NACA 2412 of the Cessna 172's wing, though not identical. The air is drawn about 150 times slower than life: at 100 knots it passes a 1.5 m wing in three hundredths of a second.</p>`
		},
		{
			id: 'turning',
			chapter: 'air',
			title: 'Lift comes from turning the air downwards',
			scene: 'flow',
			hints: { phase: 'turning' },
			duration: 20,
			controls: [angleIdeal],
			body: `
<p>Follow the streamlines. Ahead of the wing the air rises to meet it (<dfn data-def="Air rising ahead of a wing as it approaches it.">upwash</dfn>); behind, it leaves the trailing edge heading <strong>downwards</strong> (<dfn data-def="Air pushed downwards behind a wing. Behind a real wing it persists for a long way: it is the air's reaction to the lift.">downwash</dfn>). The wing has turned the air passing it.</p>
<p>Turning air down means giving it a downward push, and by <a href="../newtons-laws/#pair">Newton's third law</a> the air pushes the wing up just as hard. That push is the lift. More angle, more turning, more lift; at zero angle this curved wing still turns the air a little.</p>
<p>A wing, then, is a device for pushing air downwards. A 1.2-tonne aeroplane in level flight has to give the air passing it, every second, a downward momentum equal to its weight.</p>`,
			notes: `<p>In the two-dimensional ideal flow drawn here, the upwash ahead and the downwash behind balance far away from the wing, and the downward push is passed on to the ground through the pressure field. A real wing has tips: air spills round them into two trailing vortices, which keep a broad stream of air moving downwards long after the plane has gone, and the downward momentum given to that air each second equals the lift. That turning costs energy, and it is the <em>induced drag</em> you will meet later.</p>`
		},
		{
			id: 'pressure',
			chapter: 'air',
			title: 'Low pressure above, higher below',
			scene: 'flow',
			hints: { phase: 'pressure' },
			duration: 22,
			controls: [angleIdeal],
			body: `
<p>How does the air push on the wing? Only through pressure: the air presses on every bit of the surface. The colours show the pressure compared with the undisturbed air: <strong>blue lower, red higher</strong>. The arrows on the surface point outward where the air pulls (lower pressure) and inward where it pushes.</p>
<p>To bend the air round the curved top, the pressure there must be lower than further out, like the string pulling a whirled ball inwards. Above the wing the pressure drops well below the surrounding air's, most of all just behind the leading edge. Below, the air is slowed and the pressure rises. <strong>Lower pressure above than below: that difference, over the whole wing, is the lift.</strong></p>
<p>The pressure map and the turned air are not two rival explanations. They are the same thing: the pressure differences are what turn the air, and the turned air is what keeps the pressure differences going.</p>`,
			notes: `<p>The colour is the pressure coefficient C<sub>p</sub> = (p − p<sub>∞</sub>)/(½ρV²): 0 is the pressure of the undisturbed air, +1 the most the air can push (where it comes to rest, at the front), and suction peaks reach −2 or lower. Along a streamline, faster air has lower pressure (Bernoulli's principle, energy conservation for a fluid): the speed and the pressure change together. At 100 knots ½ρV² is 1.6 kPa, so over the top of the wing the pressure is only a percent or two below that of the air around: spread over 16 m² of wing, enough to hold up an aeroplane.</p>`
		},
		{
			id: 'transit',
			chapter: 'air',
			title: 'Not "equal transit time"',
			scene: 'flow',
			hints: { phase: 'transit' },
			duration: 22,
			controls: [angleIdeal, speed],
			body: `
<p>A popular explanation says: the top of the wing is longer, the air going over it must "catch up" with the air going under, so it goes faster and the pressure drops. <strong>It is wrong.</strong> Nothing makes the two meet again.</p>
<p>Watch: lines of air parcels are released at the same instant, side by side, upstream. When they reach the wing, the parcels going over the top race ahead and leave the trailing edge long before their neighbours from underneath. Once past, they <strong>never meet again</strong>. The air on top is faster than equal transit would need, which would only explain a fraction of the lift.</p>
<p>The top isn't faster because its path is longer either: a thin curved sheet has the same length top and bottom and lifts perfectly well. The air on top is faster because the low pressure there pulls it along, as the last step showed.</p>`,
			notes: `<p>This is seen in wind tunnels by releasing pulses of smoke (H. Babinsky, "How do wings work?", Physics Education 38, 497, 2003). Turn the angle to zero on a symmetric wing (next step) and the two halves do arrive together, because there is then no lift. The times shown are for a wing with the Cessna 172's mean chord, 1.47 m.</p>`
		},
		{
			id: 'shape',
			chapter: 'air',
			title: 'The shape: camber and thickness',
			scene: 'flow',
			hints: { phase: 'shape' },
			duration: 22,
			controls: [angleIdeal, camber, thickness],
			body: `
<p>Change the wing's shape. A <strong>symmetric</strong> wing (no camber) makes no lift at zero angle of attack: it turns the air no more one way than the other. Tilt it and it lifts, upside down as well as right way up, which is how aerobatic planes fly inverted.</p>
<p>A <dfn data-def="The curve of a wing section's centre line, half-way between its top and bottom surfaces, measured as the greatest distance of that line from the chord.">cambered</dfn> wing, curved like a bird's, turns the air down even at zero angle, and lifts until it is tilted slightly nose-down: its <dfn data-def="The angle of attack at which a wing section makes no lift. Negative for a cambered section.">zero-lift angle</dfn> is negative. Camber adds lift at every angle. Thickness changes the lift little; it gives the wing room for a strong spar and fuel, and a rounded nose that the air can follow at higher angles.</p>`,
			notes: `<p>Thin-airfoil theory gives the zero-lift angle from the shape of the centre line alone. For the NACA 2412 of the Cessna 172 (2% camber, highest at 40% of the chord) it is −2.1°. The Joukowski section of the same camber shown here has −2.3°: the two shapes differ a little.</p>`
		},
		// ------------------------------------------------------------------ lift
		{
			id: 'slope',
			chapter: 'lift',
			title: 'Lift grows in step with the angle',
			scene: 'lift',
			hints: { phase: 'slope' },
			duration: 20,
			controls: [angleIdeal],
			body: `
<p>Engineers measure lift with a number that doesn't depend on the wing's size or speed: the <dfn data-def="Lift divided by the dynamic pressure ½ρV² and the wing area (or, for a section, the chord). It depends on the wing's shape and angle of attack, not its size or speed.">lift coefficient</dfn>, C<sub>L</sub>. For a thin wing, theory gives a strikingly simple answer: C<sub>L</sub> grows in proportion to the angle of attack, by <strong>2π per radian</strong>, or 0.11 per degree.</p>
<p>The plot shows that line, the ideal flow round the thick section of the earlier steps, which lifts a little more (0.12 per degree), and the lift measured on a real wing section, the symmetric NACA 0012, in a NASA wind tunnel. The real wing lifts slightly less than the ideal, 0.106 per degree, because the thin layer of air rubbing along its surface, the <dfn data-def="The thin layer of air next to a surface, slowed by friction (viscosity). Outside it the flow is nearly ideal.">boundary layer</dfn>, slightly spoils the turning. But up to about 12° the theory is excellent.</p>`,
			notes: `<p>The measurements are from C. L. Ladson, NASA TM-4074 (1988): the NACA 0012 in the Langley Low-Turbulence Pressure Tunnel at a Reynolds number of 6 million (a 1.5 m wing at about 60 m/s), with the transition to turbulence fixed by a strip of grit near the nose, in three runs with three grits. The ideal-flow curve is the 12% symmetric Joukowski section, close to the NACA 0012 in shape. Thin-airfoil theory (Max Munk, 1922; Hermann Glauert, 1926) replaces the wing by its centre line covered in small vortices.</p>`
		},
		{
			id: 'lift-equation',
			chapter: 'lift',
			title: 'The lift equation',
			scene: 'lift',
			hints: { phase: 'equation' },
			duration: 22,
			controls: [angleIdeal, speed, altitude],
			body: `
<p>The lift coefficient is a ratio. To get the force, multiply it by the wing area S and by the <dfn data-def="½ρV²: the pressure the air would exert if it were brought to rest; the natural pressure scale of a flow at speed V and density ρ.">dynamic pressure</dfn> ½ρV², which depends on the air's density ρ and the speed V:</p>
<p class="formula"><strong>L = ½ ρ V² S C<sub>L</sub></strong></p>
<p>Lift grows with the <em>square</em> of the speed: twice as fast, four times the lift. At 100 knots at sea level, ½ρV² is 1620 Pa. The card works out the lift of the whole wing of a Cessna 172, 16.2 m², as if it all behaved like this section.</p>
<p>Climb and the air thins (as in <a href="../rockets/#losses">the rocket's ascent</a>): at 10 000 ft it is 26% less dense, and the same wing at the same angle and speed lifts 26% less.</p>`,
			notes: `<p>A real wing of finite span lifts less than its section at the same angle, because air spills round the tips: for the 172's wing (span 11.0 m, aspect ratio 7.5), Prandtl's lifting-line theory gives about 0.087 per degree instead of 0.11. The last chapter uses that. Density is from the U.S. Standard Atmosphere 1976.</p>`
		},
		{
			id: 'stall',
			chapter: 'lift',
			title: 'The stall',
			scene: 'lift',
			hints: { phase: 'stall' },
			duration: 24,
			controls: [angleWide],
			body: `
<p>Keep tilting. To follow the top surface, the air has to flow from the low pressure near the nose into the higher pressure at the trailing edge, uphill, and the slow air of the boundary layer runs out of momentum. At some angle it stops following the surface and breaks away: the flow <dfn data-def="When the air stops following a surface and breaks away from it, leaving a churning wake.">separates</dfn>, leaving a churning wake over the wing.</p>
<p>Then the air is no longer turned down well and the lift collapses: the wing <dfn data-def="The sudden loss of lift when the angle of attack is too large and the flow separates from the top of the wing.">stalls</dfn>. The NACA 0012 measured by NASA reaches its most lift, C<sub>L</sub> = 1.61, at 17.1°; one degree further the lift has fallen by more than a third and the drag has jumped seven times.</p>
<p>A stall depends on the angle, not the speed. Flying slowly needs a larger angle, so that is where pilots meet it.</p>`,
			notes: `<p>The separated flow in the drawing is schematic: the ideal-flow model of the earlier steps has no viscosity, so it cannot separate and would go on lifting for ever. The stall angle used for the other shapes in this explainer is the NACA 0012's, counted from each shape's zero-lift angle, a rough rule. Thin sections with sharp noses stall earlier and more gently; slots, flaps and the shape of the nose all change it.</p>`
		},
		{
			id: 'drag',
			chapter: 'lift',
			title: 'Drag, and the best speed',
			scene: 'drag',
			hints: { phase: 'drag' },
			duration: 24,
			controls: [speed, view],
			body: `
<p>The ideal flow makes no drag at all. Real air does: friction in the boundary layer, and the pressure of the wake, give the NACA 0012 a drag coefficient of only 0.008. A whole aeroplane, with its fuselage, wheels and struts, has far more: this <dfn data-def="The drag that doesn't depend on lift: skin friction and the pressure drag of the fuselage, wheels, struts and wings. It grows with the square of the speed.">parasite drag</dfn> grows with ½ρV², like lift.</p>
<p>Lift itself has a cost, the <dfn data-def="The drag that comes with making lift on a wing of finite span: the energy given to the downwash and the tip vortices. It falls with the square of the speed.">induced drag</dfn>: the energy left in the downwash behind a real wing. It is largest when flying slowly, at a large angle, and falls with the square of the speed.</p>
<p>Add the two and the total drag is lowest in between: for the Cessna 172S at full weight, at <strong>68 knots</strong>, where it is 1250 N, a ninth of the weight. That is the speed its handbook gives for the longest glide: about 1.5 nautical miles forward for every 1000 ft of height, a glide ratio of 9.</p>`,
			notes: `<p>The 172's curve is a parabolic drag polar, C<sub>D</sub> = C<sub>D0</sub> + kC<sub>L</sub>², fitted to two figures in its Pilot's Operating Handbook: the best glide speed, 68 KIAS (68.4 knots calibrated), and the glide chart (Fig. 3-1), from which the glide ratio reads 9.05 at 2550 lb. At the best glide the two drags are equal, which gives C<sub>D0</sub> = 0.051 and an efficiency factor e = 0.71. This polar is for a glide, with the propeller windmilling, which adds drag: with the engine running the plane is cleaner, and this polar would wrongly need more than its 180 hp at its 126-knot top speed. Switch the plot to the polar to see C<sub>L</sub> against C<sub>D</sub>: the line from the origin that just touches it marks the best glide, and the NACA 0012's measured drag shows how small the wing section's share is.</p>`
		},
		// ------------------------------------------------------------------ fly
		{
			id: 'cessna',
			chapter: 'fly',
			title: 'Lift equals weight',
			scene: 'plane',
			hints: { phase: 'lift' },
			duration: 22,
			controls: [speed],
			body: `
<p>A real aeroplane: the Cessna 172S Skyhawk, the most-built aircraft in history. At its full 1157 kg its weight is 11.3 kN; its wing has an area of 16.2 m², a section close to the NACA 2412. In level flight the lift must equal the weight, so the lift equation tells the pilot what C<sub>L</sub>, and so what angle of attack, each speed needs.</p>
<p>Slow down and the wing must be tilted further: at 100 knots C<sub>L</sub> = 0.43, about 3°; at 60 knots, 1.2. The largest C<sub>L</sub> the 172's wing can reach follows from its handbook: it stalls at 53 knots, which means C<sub>L,max</sub> = <strong>1.54</strong>. Slower than that, no angle gives enough lift.</p>`,
			notes: `<p>Figures from the Pilot's Operating Handbook of the Model 172S (Cessna, 1998, revision 5): maximum weight 2550 lb, wing area 174 sq ft, stall speed with flaps up and power off 53 knots calibrated airspeed. The angle of attack is that of the wing, from thin-airfoil theory for the NACA 2412 (zero lift at −2.1°) and Prandtl's lifting-line slope for its aspect ratio; the fuselage carries a little lift too, and the plane's attitude also depends on how the wing is set on it, ignored here. With flaps down the stall is at 48 knots.</p>`
		},
		{
			id: 'altitude',
			chapter: 'fly',
			title: 'Higher up, faster through thinner air',
			scene: 'plane',
			hints: { phase: 'altitude' },
			duration: 22,
			controls: [speed, altitude],
			body: `
<p>Climb, and the air thins: at 10 000 ft (3 km) its density is 0.905 kg/m³, 74% of sea level's. To make the same lift at the same angle, ½ρV² must be the same, so the plane must fly faster through the air: √(1/0.74), 16% faster. The stall, at 53 knots at sea level, comes at 62 knots of true airspeed at 10 000 ft.</p>
<p>The pilot doesn't have to work this out. The airspeed indicator measures the dynamic pressure itself, from the air rammed into a forward-facing tube, so its reading, the <dfn data-def="The speed shown by an aircraft's airspeed indicator, which measures the dynamic pressure ½ρV². It equals the true airspeed only at sea-level density.">indicated airspeed</dfn>, is the one that matters for lift: the 172 stalls at the same indicated speed at any height.</p>`,
			notes: `<p>Calibrated airspeed (the indicated reading corrected for the instrument's errors) equals the equivalent airspeed V√(ρ/ρ₀) at these speeds; at airliner speeds the compressibility of the air makes them differ a little. The 172's engine also loses power as the air thins, which is why it can't climb above about 14 000 ft, its service ceiling.</p>`
		},
		{
			id: 'balance',
			chapter: 'fly',
			title: 'Four forces in balance',
			scene: 'plane',
			hints: { phase: 'balance' },
			duration: 26,
			controls: [thrust, speed, altitude],
			body: `
<p>Now all four forces. Lift balances the weight; the propeller's <strong>thrust</strong> must balance the <strong>drag</strong>. Thrust equal to drag: the plane flies level at a steady speed, with no net force on it, as <a href="../newtons-laws/#inertia">Newton's first law</a> says.</p>
<p>More thrust than drag and the extra pushes the plane up a slope: it climbs, at a rate of (thrust − drag) × speed ÷ weight. Less and it descends. At 100 knots the 172 needs about 1630 N of thrust to hold its height. Set the thrust and the speed and find the balance.</p>
<p>Speed and height change the drag, and so the thrust needed. Fly slowly, near the stall, and the drag rises again: the induced drag of a wing tilted steeply. Below the stall speed there is no balance at all.</p>`,
			notes: `<p>The model is steady flight along a straight path: L = W cos γ and T − D = W sin γ for a climb angle γ, with the thrust along the path and the drag from the glide-fitted polar of the drag step, which slightly overstates the drag with the engine running. The engine is left out: thrust is set directly. A real pilot uses the throttle and the elevator together, and with the throttle alone the 172 settles into a slow climb or descent at nearly the same speed. The handbook gives a climb rate of 730 ft per minute at sea level with full power.</p>`
		},
		{
			id: 'takeaway',
			chapter: 'fly',
			title: 'How a wing flies',
			scene: 'flow',
			hints: { phase: 'summary' },
			duration: 20,
			controls: [angleIdeal],
			body: `
<p>Everything on this page follows from one fact: the air passing a tilted, curved wing is turned downwards. Turning it takes a pressure field, low above the wing and higher below, and that pressure difference over the wing's area is the lift: ½ρV²SC<sub>L</sub>, with C<sub>L</sub> growing by 2π per radian of angle until the flow breaks away and the wing stalls.</p>
<p>Flight is then a balance: lift against weight, thrust against drag. The same physics holds a gull, a glider and a 400-tonne airliner in the sky.</p>
<p><strong>A wing generates lift by turning the passing air downward, which appears as lower pressure above the wing than below it.</strong></p>`
		}
	]
};
