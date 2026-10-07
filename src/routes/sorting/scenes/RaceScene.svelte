<script lang="ts">
	/** Placeholder until the scene is written. */
	import { Label } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';

	let { step }: StageProps = $props();
</script>

<g><Label x={480} y={300} text="Race scene ({step.id})" /></g>
