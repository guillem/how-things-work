<script lang="ts">
	/**
	 * Root of an explainer's illustration. Picks a scene component from
	 * `step.scene`, loads it on demand and cross-fades between scenes. Provides
	 * the shared `<defs>` (`#arrowhead`, `#glow`, `#soft-shadow`).
	 *
	 * Every scene receives the full `StageProps` and renders an SVG `<g>` in a
	 * 960 × 600 coordinate system.
	 */
	import type { Component } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { SceneLoaders, StageProps } from './types';

	interface Props extends StageProps {
		/** Scene name (`step.scene`) → lazy import of its component, in narrative order. */
		scenes: SceneLoaders;
	}
	let props: Props = $props();

	// Scenes get explicit, individually-derived props rather than `{...props}`:
	// a spread is invalidated as a whole on every frame (because `t` changes),
	// which would re-run any `$effect` in a scene 60 times a second.
	const step = $derived(props.step);
	const index = $derived(props.index);
	const t = $derived(props.t);
	const playing = $derived(props.playing);
	const reduced = $derived(props.reduced);
	const dark = $derived(props.dark);
	const params = $derived(props.params);

	type SceneComponent = Component<StageProps>;
	const loaders = $derived(props.scenes);
	const order = $derived(Object.keys(loaders));

	const scene = $derived(props.step.scene);
	let loaded = $state<{ name: string; component: SceneComponent } | null>(null);

	$effect(() => {
		const name = scene;
		const load = loaders[name];
		if (!load) return;
		load().then((m) => {
			// Ignore stale loads if the step changed meanwhile.
			if (scene === name) loaded = { name, component: m.default };
			// Warm up the next scene so the transition is instant.
			const next = loaders[order[order.indexOf(name) + 1]];
			next?.();
		});
	});
</script>

<svg viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg" class="stage-svg">
	<defs>
		<marker
			id="arrowhead"
			viewBox="0 0 10 10"
			refX="8"
			refY="5"
			markerWidth="7"
			markerHeight="7"
			orient="auto-start-reverse"
		>
			<path d="M1 1 L9 5 L1 9 Z" fill="context-stroke" />
		</marker>
		<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="3" result="blur" />
			<feMerge>
				<feMergeNode in="blur" />
				<feMergeNode in="SourceGraphic" />
			</feMerge>
		</filter>
		<filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
			<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.18" />
		</filter>
	</defs>
	{#if loaded}
		{#key loaded.name}
			<g
				in:fade={{ duration: props.reduced ? 0 : 400, delay: props.reduced ? 0 : 120 }}
				out:fade={{ duration: props.reduced ? 0 : 160 }}
			>
				<loaded.component {step} {index} {t} {playing} {reduced} {dark} {params} />
			</g>
		{/key}
	{/if}
</svg>
