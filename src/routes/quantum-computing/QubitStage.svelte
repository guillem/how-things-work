<script lang="ts">
	/** Root of the quantum-computing illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		bloch: () => import('./scenes/BlochScene.svelte'),
		paths: () => import('./scenes/PathsScene.svelte'),
		pair: () => import('./scenes/PairScene.svelte'),
		grover: () => import('./scenes/GroverScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
