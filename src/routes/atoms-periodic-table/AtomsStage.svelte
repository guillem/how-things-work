<script lang="ts">
	/** Root of the atoms illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		atom: () => import('./scenes/AtomScene.svelte'),
		orbital: () => import('./scenes/OrbitalScene.svelte'),
		table: () => import('./scenes/TableScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
