/** Formatting of temperatures and pressures for the narrative's controls and the stage. */
import { ATM } from './phase';

/** A pressure in atmospheres, e.g. "1 atm", "0.006 atm", "218 atm". */
export function formatAtm(atm: number): string {
	if (atm >= 9.95) return `${Math.round(atm)} atm`;
	if (atm >= 0.995) return `${Number(atm.toFixed(1))} atm`;
	return `${Number(atm.toPrecision(2))} atm`;
}

/** A pressure in pascals, in the most readable SI unit, e.g. "101 kPa", "5.07 MPa". */
export function formatPa(pa: number): string {
	if (pa >= 1e6) return `${Number((pa / 1e6).toPrecision(3))} MPa`;
	if (pa >= 1e3) return `${Number((pa / 1e3).toPrecision(3))} kPa`;
	return `${Number(pa.toPrecision(3))} Pa`;
}

/** Pressure slider value (log₁₀ of the pressure in atm) to pascals. */
export const sliderToPa = (v: number) => ATM * 10 ** v;

/** The pressure slider's read-out: "1 atm (101 kPa)". */
export const formatPressureSlider = (v: number) =>
	`${formatAtm(10 ** v)} (${formatPa(sliderToPa(v))})`;

/** A temperature in °C, with a true minus sign. */
export const formatCelsius = (c: number) => `${Math.round(c).toString().replace('-', '−')} °C`;
