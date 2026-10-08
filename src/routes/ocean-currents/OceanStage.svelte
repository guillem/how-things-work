<script lang="ts">
	/** Root of the ocean-currents illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		gyre: () => import('./scenes/GyreScene.svelte'),
		overturn: () => import('./scenes/OverturnScene.svelte'),
		pacific: () => import('./scenes/PacificScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
