<script lang="ts">
	/** Root of the why-you-get-sleepy illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		days: () => import('./scenes/DaysScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
