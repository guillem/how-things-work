<script lang="ts">
	/** Root of the secret-codes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		wheel: () => import('./scenes/WheelScene.svelte'),
		spy: () => import('./scenes/SpyScene.svelte'),
		scramble: () => import('./scenes/ScrambleScene.svelte'),
		bars: () => import('./scenes/BarsScene.svelte'),
		solve: () => import('./scenes/SolveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
