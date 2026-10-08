<script lang="ts">
	/** Root of the primes & clock-arithmetic illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		sieve: () => import('./scenes/SieveScene.svelte'),
		clock: () => import('./scenes/ClockScene.svelte'),
		power: () => import('./scenes/PowerScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
