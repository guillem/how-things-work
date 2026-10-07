<script lang="ts">
	/** Root of the Newton's-laws illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		carts: () => import('./scenes/CartsScene.svelte'),
		projectile: () => import('./scenes/ProjectileScene.svelte'),
		track: () => import('./scenes/TrackScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
