<script lang="ts">
	/** Root of the elliptic-curve-cryptography illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		real: () => import('./scenes/RealScene.svelte'),
		field: () => import('./scenes/FieldScene.svelte'),
		multiply: () => import('./scenes/MultiplyScene.svelte'),
		ecdh: () => import('./scenes/EcdhScene.svelte'),
		standard: () => import('./scenes/StandardScene.svelte'),
		sizes: () => import('./scenes/SizesScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
