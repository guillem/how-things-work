<script lang="ts">
	/** Root of the immune-system illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tissue: () => import('./scenes/TissueScene.svelte'),
		course: () => import('./scenes/CourseScene.svelte'),
		library: () => import('./scenes/LibraryScene.svelte'),
		antibody: () => import('./scenes/AntibodyScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
