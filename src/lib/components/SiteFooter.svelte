<script lang="ts">
	import { site } from '#lib/site.ts';
</script>

<footer class="site-footer">
	<div class="inner">
		<p>
			{site.name} — interactive explanations, entirely in your browser.
		</p>
		<p>
			<a href={site.repository} target="_blank" rel="noreferrer">Source on GitHub</a>
		</p>
	</div>
</footer>

<style>
	.site-footer {
		border-top: 1px solid var(--border);
		margin-top: 64px;
	}
	.inner {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: 28px clamp(16px, 3vw, 32px);
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		justify-content: space-between;
		color: var(--text-muted);
		font-size: 0.9rem;
	}
</style>
