import fs from 'node:fs';
import path from 'node:path';

const code = /\.(?:[cm]?[jt]s|svelte)$/;
const model = (file) => file.endsWith('-model.e2e.ts');

/** Conservative topic selection: imports cover historical test names; URLs cover browser tests. */
export function createPlan(root, changed, requestedTopics = []) {
	const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
	const exists = (file) => fs.existsSync(path.join(root, file));
	const tests = fs
		.readdirSync(path.join(root, 'e2e'))
		.filter((f) => f.endsWith('.e2e.ts'))
		.map((f) => `e2e/${f}`);
	const topics = fs
		.readdirSync(path.join(root, 'src/routes'))
		.filter((slug) => exists(`src/routes/${slug}/steps.ts`));
	for (const slug of requestedTopics) {
		if (!topics.includes(slug)) throw new Error(`Unknown topic: ${slug}`);
	}
	const selected = new Set(requestedTopics);
	let broad = false;
	for (const file of changed) {
		const route = /^src\/routes\/([^/]+)\//.exec(file)?.[1];
		if (route && topics.includes(route)) selected.add(route);
		else if (file.startsWith('docs/') && !['docs/TOPICS.md', 'docs/PATHS.md'].includes(file))
			continue;
		else if (/\.(?:md|txt)$/.test(file) && !['docs/TOPICS.md', 'docs/PATHS.md'].includes(file))
			continue;
		else if (/^e2e\/[^/]+\.e2e\.ts$/.test(file) && exists(file)) continue;
		else broad = true;
	}
	// Follow static imports, including cross-topic model reuse. Unresolved/dynamic topic
	// imports cannot narrow shared changes: those already take the broad path above.
	const edges = new Map();
	function imports(file) {
		if (edges.has(file)) return edges.get(file);
		const result = [];
		edges.set(file, result);
		if (!exists(file) || !code.test(file)) return result;
		for (const match of read(file).matchAll(/['"]((?:\.{1,2}\/|\$lib\/|#lib\/)[^'"]+)['"]/g)) {
			const spec = match[1];
			const base = spec.startsWith('.')
				? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))
				: spec.startsWith('$lib/')
					? `src/lib/${spec.slice(5)}`
					: spec.startsWith('#lib/')
						? `src/lib/${spec.slice(5)}`
						: null;
			if (!base) continue;
			const found = [base, `${base}.ts`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`].find(
				(candidate) => exists(candidate) && fs.statSync(path.join(root, candidate)).isFile()
			);
			if (found) result.push(found);
		}
		return result;
	}
	function reaches(file, targets, seen = new Set()) {
		if (seen.has(file)) return false;
		seen.add(file);
		return imports(file).some((dep) => targets.has(dep) || reaches(dep, targets, seen));
	}
	const walk = (dir) =>
		fs
			.readdirSync(path.join(root, dir), { withFileTypes: true })
			.flatMap((entry) =>
				entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]
			);
	const routeFiles = new Map(topics.map((slug) => [slug, walk(`src/routes/${slug}`)]));
	// An explicit topic has no Git diff after committing. Include its consumers too.
	const targets = new Set([...changed, ...requestedTopics.flatMap((slug) => routeFiles.get(slug))]);
	for (const slug of topics) {
		if (
			!selected.has(slug) &&
			targets.size &&
			routeFiles.get(slug).some((file) => reaches(file, targets))
		)
			selected.add(slug);
	}
	const topicFiles = new Set([...selected].flatMap((slug) => routeFiles.get(slug)));
	const affected = tests.filter(
		(file) =>
			broad ||
			changed.includes(file) ||
			reaches(file, topicFiles) ||
			[...selected].some((slug) => read(file).includes(`/${slug}/`))
	);
	const format = [
		...new Set([...changed, ...(requestedTopics.length ? [...topicFiles, ...affected] : [])])
	]
		.filter(exists)
		.sort();
	// Recheck unchanged consumers: imported type changes can introduce lint failures
	// without producing a TypeScript error. Include shared consumers outside routes.
	const lintTargets = new Set([...changed, ...topicFiles]);
	const lint = [
		...new Set([
			...format,
			...topicFiles,
			...affected,
			...(lintTargets.size
				? [...walk('src'), ...walk('e2e')].filter(
						(file) => code.test(file) && reaches(file, lintTargets)
					)
				: [])
		])
	]
		.filter((file) => exists(file) && code.test(file))
		.sort();
	return {
		broad,
		topics: [...selected].sort(),
		format,
		lint,
		types: broad || selected.size > 0 || changed.some((file) => code.test(file)),
		models: affected.filter(model),
		browser: affected.filter((file) => !model(file) && file !== 'e2e/scenes.e2e.ts'),
		scenes: broad || selected.size > 0 || changed.includes('e2e/scenes.e2e.ts')
	};
}
