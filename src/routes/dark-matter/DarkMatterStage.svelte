<script lang="ts">
	/** Root of the dark-matter illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		galaxy: () => import('./scenes/GalaxyScene.svelte'),
		doppler: () => import('./scenes/DopplerScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		lens: () => import('./scenes/LensScene.svelte'),
		budget: () => import('./scenes/BudgetScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
