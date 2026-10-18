<script lang="ts">
	/** Root of the brachistochrone illustration: the ramp race and the hanging chain. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ramp: () => import('./scenes/RampScene.svelte'),
		chain: () => import('./scenes/ChainScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
