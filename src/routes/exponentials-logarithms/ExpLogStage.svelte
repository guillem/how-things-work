<script lang="ts">
	/** Root of the exponentials-and-logarithms illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		growth: () => import('./scenes/GrowthScene.svelte'),
		count: () => import('./scenes/CountScene.svelte'),
		rule: () => import('./scenes/RuleScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
