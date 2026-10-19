<script lang="ts">
	/** Root of the hash-table and Bloom-filter illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		hash: () => import('./scenes/HashScene.svelte'),
		table: () => import('./scenes/TableScene.svelte'),
		grow: () => import('./scenes/GrowScene.svelte'),
		bloom: () => import('./scenes/BloomScene.svelte'),
		fp: () => import('./scenes/FpScene.svelte'),
		tiny: () => import('./scenes/TinyScene.svelte'),
		clash: () => import('./scenes/ClashScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
