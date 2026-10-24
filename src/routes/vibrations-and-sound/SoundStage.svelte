<script lang="ts">
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';
	let props: StageProps = $props();
	const scenes: SceneLoaders = { sound: () => import('./scenes/SoundScene.svelte') };
</script>

<SceneStage {...props} {scenes} />
