<script lang="ts">
	/** Placeholder while the scene is being built. */
	import type { StageProps } from '#lib/explainer/index.ts';

	let { step }: StageProps = $props();
</script>

<g>
	<text x="480" y="300" text-anchor="middle" class="halo">{step.title}</text>
</g>
