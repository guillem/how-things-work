<script lang="ts">
	/** Root of the Shazam illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		clip: () => import('./scenes/ClipScene.svelte'),
		pairs: () => import('./scenes/PairScene.svelte'),
		database: () => import('./scenes/DatabaseScene.svelte'),
		match: () => import('./scenes/MatchScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
