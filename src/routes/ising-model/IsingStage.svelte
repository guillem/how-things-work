<script lang="ts">
	/** Root of the Ising-model illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		small: () => import('./scenes/SmallScene.svelte'),
		lattice: () => import('./scenes/LatticeScene.svelte'),
		hysteresis: () => import('./scenes/HysteresisScene.svelte'),
		chain: () => import('./scenes/ChainScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
