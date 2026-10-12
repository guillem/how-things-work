<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	import T from './T.svelte';
	let { step }: StageProps = $props();
</script>

<g><T x={480} y={300} text={step.title} anchor="middle" /></g>
