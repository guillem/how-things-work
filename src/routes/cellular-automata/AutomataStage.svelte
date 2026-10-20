<script lang="ts">
	/** Root of the cellular-automata illustration: the scenes, in narrative order. See `SceneStage`. */
	import { SceneStage, type SceneLoaders, type StageProps } from '#lib/explainer/index.ts';

	let props: StageProps = $props();

	const scenes: SceneLoaders = {
		rule: () => import('./scenes/RuleScene.svelte'),
		survey: () => import('./scenes/SurveyScene.svelte'),
		traffic: () => import('./scenes/TrafficScene.svelte')
	};
</script>

<SceneStage {...props} {scenes} />
