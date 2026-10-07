<script lang="ts">
	/** Root of the unit-circle illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		circle: () => import('./scenes/CircleScene.svelte'),
		radians: () => import('./scenes/RadiansScene.svelte'),
		wave: () => import('./scenes/WaveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
