<script lang="ts">
	/** Root of the phase-portraits illustration. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		linear: () => import('./scenes/LinearScene.svelte'),
		nonlinear: () => import('./scenes/NonlinearScene.svelte'),
		twin: () => import('./scenes/TwinScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
