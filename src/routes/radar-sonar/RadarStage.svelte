<script lang="ts">
	/** Root of the radar-sonar illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		ping: () => import('./scenes/PingScene.svelte'),
		pulse: () => import('./scenes/PulseScene.svelte'),
		doppler: () => import('./scenes/DopplerScene.svelte'),
		map: () => import('./scenes/MapScene.svelte'),
		sonar: () => import('./scenes/SonarScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
