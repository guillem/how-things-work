<script lang="ts">
	/** Root of the waves illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		rope: () => import('./scenes/RopeScene.svelte'),
		tank: () => import('./scenes/TankScene.svelte'),
		string: () => import('./scenes/StringScene.svelte'),
		doppler: () => import('./scenes/DopplerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
