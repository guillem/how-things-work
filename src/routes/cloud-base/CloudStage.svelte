<script lang="ts">
	/** Root of the cloud-base illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sky: () => import('./scenes/SkyScene.svelte'),
		mountain: () => import('./scenes/MountainScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
