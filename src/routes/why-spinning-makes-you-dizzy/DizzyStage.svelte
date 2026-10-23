<script lang="ts">
	/** Root of the why-spinning-makes-you-dizzy illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		spin: () => import('./scenes/SpinScene.svelte'),
		ear: () => import('./scenes/EarScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
