<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	let { step }: StageProps = $props();
</script>

<g><text x="100" y="100">{step.id}</text></g>
