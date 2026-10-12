<script lang="ts">
	/** Root of the radioactivity illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		nucleus: () => import('./scenes/NucleusScene.svelte'),
		grid: () => import('./scenes/GridScene.svelte'),
		dating: () => import('./scenes/DatingScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
