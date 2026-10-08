<script lang="ts">
	/** Root of the reinforcement-learning illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		grid: () => import('./scenes/GridWorldScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
