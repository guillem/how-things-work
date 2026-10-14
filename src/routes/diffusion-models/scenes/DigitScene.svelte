<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	let { step }: StageProps = $props();
</script>

<g><text x="40" y="40">{step.id}</text></g>
