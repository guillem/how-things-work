<script lang="ts">
	/** Root of the leap-years illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		calendar: () => import('./scenes/CalendarScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
