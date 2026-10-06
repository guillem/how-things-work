<script lang="ts">
	import { resolve } from '$app/paths';
	import ThemeToggle from './ThemeToggle.svelte';
	import { site } from '#lib/site.ts';

	interface Props {
		/** Shown as a breadcrumb before the wordmark on inner pages. */
		back?: boolean;
	}
	let { back = false }: Props = $props();
</script>

<header class="site-header">
	<div class="inner">
		<a class="wordmark" href={resolve('/')} aria-label="{site.name} – home">
			<svg class="mark" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
				<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2" />
				<ellipse
					cx="16"
					cy="16"
					rx="13"
					ry="5.5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					transform="rotate(-30 16 16)"
				/>
				<circle cx="16" cy="16" r="3" fill="currentColor" />
			</svg>
			<span class="name">{site.name}</span>
		</a>
		{#if back}
			<a class="back" href={resolve('/')}>
				<span aria-hidden="true">←</span> All explainers
			</a>
		{/if}
		<nav class="actions" aria-label="Site">
			<a class="repo" href={site.repository} target="_blank" rel="noreferrer">GitHub</a>
			<ThemeToggle />
		</nav>
	</div>
</header>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 20;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		background: color-mix(in oklab, var(--bg) 82%, transparent);
		border-bottom: 1px solid var(--border);
	}
	.inner {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: 0 clamp(16px, 3vw, 32px);
		height: 60px;
		display: flex;
		align-items: center;
		gap: 20px;
	}
	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		font-weight: 600;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
	.wordmark:hover {
		text-decoration: none;
	}
	.mark {
		color: var(--accent);
	}
	.back {
		color: var(--text-muted);
		font-size: 0.92rem;
		padding-left: 20px;
		border-left: 1px solid var(--border);
	}
	.back:hover {
		color: var(--text);
		text-decoration: none;
	}
	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.repo {
		color: var(--text-muted);
		font-size: 0.92rem;
	}
	.repo:hover {
		color: var(--text);
		text-decoration: none;
	}
	@media (max-width: 640px) {
		.name,
		.repo {
			display: none;
		}
		.back {
			padding-left: 0;
			border-left: 0;
		}
	}
</style>
