<script lang="ts">
	/** Root of the toilet-flush illustration: one scene, the toilet cut in half. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		toilet: () => import('./scenes/ToiletScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
