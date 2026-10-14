/**
 * Figures for the real vehicle the explainer flies: the Saturn V of Apollo 11 (AS-506), and the
 * physical constants of the bodies it visits. Every number here comes from a named source.
 *
 * Saturn V AS-506: "Saturn V Launch Vehicle Flight Evaluation Report — AS-506 Apollo 11
 * Mission", MPR-SAT-FE-69-9, NASA Marshall Space Flight Center, 20 September 1969
 * (https://ibiblio.org/apollo/Documents/lvfea-AS506-Apollo11.pdf). Masses are the "actual"
 * column of Table 20-9 (Flight Sequence Mass Summary); burn times, flow rates and specific
 * impulses from sections 5–7; insertion conditions from Table 4-5.
 *
 * The rise of the first stage's thrust with altitude (from about 7,648,000 lbf at sea level to
 * about 9,160,000 lbf near 45 km) is from the Saturn V Flight Manual SA-504, MSFC-MAN-504,
 * NASA MSFC, 1969, section 2 "Engine performance"
 * (https://www.ibiblio.org/apollo/Documents/Saturn_V_Flight_Manual_SA_504.pdf).
 *
 * Planetary constants: NASA Space Science Data Coordinated Archive planetary fact sheets
 * (https://nssdc.gsfc.nasa.gov/planetary/factsheet/), earthfact, marsfact, jupiterfact and
 * sunfact. Both documents are works of the US Government, in the public domain.
 */

/** Standard gravity (m/s², exact). */
export const G0 = 9.80665;

/** GM in m³/s² and equatorial radius in m (NSSDCA fact sheets). */
export const EARTH = { gm: 0.3986e15, radius: 6378.137e3, siderealDay: 23.9345 * 3600 };
export const MARS = { gm: 0.042828e15, radius: 3396.2e3 };
export const JUPITER = { gm: 126.687e15, radius: 71492e3, speed: 13.06e3, a: 778.479e9 };
export const SUN = { gm: 132712e15 };
/** 1 AU in m (the IAU 2012 definition) and the day in s. */
export const AU = 149597870700;
export const DAY = 86400;

/** One stage's burn, as masses of the whole stack (kg) and the engines' performance. */
export interface StageFigures {
	name: string;
	/** Mass of the whole vehicle when this stage lights (kg). */
	m0: number;
	/** Mass of the whole vehicle when it shuts down (kg). */
	mf: number;
	/** Propellant flow (kg/s). */
	mdot: number;
	/** Exhaust speed in a vacuum and at sea level (m/s). */
	veVac: number;
	veSea: number;
}

/** Launch site of Apollo 11: Launch Complex 39A, latitude 28.6° N. */
export const KSC_LATITUDE = 28.608;

/**
 * Saturn V AS-506 to its parking orbit (S-IVB first burn only).
 *
 * - S-IC: 2,899,008 kg at holddown release to 827,292 kg at outboard engine cutoff
 *   (161.63 s; release at 0.30 s). F-1 specific impulse at sea level 2,598 N·s/kg
 *   (Table 5-1). The vacuum figure follows the flight manual's thrust rise, 9.160/7.648 times
 *   the sea-level thrust, at the same flow.
 * - S-II: 658,547 kg at separation; the aft interstage (3,982 kg) and the launch escape
 *   tower (4,051 kg), dropped about half a minute after ignition, are taken off at ignition; 213,757 kg at
 *   S-II/S-IVB separation. Flow 1,239 kg/s, specific impulse 4,150.2 N·s/kg (section 6).
 * - S-IVB first burn: 166,571 kg at ignition, 135,182 kg at cutoff, 147.1 s, specific impulse
 *   4,202 N·s/kg (Table 7-1).
 */
export const SATURN_V: { stages: StageFigures[]; diameter: number } = {
	stages: [
		{
			name: 'S-IC',
			m0: 2899008,
			mf: 827292,
			mdot: (2899008 - 827292) / (161.63 - 0.3),
			veSea: 2598,
			veVac: 2598 * (9160 / 7648)
		},
		{
			name: 'S-II',
			m0: 658547 - 3982 - 4051,
			mf: 213757,
			mdot: 1239,
			veSea: 4150.2,
			veVac: 4150.2
		},
		{
			name: 'S-IVB',
			m0: 166571,
			mf: 135182,
			mdot: (166571 - 135182) / 147.1,
			veSea: 4202,
			veVac: 4202
		}
	],
	/** Diameter of the S-IC and S-II, 33 ft (10.1 m), MSFC-MAN-504 section 1. */
	diameter: 10.06
};

/** Apollo 11's parking-orbit insertion (Table 4-5): 709.3 s, 191.1 km, 7,793.1 m/s space-fixed. */
export const AS506_INSERTION = { time: 709.3, altitude: 191.1e3, speed: 7793.1 };

/**
 * Keplerian elements of the Earth–Moon barycentre and Mars, valid 1800–2050, from E. M.
 * Standish, "Keplerian Elements for Approximate Positions of the Major Planets", JPL Solar
 * System Dynamics, Table 1 (https://ssd.jpl.nasa.gov/planets/approx_pos.html). Each pair is
 * the value at J2000 and its rate per Julian century: a (AU), e, L (mean longitude, °),
 * ϖ (longitude of perihelion, °). Inclinations are left out: the explainer works in the plane
 * of the Earth's orbit.
 */
export const ELEMENTS = {
	earth: {
		a: [1.00000261, 0.00000562],
		e: [0.01671123, -0.00004392],
		L: [100.46457166, 35999.37244981],
		peri: [102.93768193, 0.32327364]
	},
	mars: {
		a: [1.52371034, 0.00001847],
		e: [0.0933941, 0.00007882],
		L: [-4.55343205, 19140.30268499],
		peri: [-23.94362959, 0.44441088]
	}
} as const;
