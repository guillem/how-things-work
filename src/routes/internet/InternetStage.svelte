<script lang="ts">
	/** Root of the internet illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		net: () => import('./scenes/NetScene.svelte'),
		web: () => import('./scenes/WebScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
