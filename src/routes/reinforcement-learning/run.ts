/**
 * The run a step shows: its map (the step's preset, or the reader's edited copy
 * stored in `params['map:' + step.id]`) and the learner's settings (the
 * reader's control values where the step offers the control, the defaults
 * otherwise). "New run" presses change the seed.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { DEFAULTS, MAPS, parseWorld, serializeWorld, type Settings, type World } from './qlearning';
import { PACES } from './steps';

export function setup(step: Step, params: Params) {
	const offered = new Set((step.controls ?? []).map((c) => c.id));
	const num = (id: string, fallback: number) =>
		offered.has(id) && params[id] !== undefined ? Number(params[id]) : fallback;
	const preset = MAPS[String(step.hints?.map ?? 'maze')] ?? MAPS.maze;
	const mapKey = 'map:' + step.id;
	const edited = parseWorld(params[mapKey]);
	const world: World =
		edited && edited.cols === preset.cols && edited.rows === preset.rows ? edited : preset;
	const settings: Settings = {
		alpha: num('alpha', DEFAULTS.alpha),
		gamma: num('gamma', DEFAULTS.gamma),
		epsilon: num('epsilon', DEFAULTS.epsilon),
		decay: offered.has('decay') && params.decay === true,
		episodes: DEFAULTS.episodes,
		seed: DEFAULTS.seed + num('restart', 0)
	};
	const notch = offered.has('speedFast') ? num('speedFast', 5) : num('speed', 2);
	const pace = PACES[Math.round(notch) - 1] ?? PACES[1];
	const key = [
		step.id,
		serializeWorld(world),
		settings.alpha,
		settings.gamma,
		settings.epsilon,
		settings.decay,
		settings.seed
	].join('|');
	return { offered, preset, mapKey, world, settings, pace, key };
}
