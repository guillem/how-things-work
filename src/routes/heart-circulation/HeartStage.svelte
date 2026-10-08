<script lang="ts">
	/** Root of the heart illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		heart: () => import('./scenes/HeartScene.svelte'),
		loop: () => import('./scenes/LoopScene.svelte'),
		monitor: () => import('./scenes/MonitorScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
