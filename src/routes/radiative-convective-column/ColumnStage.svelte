<script lang="ts">
	/** Root of the radiative-convective column illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		streams: () => import('./scenes/StreamsScene.svelte'),
		column: () => import('./scenes/ColumnScene.svelte'),
		run: () => import('./scenes/RunScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
