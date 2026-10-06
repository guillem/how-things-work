<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { site } from '#lib/site.ts';
</script>

<svelte:head>
	<title>Page not found — {site.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<SiteHeader />

<main class="page">
	<p class="code">404</p>
	<h1>There's nothing here</h1>
	<p>The page you were looking for doesn't exist or has moved.</p>
	<p><a href={resolve('/')}>Back to all explainers</a></p>
</main>

<SiteFooter />

<style>
	.page {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: clamp(48px, 10vw, 120px) clamp(16px, 3vw, 32px);
		display: grid;
		gap: 12px;
	}
	.code {
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--text-faint);
	}
	h1 {
		font-size: clamp(1.8rem, 4vw, 2.4rem);
	}
	p {
		color: var(--text-muted);
	}
</style>
