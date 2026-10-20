<script lang="ts">
	/** Root of the barcode-stripes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		barcode: () => import('./scenes/BarcodeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
