<script lang="ts">
	/** Root of the ocean acidification illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sea: () => import('./scenes/SeaScene.svelte'),
		bjerrum: () => import('./scenes/BjerrumScene.svelte'),
		sweep: () => import('./scenes/SweepScene.svelte'),
		shells: () => import('./scenes/ShellsScene.svelte'),
		revelle: () => import('./scenes/RevelleScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
