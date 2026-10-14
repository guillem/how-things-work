<script lang="ts">
	import { Label } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	let { step }: StageProps = $props();
</script>

<g><Label x={480} y={300} text={step.title} size={16} /></g>
