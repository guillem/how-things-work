<script lang="ts">
	/** Root of the chaos-fractals illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		pendulum: () => import('./scenes/PendulumScene.svelte'),
		logistic: () => import('./scenes/LogisticScene.svelte'),
		mandelbrot: () => import('./scenes/MandelbrotScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
