<script lang="ts">
	/** Root of the dislocations illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		crystal: () => import('./scenes/CrystalScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
