<script lang="ts">
	/** Root of the nuclear fission illustration: the scenes, in narrative order. See `SceneStage` for how they are shown. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		nucleus: () => import('./scenes/NucleusScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		chain: () => import('./scenes/ChainScene.svelte'),
		core: () => import('./scenes/CoreScene.svelte'),
		kinetics: () => import('./scenes/KineticsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
