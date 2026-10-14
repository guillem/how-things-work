<script lang="ts">
	/** Root of the Turing machines illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tape: () => import('./scenes/TapeScene.svelte'),
		universal: () => import('./scenes/UniversalScene.svelte'),
		halting: () => import('./scenes/HaltingScene.svelte'),
		beaver: () => import('./scenes/BeaverScene.svelte'),
		tsp: () => import('./scenes/TspScene.svelte'),
		growth: () => import('./scenes/GrowthScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
