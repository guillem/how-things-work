<script lang="ts">
	/** Root of the hearing-and-the-ear illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ear: () => import('./scenes/EarScene.svelte'),
		ribbon: () => import('./scenes/RibbonScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
