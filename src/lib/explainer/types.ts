/**
 * Shared contract between an explainer's narrative (the list of steps) and
 * its animated stage. Every explainer in the site is described by an
 * `ExplainerSpec` and rendered by `<Explainer>`.
 */

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

interface ControlBase {
	/** Unique id; the current value is available as `params[id]` in the stage. */
	id: string;
	label: string;
	/** Optional one-line explanation shown under the control. */
	help?: string;
}

export interface RangeControl extends ControlBase {
	type: 'range';
	min: number;
	max: number;
	step?: number;
	default: number;
	unit?: string;
	/** Custom value formatter for the read-out next to the slider. */
	format?: (value: number) => string;
}

export interface ToggleControl extends ControlBase {
	type: 'toggle';
	default: boolean;
}

export interface SelectControl extends ControlBase {
	type: 'select';
	default: string;
	options: { value: string; label: string }[];
}

/**
 * A button that triggers something in the stage, such as "Run again". Its
 * value is the number of times it has been pressed (0 at first), so the stage
 * reacts to a change of `params[id]`.
 */
export interface ActionControl extends ControlBase {
	type: 'action';
	/** Text on the button. */
	action: string;
	default?: never;
}

export type Control = RangeControl | ToggleControl | SelectControl | ActionControl;

export interface Chapter {
	id: string;
	title: string;
}

export interface Step {
	/** Stable id, used in the URL hash so that steps are linkable. */
	id: string;
	/** Id of the chapter this step belongs to. */
	chapter: string;
	title: string;
	/**
	 * Narrative for this step as an HTML string. Keep it to a few short
	 * paragraphs. Use `<dfn data-def="…">term</dfn>` for hover definitions
	 * and `<span class="formula">` for chemical formulas.
	 */
	body: string;
	/** Optional "Go deeper" HTML shown in a collapsible block. */
	notes?: string;
	/** Which scene of the stage to show. The stage decides what that means. */
	scene: string;
	/**
	 * Free-form hints for the stage, e.g. `{ highlight: 'psii' }`. Available
	 * to the stage as `step.hints`.
	 */
	hints?: Record<string, ParamValue>;
	/** Seconds the step stays on screen when auto-advance is on. */
	duration?: number;
	/** Interactive controls offered to the reader while on this step. */
	controls?: Control[];
}

export interface ExplainerSpec {
	slug: string;
	title: string;
	summary: string;
	chapters: Chapter[];
	steps: Step[];
}

/**
 * What the stage receives on every animation frame.
 *
 * `t` changes ~60 times a second, so anything that should only react to a
 * step change (for example a camera tween started in an `$effect`) must
 * depend on a `$derived` of `step`, never on the props object as a whole.
 */
export interface StageProps {
	step: Step;
	/** Zero-based index of the current step. */
	index: number;
	/** Seconds elapsed in the current step (scaled by playback speed). */
	t: number;
	playing: boolean;
	/** The visitor prefers reduced motion: render a calm, static frame. */
	reduced: boolean;
	dark: boolean;
	/** Current values of all controls, keyed by control id. */
	params: Params;
	/**
	 * Changes a control's value from the scene (e.g. a dragged handle), so the
	 * matching slider follows. Scenes must use this rather than assigning to
	 * `params`, which belongs to the explainer.
	 */
	setParam: (id: string, value: ParamValue) => void;
}

/** Scene name (`step.scene`) → lazy import of the scene component, in narrative order. */
export type SceneLoaders = Record<
	string,
	() => Promise<{ default: import('svelte').Component<StageProps> }>
>;
