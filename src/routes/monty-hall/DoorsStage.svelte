<script lang="ts">
	/** Root of the monty-hall illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		doors: () => import('./scenes/DoorsScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
