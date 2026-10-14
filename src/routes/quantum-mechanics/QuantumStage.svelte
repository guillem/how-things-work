<script lang="ts">
	/** Root of the quantum-mechanics illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		slits: () => import('./scenes/SlitScene.svelte'),
		packet: () => import('./scenes/PacketScene.svelte'),
		barrier: () => import('./scenes/BarrierScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
