<script lang="ts">
	/** Root of the MRI k-space illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		kspace: () => import('./scenes/KspaceScene.svelte'),
		sequence: () => import('./scenes/SequenceScene.svelte'),
		echo: () => import('./scenes/EchoScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
