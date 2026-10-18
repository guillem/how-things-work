<script lang="ts">
	/** Root of the differential-equations illustration: one scene for every step. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		field: () => import('./scenes/FieldScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
