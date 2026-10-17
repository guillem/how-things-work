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
	// Which option list is open in the narrow bar (on wide screens both always show).
	let open = $state<'area' | 'level' | null>(null);

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

<div class="index">
	<SiteHeader />

	<main class="page">
		<section class="hero">
			<h1>How things work</h1>
			<p class="lede">{site.tagline}</p>
		</section>

		<div class="layout">
			<!-- On wide screens a sidebar that stays in view; on narrow ones a compact bar whose
			     Area and Level buttons open the options. -->
			<aside class="side" aria-label="Find an explainer">
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
				<div class="toggles">
					<button
						type="button"
						class="disclose"
						aria-expanded={open === 'area'}
						aria-controls="group-area"
						aria-label={areas.length ? `Area, ${areas.length} chosen` : 'Area'}
						onclick={() => (open = open === 'area' ? null : 'area')}
					>
						Area{#if areas.length}<span class="picked" aria-hidden="true">{areas.length}</span
							>{/if}<span class="arrow" aria-hidden="true">▾</span>
					</button>
					<button
						type="button"
						class="disclose"
						aria-expanded={open === 'level'}
						aria-controls="group-level"
						aria-label={levels.length ? `Level, ${levels.length} chosen` : 'Level'}
						onclick={() => (open = open === 'level' ? null : 'level')}
					>
						Level{#if levels.length}<span class="picked" aria-hidden="true">{levels.length}</span
							>{/if}<span class="arrow" aria-hidden="true">▾</span>
					</button>
				</div>
				<div
					class="group area"
					class:open={open === 'area'}
					id="group-area"
					role="group"
					aria-labelledby="filter-area"
				>
					<span class="group-label" id="filter-area">Area</span>
					{#each areaOptions as c (c.id)}
						<button
							type="button"
							class="chip"
							class:none={areaCounts.get(c.id) === 0}
							aria-pressed={areas.includes(c.id)}
							onclick={() => (areas = toggle(areas, c.id))}
						>
							<span class="name">{c.name}</span> <span class="n">{areaCounts.get(c.id)}</span>
						</button>
					{/each}
				</div>
				<div
					class="group level"
					class:open={open === 'level'}
					id="group-level"
					role="group"
					aria-labelledby="filter-level"
				>
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
						{#each levelOptions as l (l)}<span>{l}: {levelNames[l].toLowerCase()}</span>{/each}
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
				<section
					class="tally"
					class:idle={counts.done + counts.started === 0}
					aria-label="Your progress"
				>
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
			</aside>

			<div class="list">
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
					{topics.length} of the {catalog.entries.length} planned topics are written so far. More are
					on the way.
				</p>
			</div>
		</div>
	</main>

	<SiteFooter />
</div>

<style>
	/* The index is wider than the other pages, so that three columns of cards still fit next to
	   the sidebar; the header and footer follow it. */
	.index {
		--page-width: 1360px;
		--side-width: 232px;
	}
	.page {
		max-width: var(--page-width);
		margin: 0 auto;
		padding: 0 clamp(16px, 3vw, 32px);
	}
	.hero {
		padding: clamp(28px, 6vw, 64px) 0 clamp(20px, 3vw, 32px);
		max-width: 720px;
	}
	.hero h1 {
		font-size: clamp(2.2rem, 5vw, 3.4rem);
		letter-spacing: -0.03em;
		margin-bottom: 10px;
	}
	.lede {
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		font-weight: 500;
		color: var(--text);
		text-wrap: pretty;
	}

	/* ---- narrow screens: a compact bar above the cards -------------------------------- */
	.side {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin-bottom: 28px;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}
	.search {
		order: 1;
		flex: 1 1 200px;
		min-width: 0;
		padding: 8px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--bg);
		color: var(--text);
		font: inherit;
		font-size: 1rem;
	}
	.search::placeholder {
		color: var(--text-faint);
	}
	.toggles {
		display: flex;
		gap: 8px;
		order: 2;
	}
	.disclose {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--text);
		font-size: 0.92rem;
		cursor: pointer;
	}
	.disclose .arrow {
		font-size: 0.8em;
		color: var(--text-muted);
		transition: transform 0.15s;
	}
	.disclose[aria-expanded='true'] {
		border-color: var(--accent);
	}
	.disclose[aria-expanded='true'] .arrow {
		transform: rotate(180deg);
	}
	.picked {
		min-width: 1.4em;
		padding: 0 5px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--bg);
		font-size: 0.78rem;
		font-weight: 600;
		text-align: center;
	}
	.group {
		display: none;
		order: 4;
		flex-basis: 100%;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding-top: 4px;
	}
	.group.open {
		display: flex;
	}
	.group-label {
		display: none;
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
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		flex-basis: 100%;
		font-size: 0.8rem;
		color: var(--text-faint);
	}
	.result {
		flex-basis: 100%;
		order: 5;
		color: var(--text-muted);
		font-size: 0.88rem;
	}
	.result b {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.tally {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 14px;
		order: 3;
		margin-left: auto;
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		font-size: 0.88rem;
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
		width: 8px;
		height: 8px;
		margin-right: 6px;
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
	/* On a narrow bar only what the reader has done is shown, once there is some; the sidebar
	   always lists all four. */
	.tally.idle {
		display: none;
	}
	/* On a narrow bar only what the reader has done is shown; the sidebar lists all four. */
	.count.new,
	.count.total {
		display: none;
	}
	.clear,
	.reset {
		padding: 0;
		border: 0;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 0.85rem;
		text-decoration: underline;
		cursor: pointer;
	}
	.reset {
		margin-left: 8px;
	}
	.clear:disabled {
		color: var(--text-faint);
		text-decoration: none;
		cursor: default;
	}

	/* ---- wide screens: a sidebar that stays in view ------------------------------------ */
	@media (min-width: 1100px) {
		.layout {
			display: grid;
			grid-template-columns: var(--side-width) minmax(0, 1fr);
			gap: 36px;
			align-items: start;
		}
		.side {
			position: sticky;
			top: 76px;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: stretch;
			gap: 14px;
			max-height: calc(100vh - 92px);
			overflow-y: auto;
			margin-bottom: 0;
			padding: 16px;
		}
		.search {
			flex: none;
			font-size: 0.95rem;
		}
		.toggles {
			display: none;
		}
		.group,
		.group.open {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 2px;
			padding-top: 0;
		}
		.group-label {
			display: block;
			margin-bottom: 4px;
			font-size: 0.75rem;
			font-weight: 600;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: var(--text-muted);
		}
		.area .chip {
			display: flex;
			justify-content: space-between;
			gap: 8px;
			padding: 3px 10px;
			border-color: transparent;
			border-radius: var(--radius-sm);
			background: none;
			text-align: left;
		}
		.area .chip:hover {
			border-color: transparent;
			background: var(--surface-2);
		}
		.area .chip[aria-pressed='true'] {
			background: var(--accent);
		}
		/* An even grid, so more levels later just add cells. */
		.level,
		.level.open {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
			gap: 6px;
		}
		.level .chip {
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: 4px 4px 3px;
			border-radius: var(--radius-sm);
			font-size: 0.84rem;
			line-height: 1.25;
		}
		.level .chip .n {
			margin-left: 0;
		}
		.level .group-label,
		.legend {
			grid-column: 1 / -1;
		}
		.legend {
			flex-direction: column;
			gap: 2px;
			margin-top: 4px;
			line-height: 1.35;
		}
		.search,
		.group,
		.result,
		.tally {
			order: 0;
		}
		.result {
			flex-basis: auto;
		}
		.tally {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
			margin-left: 0;
			padding-top: 14px;
			border-top: 1px solid var(--border);
		}
		.counts {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 4px 12px;
		}
		.count.new,
		.count.total {
			display: inline;
		}
		.tally.idle {
			display: flex;
		}
	}

	.topics + .topics {
		margin-top: 44px;
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
	.empty {
		padding: 32px 0;
		color: var(--text-muted);
	}
	.progress {
		margin-top: 48px;
		color: var(--text-faint);
		font-size: 0.92rem;
	}
</style>
