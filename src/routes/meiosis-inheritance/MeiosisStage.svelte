<script lang="ts">
	/** Root of the meiosis illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cell: () => import('./scenes/CellScene.svelte'),
		meiosis: () => import('./scenes/MeiosisScene.svelte'),
		cross: () => import('./scenes/CrossScene.svelte'),
		linkage: () => import('./scenes/LinkageScene.svelte'),
		pedigree: () => import('./scenes/PedigreeScene.svelte'),
		siblings: () => import('./scenes/SiblingsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
