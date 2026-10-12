<script lang="ts">
	/** Root of the chemical-bonds illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		dots: () => import('./scenes/DotsScene.svelte'),
		pair: () => import('./scenes/PairScene.svelte'),
		molecule: () => import('./scenes/MoleculeScene.svelte'),
		repel: () => import('./scenes/RepelScene.svelte'),
		properties: () => import('./scenes/PropertiesScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
