<script lang="ts">
	/** Root of the abs-brakes illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		curve: () => import('./scenes/CurveScene.svelte'),
		brake: () => import('./scenes/BrakeScene.svelte'),
		compare: () => import('./scenes/CompareScene.svelte'),
		steer: () => import('./scenes/SteerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
