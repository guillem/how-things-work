<script lang="ts">
	/** Root of the power-grid illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		frequency: () => import('./scenes/FrequencyScene.svelte'),
		day: () => import('./scenes/DayScene.svelte'),
		game: () => import('./scenes/GameScene.svelte'),
		line: () => import('./scenes/LineScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
