<script lang="ts">
	/** Root of the semiconductors illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		crystal: () => import('./scenes/CrystalScene.svelte'),
		dope: () => import('./scenes/DopeScene.svelte'),
		chart: () => import('./scenes/ChartScene.svelte'),
		junction: () => import('./scenes/JunctionScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
