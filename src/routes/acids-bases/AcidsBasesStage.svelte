<script lang="ts">
	/** Root of the acids and bases illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		dissociate: () => import('./scenes/DissociateScene.svelte'),
		ions: () => import('./scenes/IonsScene.svelte'),
		scale: () => import('./scenes/ScaleScene.svelte'),
		titration: () => import('./scenes/TitrationScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
