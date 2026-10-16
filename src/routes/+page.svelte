<script lang="ts">
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import TopicCard from '#lib/components/TopicCard.svelte';
	import { site } from '#lib/site.ts';
	import { catalog, levelNames, type Level } from '#lib/catalog.ts';
	import { sections, topics, type Topic } from '#lib/topics.ts';
	import { progress } from '#lib/progress.svelte.ts';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';

	// Search and filters. The prerendered page lists every topic; the filters
	// only narrow it once the page has loaded. Their state lives in the query
	// string (?q=&area=&level=) so a filtered list can be shared or returned to.
	let query = $state('');
	let areas = $state<string[]>([]);
	let levels = $state<Level[]>([]);
	let ready = $state(false);
	let searchInput: HTMLInputElement | undefined = $state();

	const areaOptions = sections.map((s) => s.category);
	const levelOptions = [...new Set(topics.map((t) => t.entry.level))].sort((a, b) => a - b);

	/** Lower case, no accents or apostrophes, every run of other punctuation or space one space. */
	const fold = (s: string) =>
		s
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.toLowerCase()
			.replace(/['\u2019]/g, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ');
	const haystacks = new Map(
		topics.map((t) => [
			t.slug,
			fold([t.title, t.summary, t.entry.title, t.entry.takeaway, t.category.name, t.slug].join(' '))
		])
	);
	const words = $derived(fold(query).split(' ').filter(Boolean));
	const matchesQuery = (t: Topic) => words.every((w) => haystacks.get(t.slug)!.includes(w));
	const inArea = (t: Topic) => areas.length === 0 || areas.includes(t.category.id);
	const atLevel = (t: Topic) => levels.length === 0 || levels.includes(t.entry.level);

	const shown = $derived(
		sections
			.map((s) => ({
				category: s.category,
				topics: s.topics.filter((t) => matchesQuery(t) && inArea(t) && atLevel(t))
			}))
			.filter((s) => s.topics.length > 0)
	);
	const shownCount = $derived(shown.reduce((n, s) => n + s.topics.length, 0));
	const filtering = $derived(words.length > 0 || areas.length > 0 || levels.length > 0);
	// Each option's count is what choosing it would add, given the other filters.
	const areaCounts = $derived(
		new Map(
			areaOptions.map((c) => [
				c.id,
				topics.filter((t) => t.category.id === c.id && matchesQuery(t) && atLevel(t)).length
			])
		)
	);
	const levelCounts = $derived(
		new Map(
			levelOptions.map((l) => [
				l,
				topics.filter((t) => t.entry.level === l && matchesQuery(t) && inArea(t)).length
			])
		)
	);

	const emptyMessage = $derived(
		words.length === 0
			? 'No explainer matches these filters.'
			: areas.length || levels.length
				? `No explainer matches “${query.trim()}” with these filters.`
				: `No explainer matches “${query.trim()}”.`
	);

	const toggle = <T,>(list: T[], value: T) =>
		list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

	function clearFilters() {
		query = '';
		areas = [];
		levels = [];
		searchInput?.focus();
	}

	onMount(() => {
		progress.load();
		const params = new URLSearchParams(location.search);
		const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
		query = params.get('q') ?? '';
		areas = list('area').filter((id) => areaOptions.some((c) => c.id === id));
		levels = levelOptions.filter((l) => list('level').includes(String(l)));
		ready = true;
	});

	$effect(() => {
		const params = Object.entries({
			q: query.trim(),
			area: areas.join(','),
			level: levels.join(',')
		}).filter(([, value]) => value);
		if (!ready) return;
		const search = new URLSearchParams(params).toString().replaceAll('%2C', ',');
		const url = location.pathname + (search ? `?${search}` : '') + location.hash;
		if (url !== location.pathname + location.search + location.hash) replaceState(url, {});
	});

	// "/" jumps to the search box, as on many sites.
	function onKeydown(e: KeyboardEvent) {
		if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
		const target = e.target as HTMLElement;
		if (target.closest('input, textarea, select, [contenteditable]')) return;
		e.preventDefault();
		searchInput?.focus();
	}

	const counts = $derived.by(() => {
		const c = { done: 0, started: 0, new: 0 };
		for (const t of topics) c[progress.status(t.slug)]++;
		return c;
	});

	function clearProgress() {
		if (confirm('Clear your progress on every explainer? This cannot be undone.')) progress.clear();
	}
</script>

<svelte:head>
	<title>{site.name}</title>
	<meta name="description" content={site.description} />
	<meta property="og:title" content={site.name} />
	<meta property="og:description" content={site.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={site.url} />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:image" content="{site.url}og-image.png" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<SiteHeader />

<main class="page">
	<section class="hero">
		<h1>How things work</h1>
		<p class="lede">{site.tagline}</p>
		<p class="sub">
			Each explainer is a short, animated walk-through you can step through at your own pace — from
			the big picture down to the mechanism. Everything runs in your browser.
		</p>
	</section>

	<section class="tally" aria-label="Your progress">
		<p class="counts" aria-live="polite">
			<span class="count done">Done: <b>{counts.done}</b></span>
			<span class="count started">Started: <b>{counts.started}</b></span>
			<span class="count new">New: <b>{counts.new}</b></span>
			<span class="count total">Total: <b>{topics.length}</b></span>
		</p>
		<button
			type="button"
			class="clear"
			onclick={clearProgress}
			disabled={counts.done + counts.started === 0}
		>
			Clear all progress
		</button>
	</section>

	<section class="filters" aria-label="Find an explainer">
		<label class="sr-only" for="topic-search">Search the explainers</label>
		<input
			id="topic-search"
			class="search"
			type="search"
			placeholder="Search {topics.length} explainers"
			autocomplete="off"
			spellcheck="false"
			aria-keyshortcuts="/"
			bind:this={searchInput}
			bind:value={query}
		/>
		<div class="group" role="group" aria-labelledby="filter-area">
			<span class="group-label" id="filter-area">Area</span>
			{#each areaOptions as c (c.id)}
				<button
					type="button"
					class="chip"
					class:none={areaCounts.get(c.id) === 0}
					aria-pressed={areas.includes(c.id)}
					onclick={() => (areas = toggle(areas, c.id))}
				>
					{c.name} <span class="n">{areaCounts.get(c.id)}</span>
				</button>
			{/each}
		</div>
		<div class="group" role="group" aria-labelledby="filter-level">
			<span class="group-label" id="filter-level">Level</span>
			{#each levelOptions as l (l)}
				<button
					type="button"
					class="chip"
					class:none={levelCounts.get(l) === 0}
					title={levelNames[l]}
					aria-pressed={levels.includes(l)}
					onclick={() => (levels = toggle(levels, l))}
				>
					Level {l} <span class="n">{levelCounts.get(l)}</span>
				</button>
			{/each}
			<span class="legend">
				{#each levelOptions as l, i (l)}{i ? ' · ' : ''}{l}: {levelNames[l].toLowerCase()}{/each}
			</span>
		</div>
		<p class="result" aria-live="polite">
			{#if filtering}
				Showing <b>{shownCount}</b> of {topics.length} explainers
				<button type="button" class="reset" onclick={clearFilters}>Clear filters</button>
			{:else}
				All {topics.length} explainers
			{/if}
		</p>
	</section>

	{#each shown as { category, topics: built } (category.id)}
		<section class="topics" aria-labelledby="category-{category.id}">
			<h2 id="category-{category.id}">{category.name}</h2>
			<div class="grid">
				{#each built as topic (topic.slug)}
					<TopicCard {topic} />
				{/each}
			</div>
		</section>
	{:else}
		<p class="empty">
			<span>{emptyMessage}</span>
			<button type="button" class="reset" onclick={clearFilters}>Clear filters</button>
		</p>
	{/each}

	<p class="progress">
		{topics.length} of the {catalog.entries.length} planned topics are written so far. More are on the
		way.
	</p>
</main>

<SiteFooter />

<style>
	.page {
		max-width: var(--page-width, 1200px);
		margin: 0 auto;
		padding: 0 clamp(16px, 3vw, 32px);
	}
	.hero {
		padding: clamp(40px, 8vw, 88px) 0 clamp(32px, 5vw, 56px);
		max-width: 720px;
	}
	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		letter-spacing: -0.03em;
		margin-bottom: 14px;
	}
	.lede {
		font-size: clamp(1.1rem, 2vw, 1.35rem);
		font-weight: 500;
		color: var(--text);
		margin-bottom: 12px;
		text-wrap: pretty;
	}
	.sub {
		font-size: 1.02rem;
		color: var(--text-muted);
		max-width: 60ch;
		text-wrap: pretty;
	}
	.tally {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
		margin-bottom: 20px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 18px;
		font-size: 0.95rem;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.count b {
		color: var(--text);
		font-weight: 600;
	}
	.count::before {
		content: '';
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 7px;
		border-radius: 50%;
		background: var(--text-faint);
		vertical-align: 0.05em;
	}
	.count.done::before {
		background: var(--status-done);
	}
	.count.started::before {
		background: var(--status-started);
	}
	.count.new::before {
		background: var(--status-new);
	}
	.count.total::before {
		display: none;
	}
	.clear {
		margin-left: auto;
		padding: 6px 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
	}
	.clear:hover:not(:disabled) {
		border-color: var(--status-done);
		color: var(--status-done);
	}
	.clear:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.filters {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 40px;
	}
	.search {
		width: 100%;
		max-width: 520px;
		padding: 10px 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 1rem;
	}
	.search::placeholder {
		color: var(--text-faint);
	}
	.group {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 8px;
	}
	.group-label {
		width: 4rem;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.chip {
		padding: 4px 12px;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: var(--surface);
		color: var(--text);
		font-size: 0.88rem;
		cursor: pointer;
	}
	.chip:hover {
		border-color: var(--accent);
	}
	.chip.none:not([aria-pressed='true']) {
		color: var(--text-faint);
	}
	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--bg);
	}
	.chip .n {
		margin-left: 2px;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.6;
	}
	.legend {
		flex-basis: 100%;
		padding-left: calc(4rem + 8px);
		font-size: 0.82rem;
		color: var(--text-faint);
	}
	@media (max-width: 640px) {
		.group-label {
			width: 100%;
		}
		.legend {
			padding-left: 0;
		}
	}
	.result,
	.empty {
		color: var(--text-muted);
		font-size: 0.92rem;
	}
	.result b {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		padding: 32px 0;
		font-size: 1rem;
	}
	.reset {
		margin-left: 8px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.topics + .topics {
		margin-top: 48px;
	}
	.topics h2 {
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 16px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 20px;
	}
	.progress {
		margin-top: 48px;
		color: var(--text-faint);
		font-size: 0.92rem;
	}
</style>
