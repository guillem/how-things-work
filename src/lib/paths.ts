/** Paths in authoring order; invalid definitions fail the build. */
import source from '../../docs/PATHS.md?raw';
import { catalog } from './catalog';
import { assertPaths, parsePaths, stops } from './paths-parse';

export { stops, place, neighbours, type TopicPath, type PathChapter } from './paths-parse';

export const paths = parsePaths(source);
assertPaths(paths, catalog);
export const byId = new Map(paths.map((path) => [path.id, path]));
export const pathsFor = (slug: string) => paths.filter((path) => stops(path).includes(slug));
