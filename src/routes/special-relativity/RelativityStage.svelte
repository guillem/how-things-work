<script lang="ts">
	/** Root of the special-relativity illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		clock: () => import('./scenes/ClockScene.svelte'),
		gamma: () => import('./scenes/GammaScene.svelte'),
		length: () => import('./scenes/LengthScene.svelte'),
		lightning: () => import('./scenes/LightningScene.svelte'),
		spacetime: () => import('./scenes/SpacetimeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
