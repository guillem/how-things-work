<script lang="ts">
	/** Root of the deep-time illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		time: () => import('./scenes/TimeScene.svelte'),
		calendar: () => import('./scenes/CalendarScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
