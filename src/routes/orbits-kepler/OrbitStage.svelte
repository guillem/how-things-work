<script lang="ts">
	/** Root of the orbits illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cannon: () => import('./scenes/CannonScene.svelte'),
		orbit: () => import('./scenes/OrbitScene.svelte'),
		period: () => import('./scenes/PeriodScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
