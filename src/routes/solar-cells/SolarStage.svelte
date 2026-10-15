<script lang="ts">
	/** Root of the solar-cells illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		spectrum: () => import('./scenes/SpectrumScene.svelte'),
		cell: () => import('./scenes/CellScene.svelte'),
		iv: () => import('./scenes/IvScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
