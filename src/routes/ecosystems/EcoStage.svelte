<script lang="ts">
	/** Root of the ecosystems illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		field: () => import('./scenes/FieldScene.svelte'),
		web: () => import('./scenes/WebScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
