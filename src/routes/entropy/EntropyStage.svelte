<script lang="ts">
	/** Root of the entropy illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		box: () => import('./scenes/BoxScene.svelte'),
		count: () => import('./scenes/CountScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
