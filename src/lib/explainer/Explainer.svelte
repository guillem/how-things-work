<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { theme } from '#lib/theme.svelte.ts';
	import { Clock } from './clock.svelte';
	import Controls from './Controls.svelte';
	import ParamControls from './ParamControls.svelte';
	import type { ExplainerSpec, Params, StageProps } from './types';

	interface Props {
		spec: ExplainerSpec;
		/** Accent colour for this explainer (progress, buttons, highlights). */
		accent?: string;
		/** Renders the animated illustration for the current frame. */
		stage: Snippet<[StageProps]>;
	}
	let { spec, accent = 'var(--accent)', stage }: Props = $props();

	const steps = $derived(spec.steps);
	const DEFAULT_DURATION = 14;

	// ---- state ---------------------------------------------------------------
	let index = $state(0);
	let autoAdvance = $state(false);
	let fullscreen = $state(false);
	let showHelp = $state(false);
	let root: HTMLElement;
	let bodyEl = $state<HTMLElement | null>(null);

	const clock = new Clock();

	// Control values persist across steps so that a slider keeps its value when
	// the reader comes back to it.
	const params: Params = $state(
		untrack(() => {
			const defaults: Params = {};
			for (const step of steps) {
				for (const control of step.controls ?? []) {
					defaults[control.id] = control.type === 'action' ? 0 : control.default;
				}
			}
			return defaults;
		})
	);

	const step = $derived(steps[index]);
	const chapter = $derived(spec.chapters.find((c) => c.id === step.chapter));
	const chapterSteps = $derived(steps.filter((s) => s.chapter === step.chapter));
	const reduced = $derived(prefersReducedMotion.current);
	const stageProps = $derived<StageProps>({
		step,
		index,
		t: reduced ? 2.5 : clock.t,
		playing: clock.playing && !reduced,
		reduced,
		dark: theme.current === 'dark',
		params
	});

	// ---- navigation ----------------------------------------------------------
	function go(i: number, { announce = true } = {}) {
		const next = Math.max(0, Math.min(steps.length - 1, i));
		if (next === index) return;
		index = next;
		clock.reset();
		if (announce) syncHash();
	}
	const prev = () => go(index - 1);
	const next = () => go(index + 1);
	function restart() {
		clock.reset();
		clock.playing = true;
		if (index !== 0) go(0);
	}

	function syncHash() {
		const hash = `#${steps[index].id}`;
		// A shallow navigation: the address bar changes, the page is not reloaded.
		if (location.hash !== hash) goto(hash, { shallow: true, replace: true, state: {} });
	}

	function indexFromHash(hash: string) {
		const id = hash.replace(/^#/, '');
		const i = steps.findIndex((s) => s.id === id);
		return i >= 0 ? i : null;
	}

	// Keep the step in sync with the URL hash (deep links, back/forward). Only a
	// change of the hash may move the step: `index` is read untracked, because
	// our own shallow navigations do not update `page.url`, so reacting to an
	// index change here would snap the step back to the hash the page was
	// opened with.
	$effect(() => {
		const i = indexFromHash(page.url.hash);
		untrack(() => {
			if (i !== null && i !== index) go(i, { announce: false });
		});
	});

	// ---- auto-advance --------------------------------------------------------
	$effect(() => {
		if (!autoAdvance || !clock.playing) return;
		const duration = step.duration ?? DEFAULT_DURATION;
		if (clock.t >= duration) {
			if (index < steps.length - 1) next();
			else autoAdvance = false;
		}
	});

	// ---- clock lifecycle -----------------------------------------------------
	onMount(() => {
		if (reduced) clock.playing = false;
		clock.start();
		const onVisibility = () => {
			// Keep t from jumping when the tab comes back.
			if (document.hidden) clock.stop();
			else clock.start();
		};
		document.addEventListener('visibilitychange', onVisibility);
		const onFs = () => (fullscreen = document.fullscreenElement === root);
		document.addEventListener('fullscreenchange', onFs);
		return () => {
			clock.stop();
			document.removeEventListener('visibilitychange', onVisibility);
			document.removeEventListener('fullscreenchange', onFs);
		};
	});

	// Make glossary terms in the narrative keyboard-focusable.
	$effect(() => {
		if (!bodyEl) return;
		for (const el of bodyEl.querySelectorAll<HTMLElement>('dfn[data-def]')) {
			el.tabIndex = 0;
			el.setAttribute('role', 'note');
			el.setAttribute('aria-description', el.dataset.def ?? '');
		}
	});

	// ---- keyboard ------------------------------------------------------------
	function onKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target as HTMLElement | null;
		const tag = target?.tagName;
		const typing =
			tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
		if (typing && !(tag === 'INPUT' && (target as HTMLInputElement).type === 'range')) return;
		if (showHelp && event.key === 'Escape') {
			showHelp = false;
			event.preventDefault();
			return;
		}
		switch (event.key) {
			case 'ArrowRight':
			case 'PageDown':
			case 'j':
				if (tag === 'INPUT') return; // let the slider handle arrows
				next();
				break;
			case 'ArrowLeft':
			case 'PageUp':
			case 'k':
				if (tag === 'INPUT') return;
				prev();
				break;
			case 'Home':
				go(0);
				break;
			case 'End':
				go(steps.length - 1);
				break;
			case ' ':
				if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return;
				clock.playing = !clock.playing;
				break;
			case 'r':
				restart();
				break;
			case 'a':
				autoAdvance = !autoAdvance;
				break;
			case 'f':
				toggleFullscreen();
				break;
			case '?':
				showHelp = !showHelp;
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen();
		else root.requestFullscreen?.();
	}

	const progress = $derived((index + 1) / steps.length);
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="explainer"
	class:reduced
	bind:this={root}
	style:--explainer-accent={accent}
	style:--explainer-progress={progress}
>
	<div class="stage-card">
		<div class="progress" aria-hidden="true">
			{#each spec.chapters as c (c.id)}
				{@const count = steps.filter((s) => s.chapter === c.id).length}
				{@const firstIndex = steps.findIndex((s) => s.chapter === c.id)}
				{@const done = Math.max(0, Math.min(count, index + 1 - firstIndex))}
				<span class="segment" style:flex={count} title={c.title}>
					<span class="fill" style:transform="scaleX({done / count})"></span>
				</span>
			{/each}
		</div>
		<div class="stage" role="img" aria-label="Animation: {step.title}">
			{@render stage(stageProps)}
		</div>
		<Controls
			{index}
			total={steps.length}
			playing={clock.playing}
			speed={clock.speed}
			{autoAdvance}
			{fullscreen}
			onprev={prev}
			onnext={next}
			onrestart={restart}
			ontoggle={() => (clock.playing = !clock.playing)}
			onspeed={(s) => (clock.speed = s)}
			onauto={() => (autoAdvance = !autoAdvance)}
			onfullscreen={toggleFullscreen}
			onhelp={() => (showHelp = !showHelp)}
		/>
		{#if showHelp}
			<div class="help" transition:fade={{ duration: 150 }}>
				<button
					type="button"
					class="help-backdrop"
					aria-label="Close"
					onclick={() => (showHelp = false)}
				></button>
				<div class="help-card" role="dialog" aria-label="Keyboard shortcuts">
					<h3>Keyboard shortcuts</h3>
					<dl>
						<dt><kbd>→</kbd> <kbd>J</kbd></dt>
						<dd>Next step</dd>
						<dt><kbd>←</kbd> <kbd>K</kbd></dt>
						<dd>Previous step</dd>
						<dt><kbd>Space</kbd></dt>
						<dd>Play / pause</dd>
						<dt><kbd>A</kbd></dt>
						<dd>Auto-advance steps</dd>
						<dt><kbd>R</kbd></dt>
						<dd>Restart</dd>
						<dt><kbd>F</kbd></dt>
						<dd>Full screen</dd>
						<dt><kbd>Home</kbd> <kbd>End</kbd></dt>
						<dd>First / last step</dd>
						<dt><kbd>?</kbd></dt>
						<dd>Toggle this help</dd>
					</dl>
				</div>
			</div>
		{/if}
	</div>

	<aside class="panel">
		{#key index}
			<div class="step" in:fly={{ y: 10, duration: reduced ? 0 : 260 }}>
				<p class="eyebrow">
					<span class="chapter">{chapter?.title}</span>
					<span class="pos">
						{chapterSteps.indexOf(step) + 1} of {chapterSteps.length}
					</span>
				</p>
				<h2>{step.title}</h2>
				<!-- Narrative is authored in this repository, not user input. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="body" bind:this={bodyEl}>{@html step.body}</div>
				{#if step.controls?.length}
					<ParamControls controls={step.controls} {params} />
				{/if}
				{#if step.notes}
					<details class="notes">
						<summary>Go deeper</summary>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<div class="body">{@html step.notes}</div>
					</details>
				{/if}
			</div>
		{/key}

		<div class="panel-nav">
			<button type="button" class="nav-btn" onclick={prev} disabled={index === 0}>
				<span aria-hidden="true">←</span> Previous
			</button>
			<button
				type="button"
				class="nav-btn primary"
				onclick={next}
				disabled={index === steps.length - 1}
			>
				Next <span aria-hidden="true">→</span>
			</button>
		</div>

		<nav class="contents" aria-label="Steps">
			<details>
				<summary>Contents</summary>
				<ol>
					{#each spec.chapters as c (c.id)}
						<li class="chapter-item">
							<span class="chapter-title">{c.title}</span>
							<ol>
								{#each steps as s, i (s.id)}
									{#if s.chapter === c.id}
										<li>
											<button
												type="button"
												class:current={i === index}
												class:done={i < index}
												aria-current={i === index ? 'step' : undefined}
												onclick={() => go(i)}
											>
												<span class="n">{i + 1}</span>
												{s.title}
											</button>
										</li>
									{/if}
								{/each}
							</ol>
						</li>
					{/each}
				</ol>
			</details>
		</nav>
	</aside>
</div>

<style>
	.explainer {
		--panel-width: 380px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--panel-width);
		gap: 24px;
		align-items: start;
	}

	/* ---- stage ---- */
	.stage-card {
		position: sticky;
		top: 76px;
		/* Never taller than the viewport: in short windows the stage shrinks and
		   the SVG letterboxes, so the controls stay reachable. */
		max-height: calc(100vh - 92px);
		max-height: calc(100dvh - 92px);
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}
	.stage-card > :global(.controls) {
		flex: 0 0 auto;
	}
	.progress {
		flex: 0 0 auto;
		display: flex;
		gap: 3px;
		height: 4px;
		padding: 0;
		background: var(--surface);
	}
	.segment {
		position: relative;
		display: block;
		height: 100%;
		background: var(--surface-3);
		overflow: hidden;
	}
	.segment .fill {
		position: absolute;
		inset: 0;
		background: var(--explainer-accent);
		transform-origin: left;
		transition: transform 0.4s var(--ease-out);
	}
	.stage {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		aspect-ratio: 16 / 10;
		background: var(--stage-bg);
		overflow: hidden;
		user-select: none;
	}
	.stage :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.stage :global(text) {
		font-family: var(--font-sans);
		fill: var(--stage-ink);
		font-size: 13px;
	}
	.stage :global(text.muted) {
		fill: var(--stage-ink-muted);
	}
	.stage :global(.halo) {
		paint-order: stroke;
		stroke: var(--stage-bg);
		stroke-width: 3.5px;
		stroke-linejoin: round;
	}

	/* ---- help overlay ---- */
	.help {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		z-index: 5;
	}
	.help-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: color-mix(in oklab, var(--bg) 70%, transparent);
		backdrop-filter: blur(4px);
		cursor: pointer;
	}
	.help-card {
		position: relative;
		min-width: 280px;
		padding: 20px 24px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		box-shadow: var(--shadow-lg);
	}
	.help-card h3 {
		font-size: 1rem;
		margin-bottom: 12px;
	}
	.help-card dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 8px 16px;
		margin: 0;
		font-size: 0.9rem;
	}
	.help-card dt {
		display: flex;
		gap: 4px;
	}
	.help-card dd {
		margin: 0;
		color: var(--text-muted);
	}

	/* ---- panel ---- */
	.panel {
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-width: 0;
	}
	.eyebrow {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 0.8rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--explainer-accent);
		margin-bottom: 8px;
	}
	.eyebrow .pos {
		color: var(--text-faint);
		font-variant-numeric: tabular-nums;
	}
	.panel h2 {
		font-size: 1.5rem;
		margin-bottom: 12px;
	}
	.body {
		font-size: 1.02rem;
		color: var(--text);
	}
	.body :global(p) {
		margin: 0 0 0.9em;
	}
	.body :global(p:last-child) {
		margin-bottom: 0;
	}
	.body :global(ul),
	.body :global(ol) {
		margin: 0 0 0.9em;
		padding-left: 1.3em;
	}
	.body :global(li) {
		margin-bottom: 0.3em;
	}
	.body :global(strong) {
		font-weight: 600;
	}
	.body :global(dfn[data-def]) {
		position: relative;
		font-style: normal;
		text-decoration: underline dotted;
		text-decoration-color: var(--explainer-accent);
		text-underline-offset: 0.18em;
		cursor: help;
		border-radius: 3px;
	}
	.body :global(dfn[data-def]::after) {
		content: attr(data-def);
		position: absolute;
		left: 0;
		bottom: calc(100% + 6px);
		z-index: 4;
		width: max-content;
		max-width: min(280px, 80vw);
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font-size: 0.82rem;
		font-weight: 400;
		line-height: 1.4;
		text-decoration: none;
		box-shadow: var(--shadow-lg);
		opacity: 0;
		transform: translateY(4px);
		pointer-events: none;
		transition:
			opacity 0.15s,
			transform 0.15s var(--ease-out);
	}
	.body :global(dfn[data-def]:hover::after),
	.body :global(dfn[data-def]:focus-visible::after) {
		opacity: 1;
		transform: none;
	}
	.step > :global(.controls) {
		margin-top: 18px;
	}
	.notes {
		margin-top: 18px;
		border-left: 2px solid var(--border-strong);
		padding-left: 14px;
	}
	.notes summary {
		cursor: pointer;
		font-weight: 500;
		font-size: 0.92rem;
		color: var(--text-muted);
		list-style: none;
	}
	.notes summary::before {
		content: '▸';
		display: inline-block;
		margin-right: 6px;
		transition: transform 0.15s;
	}
	.notes[open] summary::before {
		transform: rotate(90deg);
	}
	.notes .body {
		margin-top: 10px;
		font-size: 0.94rem;
		color: var(--text-muted);
	}

	.panel-nav {
		display: flex;
		gap: 10px;
		padding-top: 4px;
	}
	.nav-btn {
		flex: 1;
		padding: 10px 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.nav-btn:hover:not(:disabled) {
		border-color: var(--text-faint);
	}
	.nav-btn.primary {
		background: var(--explainer-accent);
		border-color: var(--explainer-accent);
		color: #fff;
	}
	.nav-btn.primary:hover:not(:disabled) {
		background: color-mix(in oklab, var(--explainer-accent) 85%, black);
	}
	.nav-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* ---- contents ---- */
	.contents details {
		border-top: 1px solid var(--border);
		padding-top: 14px;
	}
	.contents summary {
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.contents ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.contents > details > ol {
		margin-top: 10px;
		display: grid;
		gap: 12px;
	}
	.chapter-title {
		display: block;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.contents li button {
		display: flex;
		align-items: baseline;
		gap: 10px;
		width: 100%;
		padding: 5px 8px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		text-align: left;
		font-size: 0.92rem;
		color: var(--text-muted);
		cursor: pointer;
	}
	.contents li button:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.contents li button .n {
		flex: 0 0 1.6em;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-faint);
	}
	.contents li button.done {
		color: var(--text);
	}
	.contents li button.current {
		color: var(--text);
		font-weight: 600;
		background: color-mix(in oklab, var(--explainer-accent) 10%, transparent);
	}
	.contents li button.current .n {
		color: var(--explainer-accent);
	}

	/* ---- full screen ---- */
	.explainer:fullscreen {
		grid-template-columns: minmax(0, 1fr) min(420px, 34vw);
		gap: 0;
		background: var(--bg);
		padding: 24px;
		overflow: auto;
	}
	.explainer:fullscreen .stage-card {
		top: 0;
		align-self: center;
		max-height: calc(100vh - 48px);
	}
	.explainer:fullscreen .stage {
		aspect-ratio: auto;
		flex: 1;
		min-height: 0;
	}
	.explainer:fullscreen .panel {
		padding-left: 24px;
		max-height: calc(100vh - 48px);
		overflow: auto;
	}

	/* ---- responsive ---- */
	@media (max-width: 960px) {
		.explainer {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}
		.stage-card {
			/* Sits flush under the 60 px site header while the text scrolls beneath. */
			top: 60px;
			max-height: calc(100vh - 72px);
			max-height: calc(100dvh - 72px);
			z-index: 3;
			border-radius: var(--radius-md);
		}
	}
	/* Landscape phones and other very short viewports: a pinned stage would
	   hide the narrative, so let it scroll away with the page. */
	@media (max-height: 560px) {
		.stage-card {
			position: static;
			max-height: none;
		}
	}
	@media (max-width: 640px) {
		.stage-card {
			margin: 0 -6px;
		}
		.panel h2 {
			font-size: 1.3rem;
		}
	}
</style>
