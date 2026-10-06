<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';

	let { step, t }: StageProps = $props();
</script>

<g>
	<Label x={480} y={300} text="Summary scene — {step.id} — t = {t.toFixed(1)} s" size={20} muted />
</g>
