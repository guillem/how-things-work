<script lang="ts">
	/** Root of the spam-filter illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		filter: () => import('./scenes/FilterScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
