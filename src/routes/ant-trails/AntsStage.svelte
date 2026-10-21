<script lang="ts">
	/** Root of the ant-trails illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		field: () => import('./scenes/FieldScene.svelte'),
		bridges: () => import('./scenes/BridgeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
