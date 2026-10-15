<script lang="ts">
	/** Root of the nuclear-fusion illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		binding: () => import('./scenes/BindingScene.svelte'),
		reaction: () => import('./scenes/ReactionScene.svelte'),
		barrier: () => import('./scenes/BarrierScene.svelte'),
		gamow: () => import('./scenes/GamowScene.svelte'),
		reactivity: () => import('./scenes/ReactivityScene.svelte'),
		plasma: () => import('./scenes/PlasmaScene.svelte'),
		lawson: () => import('./scenes/LawsonScene.svelte'),
		confine: () => import('./scenes/ConfineScene.svelte'),
		scorecard: () => import('./scenes/ScorecardScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
