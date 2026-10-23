<script lang="ts">
	/** Root of the hydraulics illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		digger: () => import('./scenes/DiggerScene.svelte'),
		press: () => import('./scenes/PressScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
