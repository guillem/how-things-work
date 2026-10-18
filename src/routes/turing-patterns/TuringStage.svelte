<script lang="ts">
	/** Root of the Turing-pattern illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		dish: () => import('./scenes/DishScene.svelte'),
		evidence: () => import('./scenes/EvidenceScene.svelte'),
		growth: () => import('./scenes/GrowthScene.svelte'),
		tail: () => import('./scenes/TailScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
