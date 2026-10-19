<script lang="ts">
	/** Root of the kalman-filter illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		blend: () => import('./scenes/BlendScene.svelte'),
		series: () => import('./scenes/SeriesScene.svelte'),
		track: () => import('./scenes/TrackScene.svelte'),
		fuse: () => import('./scenes/FuseScene.svelte'),
		swerve: () => import('./scenes/SwerveScene.svelte'),
		check: () => import('./scenes/CheckScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
