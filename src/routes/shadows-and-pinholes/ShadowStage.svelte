<script lang="ts">
	/** Root of the shadows-and-pinholes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		room: () => import('./scenes/RoomScene.svelte'),
		pinhole: () => import('./scenes/PinholeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
