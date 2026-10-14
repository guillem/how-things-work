<script lang="ts">
	import type { StageProps } from '#lib/explainer/index.ts';
	let { t }: StageProps = $props();
</script>

<g><text x="100" y="100">{t.toFixed(1)}</text></g>
