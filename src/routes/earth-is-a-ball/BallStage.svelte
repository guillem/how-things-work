<script lang="ts">
	/** Root of the earth-is-a-ball illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sea: () => import('./scenes/SeaScene.svelte'),
		globe: () => import('./scenes/GlobeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
