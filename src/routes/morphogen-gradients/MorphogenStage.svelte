<script lang="ts">
	/** Root of the morphogen-gradient illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		row: () => import('./scenes/RowScene.svelte'),
		embryo: () => import('./scenes/EmbryoScene.svelte'),
		scale: () => import('./scenes/ScaleScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
