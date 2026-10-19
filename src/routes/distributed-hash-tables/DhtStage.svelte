<script lang="ts">
	/** Root of the distributed-hash-tables illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		place: () => import('./scenes/PlaceScene.svelte'),
		load: () => import('./scenes/LoadScene.svelte'),
		lookup: () => import('./scenes/LookupScene.svelte'),
		scale: () => import('./scenes/ScaleScene.svelte'),
		churn: () => import('./scenes/ChurnScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
