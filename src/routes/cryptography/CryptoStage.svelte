<script lang="ts">
	/** Root of the cryptography illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		channel: () => import('./scenes/ChannelScene.svelte'),
		paint: () => import('./scenes/PaintScene.svelte'),
		dh: () => import('./scenes/DhScene.svelte'),
		dlog: () => import('./scenes/DlogScene.svelte'),
		hash: () => import('./scenes/HashScene.svelte'),
		rsa: () => import('./scenes/RsaScene.svelte'),
		summary: () => import('./scenes/SummaryScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
