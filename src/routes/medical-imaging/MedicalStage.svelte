<script lang="ts">
	/** Root of the medical-imaging illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		beam: () => import('./scenes/BeamScene.svelte'),
		radiograph: () => import('./scenes/RadiographScene.svelte'),
		ct: () => import('./scenes/CtScene.svelte'),
		ultrasound: () => import('./scenes/UltrasoundScene.svelte'),
		mri: () => import('./scenes/MriScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
