/**
 * Inputs to a receiving neuron: excitatory and inhibitory synapses on a cell
 * whose membrane is Hodgkin and Huxley's (hh.ts). The synapse sizes and time
 * courses are ILLUSTRATIVE, picked so that one excitatory input raises the
 * voltage by about 2 mV and three arriving together make the cell fire; the
 * page says so. Reversal potentials: 0 mV for the glutamate-type channel
 * (which lets Na⁺ and K⁺ through about equally) and −75 mV for the GABA-type
 * chloride channel, a typical value in mature brain neurons.
 */
import { E_EXC, E_INH, simulate, spikeTimes, type Sample, type SynEvent } from './hh';

/** Peak conductance (mS/cm²) and time constant (ms) of one synapse. ILLUSTRATIVE. */
const EXC = { g: 0.025, tau: 1 } as const;
const INH = { g: 0.08, tau: 4 } as const;

/** When the first input arrives, ms. */
export const FIRST = 2;
/** Length of a run, ms. */
export const WINDOW = 30;

interface InputSet {
	/** Number of excitatory synapses that are active. */
	exc: number;
	/** Number of inhibitory synapses that are active. */
	inh: number;
	/** Time from the first to the last excitatory input, ms (0: all together). */
	spread: number;
}

/** Arrival times of the excitatory inputs, spread evenly over `spread` ms; inhibitory ones all at FIRST. */
export function events(set: InputSet): SynEvent[] {
	const out: SynEvent[] = [];
	for (let i = 0; i < set.exc; i++) {
		const at = FIRST + (set.exc > 1 ? (i * set.spread) / (set.exc - 1) : 0);
		out.push({ at, g: EXC.g, tau: EXC.tau, E: E_EXC });
	}
	for (let i = 0; i < set.inh; i++) out.push({ at: FIRST, g: INH.g, tau: INH.tau, E: E_INH });
	return out;
}

export function receive(set: InputSet): Sample[] {
	return simulate({ tEnd: WINDOW, synapses: events(set), every: 0.05 });
}

export function fires(s: readonly Sample[]): boolean {
	return spikeTimes(s).length > 0;
}

// --------------------------------------------------------- a tiny circuit

/**
 * Three input neurons (1, 2, 3) wired to two receiving cells (A, B). Each
 * entry is the number of synapses one input makes on one cell: positive
 * excitatory, negative inhibitory. Input 3's connection to A is the one the
 * reader can strengthen.
 */
export const WIRING = {
	A: [2, 2, 0],
	B: [-2, 2, 2]
} as const;

/** When each input neuron's spike reaches the receiving cells, ms. */
export const INPUT_TIMES = [FIRST, FIRST + 0.5, FIRST + 1];

function circuitEvents(
	cell: 'A' | 'B',
	active: readonly boolean[],
	strength3A: number
): SynEvent[] {
	const w: number[] = [...WIRING[cell]];
	if (cell === 'A') w[2] = strength3A;
	const out: SynEvent[] = [];
	w.forEach((n, i) => {
		if (!active[i]) return;
		const s = n >= 0 ? EXC : INH;
		const E = n >= 0 ? E_EXC : E_INH;
		for (let k = 0; k < Math.abs(n); k++) out.push({ at: INPUT_TIMES[i], g: s.g, tau: s.tau, E });
	});
	return out;
}

export function circuit(cell: 'A' | 'B', active: readonly boolean[], strength3A: number) {
	return simulate({ tEnd: WINDOW, synapses: circuitEvents(cell, active, strength3A), every: 0.05 });
}
