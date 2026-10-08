<script lang="ts">
	/** Root of the oscillations illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		spring: () => import('./scenes/SpringScene.svelte'),
		pendulum: () => import('./scenes/PendulumScene.svelte'),
		driven: () => import('./scenes/DrivenScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
