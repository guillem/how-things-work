/**
 * The "Run by itself" toggle and its slider, shared by the scenes. Call from a scene's setup.
 *
 * - Moving the slider turns "Run by itself" off, so the slider takes over at once.
 * - Turning "Run by itself" off by hand leaves the slider where the animation was, so the
 *   picture does not jump.
 *
 * The step's toggle is its control whose id starts with `auto-`; the slider is the range whose
 * id starts with `t-` (0 … T) or `k-` (0 … 100%).
 */
import { untrack } from 'svelte';
import type { ParamValue, Params, Step } from '#lib/explainer/index.ts';
import { T } from '../ddpm';
import { bool, num, playhead } from './shared';

interface Inputs {
	step: () => Step;
	params: () => Params;
	t: () => number;
	reduced: () => boolean;
	setParam: (id: string, value: ParamValue) => void;
	/** seconds of animation from start to end */
	run?: number;
	/** how the animation paces the process (shared.ts `paceForward` / `paceReverse`) */
	pace?: (v: number) => number;
}

export function useScrub(o: Inputs) {
	const autoId = $derived(o.step().controls?.find((c) => c.id.startsWith('auto-'))?.id ?? null);
	const slider = $derived(
		o.step().controls?.find((c) => c.id.startsWith('t-') || c.id.startsWith('k-')) ?? null
	);
	const scale = $derived(slider?.id.startsWith('t-') ? T : 100);
	// a step with neither toggle nor slider runs by itself (and shows the end under reduced
	// motion); one with only a slider follows the slider
	const auto = $derived(autoId ? bool(o.params(), autoId) : !slider);
	const value = $derived(
		slider && slider.type === 'range' ? num(o.params(), slider.id, slider.default) / scale : 1
	);
	const u = $derived(playhead(o.t(), auto, o.reduced(), value, o.run ?? 7, o.pace));

	let lastSlider: { id: string; v: number } | null = null;
	let lastAuto: { id: string; v: boolean } | null = null;
	let fromSlider = false;
	$effect(() => {
		const id = slider?.id ?? null;
		const v = value;
		untrack(() => {
			if (id && autoId && lastSlider?.id === id && lastSlider.v !== v && auto) {
				fromSlider = true;
				o.setParam(autoId, false);
			}
			lastSlider = id ? { id, v } : null;
		});
	});
	$effect(() => {
		const id = autoId;
		const v = auto;
		untrack(() => {
			if (id && lastAuto?.id === id && lastAuto.v && !v && !fromSlider && slider)
				o.setParam(slider.id, Math.round(u * scale));
			fromSlider = false;
			lastAuto = id ? { id, v } : null;
		});
	});
	return {
		/** 0 … 1: where the process stands */
		get u() {
			return u;
		},
		get auto() {
			return auto;
		}
	};
}
