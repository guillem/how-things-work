<script lang="ts">
	/** Root of the electromagnetism illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		charges: () => import('./scenes/ChargesScene.svelte'),
		magnetic: () => import('./scenes/MagneticScene.svelte'),
		induction: () => import('./scenes/InductionScene.svelte'),
		wave: () => import('./scenes/WaveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
