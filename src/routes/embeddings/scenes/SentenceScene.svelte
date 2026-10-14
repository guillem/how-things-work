<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';
	let { step }: StageProps = $props();
</script>

<g><Txt x={480} y={300} text="todo {step.id}" anchor="middle" /></g>
