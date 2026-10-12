<script lang="ts">
	/** Root of the states-of-matter illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		box: () => import('./scenes/BoxScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
