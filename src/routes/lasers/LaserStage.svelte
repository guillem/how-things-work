<script lang="ts">
	/** Root of the lasers illustration. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		medium: () => import('./scenes/MediumScene.svelte'),
		cavity: () => import('./scenes/CavityScene.svelte'),
		dynamics: () => import('./scenes/DynamicsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
