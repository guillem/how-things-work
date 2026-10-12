<script lang="ts">
	/** Root of the optics illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		bench: () => import('./scenes/BenchScene.svelte'),
		wavefront: () => import('./scenes/WavefrontScene.svelte'),
		interface: () => import('./scenes/InterfaceScene.svelte'),
		fibre: () => import('./scenes/FibreScene.svelte'),
		lens: () => import('./scenes/LensScene.svelte'),
		prism: () => import('./scenes/PrismScene.svelte'),
		rainbow: () => import('./scenes/RainbowScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
