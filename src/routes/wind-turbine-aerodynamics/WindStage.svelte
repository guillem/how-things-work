<script lang="ts">
	/** Root of the wind-turbine illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		disc: () => import('./scenes/DiscScene.svelte'),
		section: () => import('./scenes/SectionScene.svelte'),
		span: () => import('./scenes/SpanScene.svelte'),
		cp: () => import('./scenes/CpScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
