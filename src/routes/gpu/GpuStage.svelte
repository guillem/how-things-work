<script lang="ts">
	/** Root of the GPU illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		race: () => import('./scenes/RaceScene.svelte'),
		warp: () => import('./scenes/WarpScene.svelte'),
		roofline: () => import('./scenes/RooflineScene.svelte'),
		amdahl: () => import('./scenes/AmdahlScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
