<script lang="ts">
	/** Root of the drone-four-rotors illustration: one scene, the drone over a field. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		drone: () => import('./scenes/DroneScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
