<script lang="ts">
	/** Root of the rockets illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		rocket: () => import('./scenes/RocketScene.svelte'),
		ascent: () => import('./scenes/AscentScene.svelte'),
		transfer: () => import('./scenes/TransferScene.svelte'),
		mars: () => import('./scenes/MarsScene.svelte'),
		flyby: () => import('./scenes/FlybyScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
