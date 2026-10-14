<script lang="ts">
	/** Root of the protein-folding illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		protein: () => import('./scenes/ProteinScene.svelte'),
		lattice: () => import('./scenes/LatticeScene.svelte'),
		landscape: () => import('./scenes/LandscapeScene.svelte'),
		count: () => import('./scenes/CountScene.svelte'),
		mc: () => import('./scenes/McScene.svelte'),
		gap: () => import('./scenes/GapScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
