<script lang="ts">
	/** Root of the aperture-synthesis page: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		synth: () => import('./scenes/SynthScene.svelte'),
		pair: () => import('./scenes/PairScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
