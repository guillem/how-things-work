<script lang="ts">
	/** Root of the DNA-to-protein illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		dna: () => import('./scenes/DnaScene.svelte'),
		transcribe: () => import('./scenes/TranscribeScene.svelte'),
		splice: () => import('./scenes/SpliceScene.svelte'),
		table: () => import('./scenes/TableScene.svelte'),
		translate: () => import('./scenes/TranslateScene.svelte'),
		mutate: () => import('./scenes/MutateScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
