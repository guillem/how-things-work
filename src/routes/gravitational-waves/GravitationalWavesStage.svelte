<script lang="ts">
	/** Root of the gravitational-waves illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		binary: () => import('./scenes/BinaryScene.svelte'),
		ring: () => import('./scenes/RingScene.svelte'),
		chirp: () => import('./scenes/ChirpScene.svelte'),
		ifo: () => import('./scenes/InterferometerScene.svelte'),
		scale: () => import('./scenes/ScaleScene.svelte'),
		data: () => import('./scenes/DataScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
