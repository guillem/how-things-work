<script lang="ts">
	/** Root of the salt-and-ice illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		road: () => import('./scenes/RoadScene.svelte'),
		particles: () => import('./scenes/ParticleScene.svelte'),
		curve: () => import('./scenes/CurveScene.svelte'),
		bowl: () => import('./scenes/BowlScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
