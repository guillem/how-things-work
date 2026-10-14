<script lang="ts">
	/** Root of the Standard Model illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		zoom: () => import('./scenes/ZoomScene.svelte'),
		table: () => import('./scenes/TableScene.svelte'),
		builder: () => import('./scenes/BuilderScene.svelte'),
		gluon: () => import('./scenes/GluonScene.svelte'),
		process: () => import('./scenes/ProcessScene.svelte'),
		clocks: () => import('./scenes/ClocksScene.svelte'),
		decay: () => import('./scenes/DecayScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
