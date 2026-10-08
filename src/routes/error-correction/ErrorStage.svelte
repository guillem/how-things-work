<script lang="ts">
	/** Root of the error-correction illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		channel: () => import('./scenes/ChannelScene.svelte'),
		code: () => import('./scenes/CodeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
