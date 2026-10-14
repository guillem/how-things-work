<script lang="ts">
	/** Root of the redox and batteries illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		beaker: () => import('./scenes/BeakerScene.svelte'),
		daniell: () => import('./scenes/DaniellScene.svelte'),
		ladder: () => import('./scenes/LadderScene.svelte'),
		cell: () => import('./scenes/CellScene.svelte'),
		materials: () => import('./scenes/MaterialsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
