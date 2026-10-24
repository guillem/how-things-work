/** Linear Euler–Bernoulli steel cantilever, its lowest bending mode, and a spherical sound wave.
 * Beam: https://lampz.tugraz.at/~hadley/memm/mechanics/cbeam.php
 * Acoustics: https://openstax.org/books/university-physics-volume-1/pages/17-1-sound-waves
 * https://openstax.org/books/university-physics-volume-1/pages/17-3-sound-intensity
 * Density, stiffness and thickness are representative modelling choices, not measurements of a particular ruler.
 */
const BETA = 1.875104068711961;
export function rulerFrequency(lengthCm: number): number {
	if (!Number.isFinite(lengthCm) || lengthCm <= 0) throw new RangeError('Length must be positive');
	return (
		(BETA ** 2 / (2 * Math.PI * (lengthCm / 100) ** 2)) * 0.001 * Math.sqrt(200e9 / (12 * 7850))
	);
}
/** Exact first free-end bending shape, normalized to one at the ruler's tip. */
export function rulerMode(fraction: number): number {
	const z = BETA * Math.max(0, Math.min(1, fraction));
	const sigma = (Math.cosh(BETA) + Math.cos(BETA)) / (Math.sinh(BETA) + Math.sin(BETA));
	const raw = Math.cosh(z) - Math.cos(z) - sigma * (Math.sinh(z) - Math.sin(z));
	return raw / 2;
}
export function waveDisplacement(
	distanceM: number,
	time: number,
	frequency: number,
	amplitude: number,
	speed = 343
): number {
	const retarded = time - distanceM / speed;
	return retarded < 0
		? 0
		: amplitude * Math.exp(-retarded / 0.25) * Math.sin(2 * Math.PI * frequency * retarded);
}
/** Relative airborne energy: ear intensity in the open-air distance experiment;
 * power given to the inside air for the jar experiment (whose distance is fixed at one).
 * Ideal gas density and acoustic impedance scale with pressure at fixed temperature;
 * with prescribed source motion this is the energy given to the INSIDE air of the jar.
 * It is not the transmission through a glass wall or a prediction of outside intensity.
 */
export function receivedPower(strength: number, distanceM: number, airFraction = 1): number {
	if (!Number.isFinite(distanceM) || distanceM <= 0)
		throw new RangeError('Distance must be positive');
	return (Math.max(0, strength) ** 2 * Math.max(0, Math.min(1, airFraction))) / distanceM ** 2;
}
export function rulerPath(lengthCm: number, deflection: number): string {
	return Array.from({ length: 31 }, (_, k) => {
		const u = k / 30;
		return `${k ? 'L' : 'M'}${230 + lengthCm * 12 * u},${270 + deflection * rulerMode(u)}`;
	}).join(' ');
}

/** Display magnification is reduced at short wavelengths so the drawn air parcels never collide.
 * Physical propagation and oscillation still come from waveDisplacement, not a position clamp.
 * Magnification is chosen for the maximum permitted strength (2), so stronger twangs
 * still increase every parcel displacement in direct proportion at a fixed frequency.
 */
export function parcelDisplacements(
	time: number,
	frequency: number,
	strength: number,
	distance: number,
	speed = 343
): number[] {
	const magnification = Math.min(24, (0.04 * 760 * speed) / (distance * frequency * 2));
	return Array.from({ length: 41 }, (_, k) => {
		const d = (distance * k) / 40;
		return (waveDisplacement(d, time, frequency, strength, speed) * magnification) / Math.max(1, d);
	});
}
