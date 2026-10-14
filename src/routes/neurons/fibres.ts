/**
 * How fast nerve fibres conduct, from measurements.
 *
 * - Myelinated fibres: speed grows in proportion to the fibre's outer
 *   diameter, about 6 m/s per µm (J. B. Hursh, "Conduction velocity and
 *   diameter of nerve fibers", Am. J. Physiol. 127:131–139, 1939, cat nerves
 *   at body temperature).
 * - Unmyelinated fibres: cable theory (Hodgkin & Huxley 1952, eq. 34: speed
 *   ∝ √(radius / Rᵢ C) for a fixed membrane) makes speed grow only as the
 *   square root of the diameter. It is anchored here to the one fibre whose
 *   speed and diameter were both measured on this page's model: HH's squid
 *   axon, 476 µm across, 21.2 m/s at 18.5 °C. Scaled down to 1 µm this gives
 *   about 1 m/s, in the 0.5–2 m/s measured for the thin unmyelinated C fibres
 *   of human nerves (the Erlanger–Gasser classification, e.g. Kandel et al.,
 *   Principles of Neural Science).
 * - Internodes (the myelinated stretches between two nodes of Ranvier) are
 *   roughly 100 fibre diameters long (Rushton, J. Physiol. 115:101, 1951,
 *   who also showed why speed then grows in proportion to diameter); a node
 *   is about 1 µm long.
 *
 * Simplifications, stated on the page: the √d rule for unmyelinated fibres
 * mixes a squid membrane at 18.5 °C with mammalian fibres at 37 °C; Hursh's
 * proportionality holds for fibres above a few µm (below about 1 µm myelin
 * no longer pays, which is why the thinnest fibres have none).
 */
import { SQUID_AXON } from './hh';

/** Hursh (1939): m/s per µm of fibre diameter. */
export const HURSH = 6;

/** Squid giant axon diameter, µm (2 × HH's 238 µm radius). */
export const SQUID_DIAMETER = SQUID_AXON.radius * 2e4;

/** Speed of a myelinated fibre of outer diameter d (µm), m/s. */
export function myelinatedSpeed(d: number): number {
	return HURSH * d;
}

/** Speed of an unmyelinated fibre of diameter d (µm), m/s, by √d scaling from the squid axon. */
export function unmyelinatedSpeed(d: number): number {
	return SQUID_AXON.measured * Math.sqrt(d / SQUID_DIAMETER);
}

/** Diameter (µm) an unmyelinated fibre would need to match speed v (m/s). */
export function unmyelinatedDiameterFor(v: number): number {
	return SQUID_DIAMETER * (v / SQUID_AXON.measured) ** 2;
}

/** Length of one internode, µm, for a fibre of diameter d (µm). */
export function internode(d: number): number {
	return 100 * d;
}
