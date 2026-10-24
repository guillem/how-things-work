/**
 * A gravity toilet, flushed: the tank and its flapper, the bowl, the bend behind the bowl (the
 * trapway) and the float valve that refills the tank, as a lumped model of a few water levels.
 *
 * Heights are in metres, measured from the top of the bend (its crest, or weir): the bowl's water
 * stands level with it at rest. Volumes are in litres, flows in litres a second.
 *
 * - The tank empties through the open flapper as water does through a hole (Torricelli): the flow
 *   grows with the square root of the water's height above the hole, plus the drop to the bowl's
 *   rim. The flapper falls shut when the tank is nearly empty.
 * - The bowl's water spills over the top of the bend as over a weir (the flow grows with the
 *   height above the crest to the power 3/2).
 * - The bend can carry that spill down its long side as long as air can get past it. Water that
 *   comes over faster than the bend can carry away (`primeFlow`) backs up and fills it; once the
 *   bend runs full, it is a siphon: the water falling down the long side, with nothing but water
 *   behind it, keeps the bend running full, and the air pressing on the bowl's surface pushes the
 *   bowl's water in behind it. The siphon's flow is that of a full pipe whose outlet is
 *   `outletDrop` below the bowl's surface, with the losses of its bends. When the bowl's surface
 *   falls to the top of the bend's inlet, air gets in, the siphon breaks and the bowl gurgles.
 *   The priming threshold is the page's simplification: a real bend's depends on its shape.
 * - A washdown bowl has a wide, short bend that the tank's rush can never fill: it never siphons,
 *   and the flush only pushes the bowl's extra water over the top.
 * - The fill valve runs while its float is below the water line it is set to, and closes as the
 *   rising water lifts the float; part of its flow goes down the refill tube into the overflow
 *   pipe, to top up the bowl. Tank water above the overflow pipe's top pours into it.
 */

export const G = 9.81;

/**
 * Water a full flush uses: 1.6 US gallons (6.06 L), the US limit since 1994 (Energy Policy Act of
 * 1992), and the usual full flush in Europe (6 L).
 */
export const FLUSH_LITRES = 6;
/** Inside of the tank, m²: about 45 cm by 10 cm of water seen from above (an estimate). */
export const TANK_AREA = 0.045;
/** Height of the tank's water above the flapper's seat at which the flapper falls shut, m. */
export const FLAPPER_CLOSE = 0.03;
/** The tank's water line, set by the float, m above the flapper's seat: 6 L above the closing level. */
export const WATER_LINE = FLAPPER_CLOSE + FLUSH_LITRES / 1000 / TANK_AREA;
/** Top of the overflow pipe, m above the flapper's seat: a little over the water line. */
export const OVERFLOW_TOP = WATER_LINE + 0.025;
/** The flapper's opening (a 2-inch flush valve) times its discharge coefficient (0.6), m². */
export const VALVE_AREA = 0.6 * Math.PI * 0.0254 ** 2;
/** Drop from the flapper's seat to the holes under the bowl's rim, m (an estimate). */
export const VALVE_DROP = 0.1;

/**
 * Depth of the water seal: from the top of the bend down to the top of its inlet at the bottom of
 * the bowl. ASME A112.19.2 asks for at least 2 inches (51 mm).
 */
export const SEAL = 0.051;
/** The bowl's rim, m above the top of the bend: water above it would spill on the floor. */
export const RIM = 0.16;
/**
 * The bowl's water surface, m², at the top of the bend's inlet, at the crest, and its growth above
 * the crest (m² per m): a resting water spot of about 25 by 16 cm, flaring towards the rim. With
 * these the bowl holds 1.4 L between the inlet and the crest (estimates).
 */
export const BOWL_AREA_LOW = 0.015;
export const BOWL_AREA = 0.04;
export const BOWL_FLARE = 0.2;
/** Coefficient of the spill over the crest, as a broad-crested weir (SI, m^½/s). */
export const WEIR = 1.7;
/** How far the bend's outlet, at the floor, is below the top of the bend, m (an estimate). */
export const OUTLET_DROP = 0.3;
/** Losses in the full bend: its entrance, two turns and the exit (an estimate). */
export const BEND_LOSSES = 1.5;

export type BowlKind = 'siphonic' | 'washdown';

export interface BowlShape {
	/** Inside width of the bend, m. */
	bore: number;
	/** Fastest spill, L/s, that the bend carries away without filling up (the page's simplification). */
	primeFlow: number;
	/** Water the bend holds when it runs full, L. */
	bendLitres: number;
}

/**
 * A siphonic bowl's bend is about 2 inches wide (ASME A112.19.2 asks that it pass a 1½-inch ball).
 * It fills once the spill tops about a litre a second: the tank's rush does that, a slow pour
 * doesn't. A washdown bowl's bend is wider and shorter, and nothing a tank delivers fills it.
 */
export const BOWLS: Record<BowlKind, BowlShape> = {
	siphonic: { bore: 0.05, primeFlow: 1.2, bendLitres: 0.6 },
	washdown: { bore: 0.08, primeFlow: 20, bendLitres: 1 }
};

/** The fill valve's flow when it is wide open, L/s, and the share that goes to the bowl. */
export const FILL_FLOW = 0.3;
export const REFILL_SHARE = 0.25;
/** The float closes the valve over the last centimetre below the water line, m. */
export const FLOAT_TRAVEL = 0.01;

/** Integration step, s. */
export const DT = 0.002;

/** A bucket (or jug) poured into the bowl: `litres` over `seconds`, starting at `start`. */
export interface Pour {
	start: number;
	litres: number;
	seconds: number;
}

export interface Settings {
	bowl: BowlKind;
	/** When the lever is pressed (s from the start), or null. */
	lever: number | null;
	/** Water poured straight into the bowl. */
	pours: Pour[];
	/** The float held down, so the valve can't close. */
	floatHeld: boolean;
	/** Water in the tank at the start, L above the flapper's closing level (full: 6). */
	tankStart: number;
	/** Water in the bowl at the start, L above the top of the bend's inlet (at rest: full). */
	bowlStart?: number;
}

export const DEFAULTS: Settings = {
	bowl: 'siphonic',
	lever: null,
	pours: [],
	floatHeld: false,
	tankStart: FLUSH_LITRES
};

export interface State {
	t: number;
	/** Water in the tank, L above the level at which the flapper falls shut. */
	tank: number;
	flapperOpen: boolean;
	/** Water in the bowl, L above the top of the bend's inlet. */
	bowl: number;
	/** Water backed up in the bend, as a share of what fills it (0–1); 1 while the siphon runs. */
	bend: number;
	primed: boolean;
	/** Flow out of the tank, over the crest (unprimed), through the full bend (primed), L/s. */
	tankFlow: number;
	spill: number;
	siphonFlow: number;
	/** Flow poured in from a bucket, L/s. */
	pourFlow: number;
	/** The fill valve's flow (L/s) and its opening (0–1). */
	fillFlow: number;
	valve: number;
	/** Flow from the tank into the overflow pipe, L/s. */
	overflow: number;
	/** Water gone down the drain so far, L. */
	drained: number;
	/** Distance the water in the bend has run, m (for drawing its flow). */
	run: number;
	primedAt: number | null;
	brokeAt: number | null;
	/** The bowl ran over its rim. */
	overRim: boolean;
}

/** Litres a bowl holds above the inlet's top, up to the height `h` (m from the crest). */
export function bowlVolume(h: number): number {
	const d = h + SEAL;
	if (d <= 0) return 0;
	const slope = (BOWL_AREA - BOWL_AREA_LOW) / SEAL;
	if (h <= 0) return 1000 * (BOWL_AREA_LOW * d + (slope * d * d) / 2);
	return (
		1000 * ((SEAL * (BOWL_AREA_LOW + BOWL_AREA)) / 2 + BOWL_AREA * h + (BOWL_FLARE * h * h) / 2)
	);
}

/** The bowl's water level, m from the top of the bend, holding `litres` above the inlet's top. */
export function bowlLevel(litres: number): number {
	const v = litres / 1000;
	const low = (SEAL * (BOWL_AREA_LOW + BOWL_AREA)) / 2;
	if (v <= low) {
		const s = (BOWL_AREA - BOWL_AREA_LOW) / SEAL;
		const d = (-BOWL_AREA_LOW + Math.sqrt(BOWL_AREA_LOW ** 2 + 2 * s * Math.max(0, v))) / s;
		return d - SEAL;
	}
	const w = v - low;
	return (-BOWL_AREA + Math.sqrt(BOWL_AREA ** 2 + 2 * BOWL_FLARE * w)) / BOWL_FLARE;
}

/** Water the bowl holds at rest, L above the inlet's top: up to the top of the bend. */
export const BOWL_FULL = bowlVolume(0);

/** The tank's water height above the flapper's seat, m, holding `litres` above its closing level. */
export const tankLevel = (litres: number) => FLAPPER_CLOSE + litres / 1000 / TANK_AREA;

/** Spill over the top of the bend, L/s, with the bowl's water `h` above the crest. */
export function spillFlow(h: number, bore: number): number {
	return h > 0 ? 1000 * WEIR * bore * h ** 1.5 : 0;
}

/** Flow through the full bend (the siphon), L/s, with the bowl's water `h` above the crest. */
export function siphonFlow(h: number, bore: number): number {
	const head = h + OUTLET_DROP;
	if (head <= 0) return 0;
	return 1000 * ((Math.PI * bore * bore) / 4) * Math.sqrt((2 * G * head) / (1 + BEND_LOSSES));
}

/** Flow out of the tank through the open flapper, L/s. */
export function valveFlow(litres: number): number {
	const h = tankLevel(litres);
	return 1000 * VALVE_AREA * Math.sqrt(2 * G * Math.max(0, h + VALVE_DROP));
}

export class Toilet {
	s: Settings;
	shape: BowlShape;
	state: State;

	constructor(s: Settings) {
		this.s = s;
		this.shape = BOWLS[s.bowl];
		this.state = {
			t: 0,
			tank: s.tankStart,
			flapperOpen: false,
			bowl: s.bowlStart ?? BOWL_FULL,
			bend: 0,
			primed: false,
			tankFlow: 0,
			spill: 0,
			siphonFlow: 0,
			pourFlow: 0,
			fillFlow: 0,
			valve: 0,
			overflow: 0,
			drained: 0,
			run: 0,
			primedAt: null,
			brokeAt: null,
			overRim: false
		};
		this.flows();
	}

	/** Bowl level, m from the top of the bend. */
	get level(): number {
		return bowlLevel(this.state.bowl);
	}

	/** Works out the flows for the present levels. */
	private flows() {
		const st = this.state;
		const { s, shape } = this;
		const h = bowlLevel(st.bowl);
		st.tankFlow = st.flapperOpen ? valveFlow(st.tank) : 0;
		st.pourFlow = 0;
		for (const p of s.pours)
			if (st.t >= p.start && st.t < p.start + p.seconds) st.pourFlow += p.litres / p.seconds;
		// The float rises with the water; it closes the valve over its last centimetre of travel,
		// and the valve's washer seats fully once the float is up (the square root: in finite time).
		const below = WATER_LINE - tankLevel(st.tank);
		st.valve = s.floatHeld ? 1 : Math.sqrt(Math.min(1, Math.max(0, below / FLOAT_TRAVEL)));
		st.fillFlow = FILL_FLOW * st.valve;
		const top = (OVERFLOW_TOP - FLAPPER_CLOSE) * TANK_AREA * 1000;
		st.overflow = st.tank > top ? Math.min(2, (st.tank - top) * 20) : 0;
		if (st.primed) {
			st.siphonFlow = siphonFlow(h, shape.bore);
			st.spill = 0;
		} else {
			st.siphonFlow = 0;
			st.spill = spillFlow(h, shape.bore);
		}
	}

	step(dt: number) {
		const st = this.state;
		const { s, shape } = this;
		if (s.lever !== null && !st.flapperOpen && st.t >= s.lever && st.t - dt < s.lever)
			st.flapperOpen = st.tank > 0;
		this.flows();
		const toTank = st.fillFlow * (1 - REFILL_SHARE);
		const toBowl = st.fillFlow * REFILL_SHARE + st.overflow + st.tankFlow + st.pourFlow;
		st.tank = Math.max(0, st.tank + (toTank - st.tankFlow - st.overflow) * dt);
		if (st.flapperOpen && st.tank <= 0) st.flapperOpen = false;
		const out = st.primed ? st.siphonFlow : st.spill;
		st.bowl = Math.max(0, st.bowl + (toBowl - out) * dt);
		st.drained += out * dt;
		if (bowlLevel(st.bowl) > RIM) st.overRim = true;
		const area = (Math.PI * shape.bore * shape.bore) / 4;
		if (st.primed) {
			st.run += (st.siphonFlow / 1000 / area) * dt;
			// Air reaches the bend's inlet: the siphon breaks.
			if (bowlLevel(st.bowl) <= -SEAL + 1e-4) {
				st.primed = false;
				st.bend = 0;
				st.brokeAt = st.t + dt;
			}
		} else {
			st.run += Math.min(1.5, st.spill / 1000 / area) * dt;
			// The bend carries away up to `primeFlow`, as a stream that takes up more of the bend the
			// faster it runs (a quarter of it at half that flow); a faster spill backs up and fills it.
			const carried = shape.primeFlow * Math.sqrt(st.bend);
			st.bend = Math.max(0, st.bend + ((st.spill - carried) / shape.bendLitres) * dt);
			if (st.bend >= 1) {
				st.bend = 1;
				st.primed = true;
				st.primedAt = st.t + dt;
			}
		}
		st.t += dt;
	}

	/** Runs the toilet on to time `t`, s, and returns its state. */
	run(t: number): State {
		while (this.state.t + DT / 2 < t) this.step(Math.min(DT, t - this.state.t));
		this.flows();
		return this.state;
	}
}

/** What a whole flush (or pour) came to, run to `until` seconds. */
export interface Outcome {
	siphoned: boolean;
	primedAt: number | null;
	brokeAt: number | null;
	/** Lowest bowl level reached, m from the top of the bend. */
	lowest: number;
	/** Highest bowl level reached, m from the top of the bend. */
	highest: number;
	/** Fastest flow down the drain, L/s. */
	peakDrain: number;
	/** Fastest flow out of the tank, L/s. */
	peakTank: number;
	/** When the tank had emptied (the flapper fell shut), s. */
	tankEmptyAt: number | null;
	/** When the float shut the valve after the flush, s. */
	valveShutAt: number | null;
	overRim: boolean;
	end: State;
}

export function outcome(s: Settings, until = 60): Outcome {
	const toilet = new Toilet(s);
	let lowest = toilet.level;
	let highest = lowest;
	let peakDrain = 0;
	let peakTank = 0;
	let tankEmptyAt: number | null = null;
	let valveShutAt: number | null = null;
	let wasOpen = false;
	let valveWasOpen = false;
	while (toilet.state.t < until) {
		toilet.step(DT);
		const st = toilet.state;
		const h = toilet.level;
		lowest = Math.min(lowest, h);
		highest = Math.max(highest, h);
		peakDrain = Math.max(peakDrain, st.primed ? st.siphonFlow : st.spill);
		peakTank = Math.max(peakTank, st.tankFlow);
		if (wasOpen && !st.flapperOpen && tankEmptyAt === null) tankEmptyAt = st.t;
		wasOpen = st.flapperOpen;
		if (valveWasOpen && st.valve === 0 && valveShutAt === null) valveShutAt = st.t;
		if (st.valve > 0) valveWasOpen = true;
	}
	const end = toilet.run(until);
	return {
		siphoned: end.primedAt !== null,
		primedAt: end.primedAt,
		brokeAt: end.brokeAt,
		lowest,
		highest,
		peakDrain,
		peakTank,
		tankEmptyAt,
		valveShutAt,
		overRim: end.overRim,
		end
	};
}
