<script lang="ts">
	/** Root of the PCR illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		tube: () => import('./scenes/TubeScene.svelte'),
		cycle: () => import('./scenes/CycleScene.svelte'),
		strands: () => import('./scenes/StrandsScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		primers: () => import('./scenes/PrimerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
