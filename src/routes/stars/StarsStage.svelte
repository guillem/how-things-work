<script lang="ts">
	/** Root of the stars illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		star: () => import('./scenes/StarScene.svelte'),
		hr: () => import('./scenes/HrScene.svelte'),
		life: () => import('./scenes/LifeScene.svelte'),
		collapse: () => import('./scenes/CollapseScene.svelte'),
		table: () => import('./scenes/TableScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
