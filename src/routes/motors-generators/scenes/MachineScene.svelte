<script lang="ts">
	/** Placeholder while the scene is built. */
	import type { StageProps } from '#lib/explainer/index.ts';
	let { step }: StageProps = $props();
</script>

<g><text x="480" y="300" text-anchor="middle">{step.title}</text></g>
