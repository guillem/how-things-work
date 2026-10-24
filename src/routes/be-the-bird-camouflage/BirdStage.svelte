<script lang="ts">
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';
	let props: StageProps = $props();
	const scenes: SceneLoaders = { bark: () => import('./scenes/BarkScene.svelte') };
</script>

<SceneStage {...props} {scenes} />
