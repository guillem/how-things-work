<script lang="ts">
	/** Root of the wireless-signals illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		keying: () => import('./scenes/KeyingScene.svelte'),
		channel: () => import('./scenes/ChannelScene.svelte'),
		link: () => import('./scenes/LinkScene.svelte'),
		limit: () => import('./scenes/LimitScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
