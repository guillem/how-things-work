<script lang="ts">
	/** Root of the reaction rates illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		collide: () => import('./scenes/CollideScene.svelte'),
		energy: () => import('./scenes/EnergyScene.svelte'),
		flask: () => import('./scenes/FlaskScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
