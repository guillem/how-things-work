<script lang="ts">
	/** Root of the attention illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tokens: () => import('./scenes/TokenScene.svelte'),
		positions: () => import('./scenes/PositionScene.svelte'),
		attention: () => import('./scenes/AttentionScene.svelte'),
		heads: () => import('./scenes/HeadsScene.svelte'),
		explore: () => import('./scenes/ExploreScene.svelte'),
		stack: () => import('./scenes/StackScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
