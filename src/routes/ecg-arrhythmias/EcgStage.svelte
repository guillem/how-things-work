<script lang="ts">
	/** Root of the ECG illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sheet: () => import('./scenes/SheetScene.svelte'),
		records: () => import('./scenes/RecordsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
