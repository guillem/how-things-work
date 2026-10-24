<script lang="ts">
	/** Root of the wifi-and-walls illustration: one scene, the house from above. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		house: () => import('./scenes/HouseScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
