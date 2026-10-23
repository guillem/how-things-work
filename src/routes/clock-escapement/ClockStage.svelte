<script lang="ts">
	/** Root of the clock-escapement illustration: one scene, the opened clock. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		clock: () => import('./scenes/ClockScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
