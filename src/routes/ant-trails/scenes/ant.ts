/** Shared drawing bits for the ant-trails scenes. */

/** Simulated seconds per second on the stage. */
export const SIM_SPEED = 1.5;

const circle = (x: number, r: number) =>
	`M${x - r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/** An ant seen from above, facing +x, about 20 units long: head, thorax, abdomen, legs, feelers. */
export const ANT =
	`${circle(6.5, 2.6)}${circle(1, 2.1)}M-10 0a4.6 3.4 0 1 0 9.2 0a4.6 3.4 0 1 0 -9.2 0` +
	'M1 0L-3 -6M1 0L5 -6M1 0L-6 -3M1 0L-3 6M1 0L5 6M1 0L-6 3M8 -1L11.5 -5M8 1L11.5 5';

/** The grain of sugar an ant carries in its jaws. */
export const GRAIN = { x: 9, y: -3.5, width: 7, height: 7, rx: 1.5 };
