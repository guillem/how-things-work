/** Pure parser and catalogue validation for docs/PATHS.md, also used in Node tests. */
import type { Catalog } from './catalog-parse';

export interface PathChapter {
	title: string;
	slugs: string[];
}

export interface TopicPath {
	id: string;
	title: string;
	promise: string;
	chapters: PathChapter[];
}

export const stops = (path: TopicPath): string[] => path.chapters.flatMap((c) => c.slugs);

export function parsePaths(markdown: string): TopicPath[] {
	const paths: TopicPath[] = [];
	let path: TopicPath | undefined;
	let chapters = false;
	for (const line of markdown.split(/\r?\n/)) {
		const heading = line.match(/^## (.+)$/);
		if (heading) {
			const id = heading[1].trim();
			if (!/^[a-z0-9-]+$/.test(id) || paths.some((p) => p.id === id)) {
				throw new Error(`PATHS.md: invalid or repeated path id "${id}"`);
			}
			path = { id, title: '', promise: '', chapters: [] };
			paths.push(path);
			chapters = false;
			continue;
		}
		if (!path) continue;
		const field = line.match(/^- \*\*(Title|Promise):\*\*\s*(.*)$/);
		if (field) {
			path[field[1] === 'Title' ? 'title' : 'promise'] = field[2].trim();
			chapters = false;
		} else if (line.trim() === '- **Chapters:**') {
			chapters = true;
		} else if (chapters && /^\s+- /.test(line)) {
			const chapter = line.match(/^\s+- ([^:]+):\s*(.*)$/);
			if (!chapter || !chapter[1].trim() || !chapter[2].trim()) {
				throw new Error(`PATHS.md: ${path.id} has an empty or malformed chapter: ${line.trim()}`);
			}
			const slugs = chapter[2].split(',').map((s) => s.trim());
			for (const slug of slugs) {
				if (!/^[a-z0-9-]+$/.test(slug)) {
					throw new Error(`PATHS.md: ${path.id} has invalid slug "${slug}"`);
				}
			}
			path.chapters.push({ title: chapter[1].trim(), slugs });
		}
	}
	for (const p of paths) {
		if (!p.title || !p.promise || !p.chapters.length) {
			throw new Error(`PATHS.md: ${p.id} needs a title, promise and chapters`);
		}
		const seen = new Set<string>();
		for (const slug of stops(p)) {
			if (seen.has(slug)) throw new Error(`PATHS.md: ${p.id} repeats slug "${slug}"`);
			seen.add(slug);
		}
	}
	return paths;
}

export function assertPaths(paths: TopicPath[], catalog: Catalog): void {
	for (const path of paths) {
		const order = stops(path);
		const positions = new Map(order.map((slug, index) => [slug, index]));
		for (const [index, slug] of order.entries()) {
			const entry = catalog.bySlug.get(slug);
			if (!entry) throw new Error(`PATHS.md: ${path.id} has unknown stop "${slug}"`);
			for (const prerequisite of entry.prerequisites) {
				const position = positions.get(prerequisite);
				if (position !== undefined && position >= index) {
					throw new Error(`PATHS.md: ${path.id}: ${slug} requires ${prerequisite} to come earlier`);
				}
			}
		}
	}
}

export function place(path: TopicPath, slug: string) {
	let index = 0;
	for (const chapter of path.chapters) {
		for (const stop of chapter.slugs) {
			index++;
			if (stop === slug) return { index, chapter };
		}
	}
	return undefined;
}

export function neighbours(path: TopicPath, slug: string) {
	const order = stops(path);
	const index = order.indexOf(slug);
	return {
		previous: index > 0 ? order[index - 1] : undefined,
		next: index >= 0 ? order[index + 1] : undefined
	};
}
