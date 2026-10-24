<script lang="ts">
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';
	let props: StageProps = $props();
	const scenes: SceneLoaders = { glasses: () => import('./scenes/GlassesScene.svelte') };
</script>

<SceneStage {...props} {scenes} />
