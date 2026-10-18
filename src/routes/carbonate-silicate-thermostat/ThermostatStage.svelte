<script lang="ts">
	/** Root of the carbonate-silicate thermostat illustration: the scenes, in narrative order. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cycle: () => import('./scenes/CycleScene.svelte'),
		rate: () => import('./scenes/RateScene.svelte'),
		balance: () => import('./scenes/BalanceScene.svelte'),
		run: () => import('./scenes/RunScene.svelte'),
		sun: () => import('./scenes/SunScene.svelte'),
		zone: () => import('./scenes/ZoneScene.svelte'),
		clocks: () => import('./scenes/ClocksScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
