<script lang="ts">
	/** Root of the cochlea illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		cochlea: () => import('./scenes/CochleaScene.svelte'),
		damage: () => import('./scenes/DamageScene.svelte'),
		implant: () => import('./scenes/ImplantScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
