<script lang="ts">
	/** Root of the surface-catalysis illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		moves: () => import('./scenes/MovesScene.svelte'),
		lattice: () => import('./scenes/LatticeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
