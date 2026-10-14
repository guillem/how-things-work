<script lang="ts">
	/** Root of the transistors-and-chipmaking illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		mosfet: () => import('./scenes/MosfetScene.svelte'),
		inverter: () => import('./scenes/InverterScene.svelte'),
		wafer: () => import('./scenes/WaferScene.svelte'),
		process: () => import('./scenes/ProcessScene.svelte'),
		litho: () => import('./scenes/LithoScene.svelte'),
		moore: () => import('./scenes/MooreScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
