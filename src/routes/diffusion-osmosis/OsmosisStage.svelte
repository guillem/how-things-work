<script lang="ts">
	/** Root of the diffusion and osmosis illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		box: () => import('./scenes/BoxScene.svelte'),
		tank: () => import('./scenes/TankScene.svelte'),
		cell: () => import('./scenes/CellScene.svelte'),
		pump: () => import('./scenes/PumpScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
