<script lang="ts">
	/** Root of the twelve-notes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		pair: () => import('./scenes/PairScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		ladder: () => import('./scenes/LadderScene.svelte'),
		chord: () => import('./scenes/ChordScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
