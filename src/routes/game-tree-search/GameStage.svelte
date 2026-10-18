<script lang="ts">
	/** Root of the game-tree-search illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ttt: () => import('./scenes/NoughtsScene.svelte'),
		tree: () => import('./scenes/TreeScene.svelte'),
		count: () => import('./scenes/CountScene.svelte'),
		c4: () => import('./scenes/ConnectFourScene.svelte'),
		growth: () => import('./scenes/GrowthScene.svelte'),
		match: () => import('./scenes/MatchScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
