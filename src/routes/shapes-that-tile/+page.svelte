<script lang="ts">
	import ExplainerPage from '#lib/components/ExplainerPage.svelte';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { spec } from './steps';
	import Stage from './TileStage.svelte';
</script>

<ExplainerPage {spec}
	>{#snippet stage(props: StageProps)}<Stage {...props} />{/snippet}</ExplainerPage
>
