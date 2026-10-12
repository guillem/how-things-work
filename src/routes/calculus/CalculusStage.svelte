<script lang="ts">
	/** Root of the calculus illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		slope: () => import('./scenes/SlopeScene.svelte'),
		area: () => import('./scenes/AreaScene.svelte'),
		ftc: () => import('./scenes/FtcScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
