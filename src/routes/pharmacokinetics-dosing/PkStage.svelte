<script lang="ts">
	/** Root of the pharmacokinetics illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		curve: () => import('./scenes/CurveScene.svelte'),
		build: () => import('./scenes/BuildScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
