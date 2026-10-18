<script lang="ts">
	/** Root of the scaling-laws illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sweep: () => import('./scenes/SweepScene.svelte'),
		kaplan: () => import('./scenes/KaplanScene.svelte'),
		chinchilla: () => import('./scenes/ChinchillaScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
