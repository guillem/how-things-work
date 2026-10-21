<script lang="ts">
	/** Root of the qr-codes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		qr: () => import('./scenes/QrScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
