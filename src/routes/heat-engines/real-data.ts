/**
 * Measured efficiencies of real engines and power stations, for the "Real
 * engines" step. Each value is quoted from its source; nothing is estimated.
 *
 * - US EIA, Electric Power Annual, Table 8.2, "Average Tested Heat Rates by
 *   Prime Mover and Energy Source", 2024 (https://www.eia.gov/electricity/annual/html/epa_08_02.html),
 *   Btu of fuel (higher heating value) per kWh of electricity; public domain (US government).
 * - Toyota Motor Corporation, new TNGA engines, 6 December 2016
 *   (https://global.toyota/en/powertrain/engine/): 40% maximum thermal efficiency, conventional cars.
 * - US DOE / EPA, fueleconomy.gov, "Where the energy goes: gasoline vehicles"
 *   (https://www.fueleconomy.gov/feg/atv.shtml): 12–30% of the fuel's energy reaches the wheels.
 * - GE Power, "GE sets Guinness World Records title for most efficient power plant", 2016
 *   (EDF Bouchain, France, 9HA.01 combined cycle): 62.22% net efficiency (lower heating value).
 */

/** Btu per kWh: 1 kWh = 3,412.14 Btu. */
export const BTU_PER_KWH = 3412.14;

/** EIA 2024 average tested heat rates, Btu/kWh. */
export const EIA_HEAT_RATE = {
	coalSteam: 10018,
	nuclear: 10443,
	gasTurbine: 10999,
	combinedCycle: 7548
} as const;

export const fromHeatRate = (btuPerKwh: number) => BTU_PER_KWH / btuPerKwh;

export interface RealEngine {
	id: string;
	label: string;
	/** Efficiency, or a range [low, high]. */
	value: number | readonly [number, number];
	source: string;
	group: 'car' | 'plant';
}

export const REAL: readonly RealEngine[] = [
	{
		id: 'car',
		label: 'Petrol car, fuel to wheels',
		value: [0.12, 0.3],
		source: 'US DOE',
		group: 'car'
	},
	{
		id: 'toyota',
		label: 'Best petrol engine, at its best',
		value: 0.4,
		source: 'Toyota 2016',
		group: 'car'
	},
	{
		id: 'gt',
		label: 'Gas turbines (US average)',
		value: fromHeatRate(EIA_HEAT_RATE.gasTurbine),
		source: 'EIA 2024',
		group: 'plant'
	},
	{
		id: 'nuclear',
		label: 'Nuclear plants (US average)',
		value: fromHeatRate(EIA_HEAT_RATE.nuclear),
		source: 'EIA 2024',
		group: 'plant'
	},
	{
		id: 'coal',
		label: 'Coal steam plants (US average)',
		value: fromHeatRate(EIA_HEAT_RATE.coalSteam),
		source: 'EIA 2024',
		group: 'plant'
	},
	{
		id: 'cc',
		label: 'Gas combined cycle (US average)',
		value: fromHeatRate(EIA_HEAT_RATE.combinedCycle),
		source: 'EIA 2024',
		group: 'plant'
	},
	{
		id: 'record',
		label: 'Combined-cycle record',
		value: 0.6222,
		source: 'Bouchain 2016',
		group: 'plant'
	}
];
