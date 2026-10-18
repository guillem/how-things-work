<script lang="ts">
	/** Root of the n-gram illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		count: () => import('./scenes/CountScene.svelte'),
		write: () => import('./scenes/WriteScene.svelte'),
		lab: () => import('./scenes/LabScene.svelte'),
		unseen: () => import('./scenes/UnseenScene.svelte'),
		explode: () => import('./scenes/ExplodeScene.svelte'),
		summary: () => import('./scenes/SummaryScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
