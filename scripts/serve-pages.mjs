// Serves a built site the way GitHub Pages does, so the tests run against what
// is deployed: everything under a sub-path (BASE_PATH), `dir/` → `dir/index.html`,
// `dir` → 301 to `dir/`, and any unknown URL → `404.html` with status 404.
//
// Usage: node scripts/serve-pages.mjs <dir> <base> <port>
//   e.g. node scripts/serve-pages.mjs build /how-things-work 4180
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [dir = 'build', base = '', port = '4180'] = process.argv.slice(2);
const root = path.resolve(dir);

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.txt': 'text/plain; charset=utf-8',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff'
};

function send(res, status, file) {
	res.writeHead(status, {
		'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
		'cache-control': 'no-store'
	});
	fs.createReadStream(file).pipe(res);
}

const isFile = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;
const isDir = (p) => fs.statSync(p, { throwIfNoEntry: false })?.isDirectory() ?? false;

http
	.createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://localhost');
		const notFound = () => send(res, 404, path.join(root, '404.html'));
		let rel;
		if (url.pathname === base) {
			res.writeHead(301, { location: `${base}/${url.search}` });
			return res.end();
		}
		if (!url.pathname.startsWith(`${base}/`)) return notFound();
		try {
			rel = decodeURIComponent(url.pathname.slice(base.length));
		} catch {
			return notFound();
		}
		const file = path.join(root, rel);
		if (!file.startsWith(root)) return notFound();
		if (isFile(file)) return send(res, 200, file);
		if (isDir(file)) {
			if (!rel.endsWith('/')) {
				res.writeHead(301, { location: `${url.pathname}/${url.search}` });
				return res.end();
			}
			if (isFile(path.join(file, 'index.html')))
				return send(res, 200, path.join(file, 'index.html'));
		}
		if (isFile(`${file}.html`)) return send(res, 200, `${file}.html`);
		notFound();
	})
	.listen(Number(port), () => console.log(`Serving ${dir} at http://localhost:${port}${base}/`));
