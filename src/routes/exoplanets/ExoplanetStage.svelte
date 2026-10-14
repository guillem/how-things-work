<script lang="ts">
	/** Root of the exoplanets illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		glare: () => import('./scenes/GlareScene.svelte'),
		transit: () => import('./scenes/TransitScene.svelte'),
		wobble: () => import('./scenes/WobbleScene.svelte'),
		read: () => import('./scenes/ReadScene.svelte'),
		zone: () => import('./scenes/ZoneScene.svelte'),
		census: () => import('./scenes/CensusScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
