<script lang="ts">
	/** Root of the Hückel illustration. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		orbitals: () => import('./scenes/OrbitalScene.svelte'),
		dye: () => import('./scenes/DyeScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
