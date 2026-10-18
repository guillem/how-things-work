<script lang="ts">
	/** Root of the game-theory illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		matrix: () => import('./scenes/MatrixScene.svelte'),
		play: () => import('./scenes/PlayScene.svelte'),
		match: () => import('./scenes/MatchScene.svelte'),
		tournament: () => import('./scenes/TournamentScene.svelte'),
		evolve: () => import('./scenes/EvolveScene.svelte'),
		grid: () => import('./scenes/GridScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
