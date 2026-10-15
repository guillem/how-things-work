<script lang="ts">
	/**
	 * Small decorative illustration for a topic card. Each topic gets a
	 * hand-drawn vignette; a topic without one falls back to a generic glyph.
	 */
	interface Props {
		slug: string;
		accent: string;
	}
	let { slug, accent }: Props = $props();

	// Unit circle: one period of a sine wave, 0°…360° over x 96…186; its 45° point
	// (x 107.3) is level with the circle's point.
	const sineArt = Array.from({ length: 61 }, (_, i) => {
		const x = 96 + (i / 60) * 90;
		const y = 62 - 30 * Math.sin((i / 60) * 2 * Math.PI);
		return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(' ');

	// Quantum mechanics: dots on the screen at heights drawn (deterministically) from a
	// cos² fringe pattern under a broad envelope, scattered a little sideways.
	const qmDots = (() => {
		const out: { x: number; y: number }[] = [];
		let seed = 7;
		const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
		while (out.length < 46) {
			const u = rand() * 2 - 1;
			const p = Math.cos(u * 4.5 * Math.PI) ** 2 * (1 - u * u);
			if (rand() < p) out.push({ x: 172 + rand() * 12, y: 60 + u * 46 });
		}
		return out;
	})();

	// Calculus: y = 100 − 70u² for u in 0…1 over x 24…180, six left-edge rectangles under
	// it, and the tangent at u = 0.6 (screen slope −140u/156).
	const calcY = (u: number) => 100 - 70 * u * u;
	const calcArt = {
		curve: Array.from({ length: 41 }, (_, i) => {
			const u = i / 40;
			return `${i ? 'L' : 'M'}${(24 + 156 * u).toFixed(1)} ${calcY(u).toFixed(1)}`;
		}).join(' '),
		rects: Array.from({ length: 6 }, (_, i) => ({ x: 24 + 26 * i, y: calcY(i / 6) })),
		tangent: { x: 117.6, y: calcY(0.6), k: (-140 * 0.6) / 156 }
	};

	// Vision & colour: three cone-sensitivity humps (decorative bell curves at the S, M and L
	// peaks, 442, 543 and 570 nm, over x 112…188 for 400…700 nm).
	const visionArt = (
		[
			[442, 26, 'var(--vc-s)'],
			[543, 30, 'var(--vc-m)'],
			[570, 34, 'var(--vc-l)']
		] as const
	).map(([peak, w, c]) => ({
		c,
		d: Array.from({ length: 41 }, (_, i) => {
			const nm = 400 + (i / 40) * 300;
			const y = 96 - 60 * Math.exp(-(((nm - peak) / w) ** 2) / 2);
			return `${i ? 'L' : 'M'}${(112 + (i / 40) * 76).toFixed(1)} ${y.toFixed(1)}`;
		}).join(' ')
	}));

	// Light & optics: the spectrum fanning out of a prism (fixed colours of the
	// rainbow, red bent least).
	const opticsArt = ['#e03131', '#f76707', '#fab005', '#40c057', '#228be6', '#7048e8'].map(
		(c, i) => ({ c, y1: 60 + i * 1.6, y2: 66 + i * 9 })
	);

	// Radioactivity: 8 × 10 nuclei, about half of them decayed (a fixed pattern), and
	// the curve 104 − 80·2^(−h) over four half-lives of 20 px each from x 112.
	const radArt = {
		cells: Array.from({ length: 80 }, (_, k) => ({
			k,
			x: 16 + (k % 8) * 10,
			y: 16 + Math.floor(k / 8) * 9.2,
			on: (k * 37) % 100 >= 45
		})),
		curve: Array.from({ length: 41 }, (_, i) => {
			const h = (i / 40) * 4;
			return `${i ? 'L' : 'M'}${(112 + h * 20).toFixed(1)} ${(104 - 80 * 2 ** -h).toFixed(1)}`;
		}).join(' ')
	};
	// Linear transformations: î ↦ (1.3, 0.5), ĵ ↦ (0.4, 1.1), 20 px per unit, origin (100, 60).
	const linearArt = (() => {
		const P = (x: number, y: number) => {
			const px = 100 + 20 * (1.3 * x + 0.4 * y);
			const py = 60 - 20 * (0.5 * x + 1.1 * y);
			return `${px.toFixed(1)} ${py.toFixed(1)}`;
		};
		const ks = [-2, -1, 0, 1, 2];
		const square = ks.map((k) => `M${100 + 20 * k} 14 V106 M40 ${60 + 20 * k} H160`).join(' ');
		const moved = ks
			.map((k) => `M${P(k, -2.2)} L${P(k, 2.2)} M${P(-2.4, k)} L${P(2.4, k)}`)
			.join(' ');
		const unit = `M${P(0, 0)} L${P(1, 0)} L${P(1, 1)} L${P(0, 1)} Z`;
		const arrows = [
			{ x: 126, y: 50, c: 'var(--lt-i)' },
			{ x: 108, y: 38, c: 'var(--lt-j)' }
		];
		return { square, moved, unit, arrows };
	})();

	// Fourier transform: a 1 Hz circle carrying a 3 Hz circle (a square wave's
	// first two ingredients, at time 0.07 of a period) and, level with the last
	// point, the wave it has traced: newest at the left, older to the right.
	const fourierArt = (() => {
		const A = 26 / (4 / Math.PI);
		const u0 = 0.07;
		const height = (u: number) =>
			A * (4 / Math.PI) * (Math.sin(2 * Math.PI * u) + Math.sin(6 * Math.PI * u) / 3);
		const wave = Array.from({ length: 81 }, (_, i) => {
			const x = 110 + i;
			const y = 60 - height(u0 - i / 80);
			return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}).join(' ');
		const r1 = A * (4 / Math.PI);
		const r3 = r1 / 3;
		const c2 = {
			x: 50 + r1 * Math.cos(2 * Math.PI * u0),
			y: 60 - r1 * Math.sin(2 * Math.PI * u0)
		};
		const tip = {
			x: c2.x + r3 * Math.cos(6 * Math.PI * u0),
			y: c2.y - r3 * Math.sin(6 * Math.PI * u0)
		};
		return { wave, r1, r3, c2, tip };
	})();

	// Sorting: ten bars, the last four already in place, two being compared.
	const sortArt = [5, 2, 6, 1, 4, 3, 7, 8, 9, 10].map((v, i) => ({
		i,
		h: 10 + v * 7.5,
		c: i >= 6 ? 'var(--sort-done)' : i === 2 || i === 3 ? 'var(--sort-compare)' : accent
	}));

	// Newton's laws: a parabola from (20, 100) to (130, 100), peak 70 high.
	const parabolaArt = Array.from({ length: 41 }, (_, i) => {
		const x = 20 + (i / 40) * 110;
		const u = i / 40;
		return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(100 - 280 * u * (1 - u)).toFixed(1)}`;
	}).join(' ');

	// Learning from data: points scattered around a gentle curve, the curve,
	// and a wiggly overfit through the points.
	const fitArt = (() => {
		const f = (x: number) => 60 - 28 * Math.sin((x - 20) / 50);
		const points = [26, 44, 60, 78, 94, 112, 130, 148, 166].map((x, i) => ({
			x,
			y: f(x) + [9, -8, 6, -10, 7, -6, 10, -7, 5][i]
		}));
		const path = (g: (x: number) => number) =>
			Array.from({ length: 61 }, (_, i) => {
				const x = 20 + (i / 60) * 160;
				return `${i ? 'L' : 'M'}${x.toFixed(1)} ${g(x).toFixed(1)}`;
			}).join(' ');
		const wiggle = (x: number) => f(x) + 9 * Math.sin((x - 26) / 5.7);
		return { points, smooth: path(f), wiggle: path(wiggle) };
	})();

	// Chaos and fractals: the Mandelbrot set's silhouette (main cardioid, the
	// period-2 disc and a few smaller bulbs) at 44 px per unit, c = 0 at (128, 60).
	const mandelArt = (() => {
		const X = (re: number) => 128 + 44 * re;
		const Y = (im: number) => 60 - 44 * im;
		const cardioid =
			Array.from({ length: 73 }, (_, i) => {
				const a = (i / 72) * 2 * Math.PI;
				const re = Math.cos(a) / 2 - Math.cos(2 * a) / 4;
				const im = Math.sin(a) / 2 - Math.sin(2 * a) / 4;
				return `${i ? 'L' : 'M'}${X(re).toFixed(1)} ${Y(im).toFixed(1)}`;
			}).join(' ') + ' Z';
		const bulbs = [
			{ re: -1, im: 0, r: 0.25 },
			{ re: -1.3107, im: 0, r: 0.06 },
			{ re: -0.1226, im: 0.7449, r: 0.095 },
			{ re: -0.1226, im: -0.7449, r: 0.095 },
			{ re: 0.2822, im: 0.5301, r: 0.045 },
			{ re: 0.2822, im: -0.5301, r: 0.045 }
		].map((b) => ({ x: X(b.re), y: Y(b.im), r: 44 * b.r }));
		return { cardioid, bulbs, tip: X(-2), neck: X(-1.37) };
	})();

	// PageRank: five pages of different sizes (their rank) and straight links
	// between them, each ending in a small arrowhead at the target's edge.
	const rankArt = (() => {
		const pages = [
			{ x: 92, y: 58, r: 21 },
			{ x: 36, y: 34, r: 9 },
			{ x: 40, y: 92, r: 11 },
			{ x: 154, y: 32, r: 14 },
			{ x: 160, y: 92, r: 8 }
		];
		const pairs = [
			[1, 0],
			[2, 0],
			[4, 0],
			[0, 3],
			[3, 0],
			[1, 2],
			[4, 3]
		];
		const links = pairs.map(([a, b]) => {
			const A = pages[a];
			const B = pages[b];
			const len = Math.hypot(B.x - A.x, B.y - A.y);
			const ux = (B.x - A.x) / len;
			const uy = (B.y - A.y) / len;
			// Two-way links are offset sideways so the arrows do not overlap.
			const two = pairs.some(([c, d]) => c === b && d === a);
			const ox = two ? -uy * 4 : 0;
			const oy = two ? ux * 4 : 0;
			const sx = A.x + ux * (A.r + 3) + ox;
			const sy = A.y + uy * (A.r + 3) + oy;
			const tx = B.x - ux * (B.r + 3) + ox;
			const ty = B.y - uy * (B.r + 3) + oy;
			const bx = tx - ux * 7;
			const by = ty - uy * 7;
			const f = (v: number) => v.toFixed(1);
			return {
				d: `M${f(sx)} ${f(sy)} L${f(bx)} ${f(by)}`,
				head: `M${f(tx)} ${f(ty)} L${f(bx - uy * 3.5)} ${f(by + ux * 3.5)} L${f(bx + uy * 3.5)} ${f(by - ux * 3.5)} Z`
			};
		});
		return { pages, links };
	})();

	// Epidemics: a jittered grid of people; infection spreads from the left,
	// recovered behind the front, susceptible ahead of it.
	const crowd = Array.from({ length: 48 }, (_, k) => {
		const col = k % 8;
		const row = Math.floor(k / 8);
		const jitter = (n: number) => Math.sin(k * 12.9898 + n * 78.233) * 3;
		const x = 14 + col * 11 + jitter(1);
		const front = 40 + Math.sin(row * 1.7) * 8;
		const s = x < front - 14 ? 'r' : x < front + 6 ? 'i' : 's';
		return { k, x, y: 22 + row * 15 + jitter(2), s };
	});

	// Ecosystems: rabbits and foxes cycling, the foxes' peaks lagging the rabbits',
	// over a strip of grass with one of each.
	const ecoArt = (() => {
		const curve = (amp: number, lag: number) =>
			Array.from({ length: 81 }, (_, i) => {
				const u = i / 80;
				const x = 16 + u * 168;
				const y = 54 - amp * Math.sin(u * 4 * Math.PI - lag);
				return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
			}).join(' ');
		return { prey: curve(30, 0), predator: curve(20, 1.2) };
	})();
	const rabbitIcon =
		'M-6 0a6 4.6 0 1 0 12 0a6 4.6 0 1 0-12 0Z M3 -3a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z ' +
		'M6.3 -5L5.4 -11.6L3.2 -11.5L4.4 -4.6Z M7.9 -4.3L9.4 -10.8L7.4 -11.4L6.4 -5Z ' +
		'M-8.2 -1.2a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z';
	const foxIcon =
		'M-8 0a8 4.2 0 1 0 16 0a8 4.2 0 1 0-16 0Z M5.5 3L14 0.2L5.5 -4Z M10.2 -2.2L7.6 -9L6.2 -3.2Z ' +
		'M-7 -1.5C-11 -6 -17 -5 -19.5 -1C-16 2 -11 2.5 -7 1.8Z M-5 2.5L-5.6 7.5L-4 7.5L-3 3Z M4 2.5L4.4 7.5L6 7.5L6 2.5Z';

	// Graph search: a 10 × 5 grid with a wall, the ripple of a breadth-first
	// search from S (shaded by steps from the start, its frontier outlined) and
	// the route round the wall to G.
	const gridArt = (() => {
		const wall = (c: number, r: number) => c === 5 && r >= 1;
		const depth: number[] = new Array(50).fill(99);
		depth[21] = 0;
		const queue = [21];
		while (queue.length) {
			const i = queue.shift()!;
			const c = i % 10;
			const r = Math.floor(i / 10);
			for (const [dc, dr] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nc = c + dc;
				const nr = r + dr;
				const j = nr * 10 + nc;
				if (nc < 0 || nc > 9 || nr < 0 || nr > 4 || wall(nc, nr) || depth[j] < 99) continue;
				depth[j] = depth[i] + 1;
				queue.push(j);
			}
		}
		return Array.from({ length: 50 }, (_, i) => {
			const c = i % 10;
			const r = Math.floor(i / 10);
			const d = depth[i];
			const kind = wall(c, r) ? 'wall' : d <= 4 ? 'seen' : d === 5 ? 'edge' : 'open';
			return { i, x: 30 + c * 14, y: 24 + r * 14, kind, shade: d * 24 };
		});
	})();

	// Bayes: 12 × 7 people; the first row's ten positives outlined — 2 ill (accent),
	// 8 healthy false positives — among a crowd of negatives. One path per group.
	const bayesArt = (() => {
		const d = { tp: '', fp: '', tn: '' };
		for (let i = 0; i < 84; i++) {
			const x = 23 + (i % 12) * 14;
			const y = 18 + Math.floor(i / 12) * 14;
			const g = i < 2 ? 'tp' : i < 10 ? 'fp' : 'tn';
			d[g] += `M${x - 5} ${y - 3}q0-2 2-2h6q2 0 2 2v6q0 2-2 2h-6q-2 0-2-2z`;
		}
		return d;
	})();

	// Oscillations: a mass on a coil spring and the dying wave it draws; the
	// wave starts level with the mass (centre y 88, line of rest y 62).
	const oscArt = (() => {
		let coil = 'M40 18 L40 24';
		for (let i = 0; i < 12; i++) coil += ` L${i % 2 ? 31 : 49} ${(26 + i * 4.3).toFixed(1)}`;
		coil += ' L40 76 L40 78';
		const wave = Array.from({ length: 81 }, (_, i) => {
			const u = i / 80;
			const x = 76 + u * 112;
			const y = 62 + 26 * Math.cos(2 * Math.PI * 3.2 * u) * Math.exp(-1.1 * u);
			return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}).join(' ');
		return { coil, wave };
	})();

	// Waves & interference: crests (half circles, 15 apart) spreading to the right
	// from two sources 30 apart; where they cross, the moiré shows the bands.
	const waveArt = [44, 76].flatMap((cy) =>
		Array.from({ length: 11 }, (_, i) => {
			const r = 15 * (i + 1);
			return {
				id: `${cy}-${i}`,
				d: `M40 ${cy - r} A${r} ${r} 0 0 1 40 ${cy + r}`,
				o: 0.75 - i * 0.05
			};
		})
	);

	// Central limit theorem: a small triangle of pins over a bell-shaped
	// histogram of 11 bars (binomial, 10 rows), with the normal curve over it.
	const cltArt = (() => {
		const C = [1, 10, 45, 120, 210, 252, 210, 120, 45, 10, 1];
		const bars = C.map((c, k) => {
			const h = 4 + (c / 252) * 62;
			return { k, x: 46 + k * 10, y: 108 - h, h };
		});
		const pins: { id: string; x: number; y: number }[] = [];
		for (let r = 0; r < 4; r++)
			for (let j = 0; j <= r; j++)
				pins.push({ id: `${r}-${j}`, x: 100 + (j - r / 2) * 12, y: 12 + r * 8 });
		const curve = Array.from({ length: 61 }, (_, i) => {
			const x = 40 + (i / 60) * 120;
			const z = (x - 100) / 15.8;
			return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(104 - 62 * Math.exp((-z * z) / 2)).toFixed(1)}`;
		}).join(' ');
		return { bars, pins, curve };
	})();
	// Atoms: a packed nucleus of protons (accent) and neutrons, in a soft cloud
	// of electron dots (no orbits).
	const atomArt = (() => {
		const nucleons = Array.from({ length: 12 }, (_, i) => {
			const r = 4.2 * Math.sqrt(i + 0.5);
			const a = i * 2.39996;
			return { i, x: 100 + r * Math.cos(a), y: 60 + r * Math.sin(a), p: i % 2 === 0 };
		}).reverse();
		const rand = (k: number) => {
			const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
			return x - Math.floor(x);
		};
		const dots = Array.from({ length: 26 }, (_, i) => {
			const a = rand(i) * Math.PI * 2;
			const r = 22 + 30 * Math.pow(rand(i + 100), 0.8);
			return { i, x: 100 + r * Math.cos(a) * 1.25, y: 60 + r * Math.sin(a) * 0.95 };
		});
		return { nucleons, dots };
	})();

	// Tensors: a scalar, a vector of 3, a 3 × 3 matrix and a 3 × 3 × 3 block (back layers drawn
	// first, offset up and to the right).
	const tensorArt = (() => {
		const out: { k: string; x: number; y: number; o: number }[] = [];
		out.push({ k: 's', x: 14, y: 54, o: 0.6 });
		for (let i = 0; i < 3; i++) out.push({ k: `v${i}`, x: 36 + i * 11, y: 54, o: 0.45 });
		for (let r = 0; r < 3; r++)
			for (let c = 0; c < 3; c++)
				out.push({ k: `m${r}${c}`, x: 82 + c * 11, y: 43 + r * 11, o: 0.35 });
		for (let d = 2; d >= 0; d--)
			for (let r = 0; r < 3; r++)
				for (let c = 0; c < 3; c++)
					out.push({
						k: `b${d}${r}${c}`,
						x: 132 + c * 11 + d * 9,
						y: 50 + r * 11 - d * 9,
						o: 0.25 + 0.1 * (2 - d)
					});
		return out;
	})();

	// Wireless signals: a carrier whose phase flips by half a turn at each bit change
	// (bits 1 0 1 1 0, 2 cycles per bit over x 14…104), and a 16-QAM grid of noisy points.
	const wsWave = Array.from({ length: 161 }, (_, i) => {
		const u = i / 160;
		const bit = [1, 0, 1, 1, 0][Math.min(4, Math.floor(u * 5))];
		const y = 60 - 26 * Math.sin(u * 10 * 2 * Math.PI) * (bit ? 1 : -1);
		return `${i ? 'L' : 'M'}${(14 + 90 * u).toFixed(1)} ${y.toFixed(1)}`;
	}).join(' ');
	const wsDots = (() => {
		const out: { x: number; y: number }[] = [];
		let seed = 11;
		const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
		for (let i = 0; i < 4; i++)
			for (let j = 0; j < 4; j++)
				for (let k = 0; k < 4; k++)
					out.push({
						x: 124 + i * 18 + (rand() + rand() - 1) * 5,
						y: 33 + j * 18 + (rand() + rand() - 1) * 5
					});
		return out;
	})();
</script>

<svg viewBox="0 0 200 120" class="art" style:--accent={accent} aria-hidden="true">
	<defs>
		<linearGradient id="art-fade-{slug}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color={accent} stop-opacity="0.18" />
			<stop offset="1" stop-color={accent} stop-opacity="0.02" />
		</linearGradient>
	</defs>
	<rect width="200" height="120" fill="url(#art-fade-{slug})" />

	{#if slug === 'photosynthesis'}
		<!-- sun -->
		<g class="sun">
			<circle cx="158" cy="30" r="12" fill="#f6c343" />
			{#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}
				<line
					x1="158"
					y1="30"
					x2={158 + 19 * Math.cos((a * Math.PI) / 180)}
					y2={30 + 19 * Math.sin((a * Math.PI) / 180)}
					stroke="#f6c343"
					stroke-width="2"
					stroke-linecap="round"
					stroke-dasharray="4 20"
					stroke-dashoffset="-15"
				/>
			{/each}
		</g>
		<!-- rays -->
		<g stroke="#f6c343" stroke-width="1.5" stroke-linecap="round" opacity="0.8">
			<line x1="142" y1="44" x2="118" y2="70" />
			<line x1="150" y1="50" x2="130" y2="74" />
		</g>
		<!-- leaf -->
		<g transform="translate(40 52)">
			<path d="M0 46 C 10 10, 70 -4, 120 2 C 112 46, 60 70, 0 46 Z" fill={accent} opacity="0.92" />
			<path
				d="M2 45 C 36 36, 72 22, 112 6"
				fill="none"
				stroke="#fff"
				stroke-opacity="0.6"
				stroke-width="1.6"
			/>
			<g stroke="#fff" stroke-opacity="0.4" stroke-width="1.2" fill="none">
				<path d="M30 37 c 6 -10, 10 -16, 14 -24" />
				<path d="M54 29 c 4 -10, 6 -16, 8 -22" />
				<path d="M78 20 c 1 -8, 1 -12, 0 -16" />
			</g>
		</g>
		<!-- molecules -->
		<g font-family="var(--font-sans)" font-size="9" font-weight="600">
			<g transform="translate(20 28)">
				<circle r="8" fill="#5b5b5b" />
				<circle cx="-11" cy="0" r="5.5" fill="#e5484d" />
				<circle cx="11" cy="0" r="5.5" fill="#e5484d" />
			</g>
			<g transform="translate(176 92)">
				<circle cx="-7" cy="0" r="6.5" fill="#e5484d" />
				<circle cx="7" cy="0" r="6.5" fill="#e5484d" />
			</g>
		</g>
	{:else if slug === 'epidemics'}
		<!-- a crowd with an outbreak spreading from the left, and its curve -->
		{#each crowd as p (p.k)}
			<circle cx={p.x} cy={p.y} r="3.4" fill="var(--sir-{p.s})" />
		{/each}
		<path
			d="M108 104 C 128 104, 134 40, 148 40 S 168 102, 192 104"
			fill="none"
			stroke="var(--sir-i)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path
			d="M108 30 C 132 30, 140 92, 156 98 S 180 100, 192 100"
			fill="none"
			stroke="var(--sir-s)"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity="0.8"
		/>
	{:else if slug === 'unit-circle'}
		<!-- a unit circle with its point, linked to the sine wave it traces -->
		<g transform="translate(48 62)">
			<line x1="-36" x2="36" y1="0" y2="0" stroke="currentColor" opacity="0.25" />
			<line x1="0" x2="0" y1="-36" y2="36" stroke="currentColor" opacity="0.25" />
			<circle r="30" fill="none" stroke={accent} stroke-width="2" />
			<line x1="0" y1="0" x2="21.2" y2="-21.2" stroke={accent} stroke-width="2" />
			<line x1="0" y1="0" x2="21.2" y2="0" stroke="var(--trig-cos)" stroke-width="3" />
			<line x1="21.2" y1="0" x2="21.2" y2="-21.2" stroke="var(--trig-sin)" stroke-width="3" />
			<circle cx="21.2" cy="-21.2" r="4" fill={accent} />
		</g>
		<line
			x1="69"
			y1="40.8"
			x2="107.3"
			y2="40.8"
			stroke={accent}
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
		<path
			d={sineArt}
			fill="none"
			stroke="var(--trig-sin)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<circle cx="107.3" cy="40.8" r="3.5" fill="var(--trig-sin)" />
	{:else if slug === 'sorting'}
		<!-- bars half sorted: sorted (green) on the right, two being compared -->
		{#each sortArt as b (b.i)}
			<rect
				x={30 + b.i * 15}
				y={104 - b.h}
				width="11"
				height={b.h}
				rx="2.5"
				fill={b.c}
				opacity={b.c === accent ? 0.35 : 1}
			/>
		{/each}
		<line x1="24" x2="176" y1="104.5" y2="104.5" stroke="currentColor" opacity="0.25" />
	{:else if slug === 'newtons-laws'}
		<!-- a projectile's parabola over the ground, with its two velocity parts -->
		<line x1="16" x2="186" y1="100" y2="100" stroke="currentColor" opacity="0.3" />
		<path
			d={parabolaArt}
			fill="none"
			stroke={accent}
			stroke-width="2.2"
			stroke-dasharray="4 4"
			stroke-linecap="round"
		/>
		<circle cx="76" cy="38" r="6" fill={accent} />
		<line x1="76" y1="38" x2="104" y2="38" stroke="var(--mech-velocity)" stroke-width="2.5" />
		<path d="M104 34 L111 38 L104 42 Z" fill="var(--mech-velocity)" />
		<line x1="76" y1="38" x2="76" y2="58" stroke="var(--mech-force)" stroke-width="2.5" />
		<path d="M72 58 L76 65 L80 58 Z" fill="var(--mech-force)" />
		<rect x="140" y="84" width="34" height="16" rx="3" fill="var(--mech-cart)" />
		<circle cx="148" cy="101" r="3.5" fill="currentColor" opacity="0.6" />
		<circle cx="166" cy="101" r="3.5" fill="currentColor" opacity="0.6" />
	{:else if slug === 'electric-circuits'}
		<!-- a battery, a loop of wire full of charges and a glowing bulb -->
		<defs>
			<radialGradient id="art-glow-electric-circuits">
				<stop offset="0" stop-color="var(--circ-glow)" stop-opacity="0.9" />
				<stop offset="0.5" stop-color="var(--circ-glow)" stop-opacity="0.35" />
				<stop offset="1" stop-color="var(--circ-glow)" stop-opacity="0" />
			</radialGradient>
		</defs>
		<path
			d="M44 56 L44 36 Q44 24 56 24 L144 24 Q156 24 156 36 L156 86 Q156 98 144 98 L56 98 Q44 98 44 86 L44 65"
			fill="none"
			stroke="var(--circ-wire)"
			stroke-width="2.4"
		/>
		{#each [70, 92, 114, 136, 66, 90, 114, 138] as x, i (i)}
			<circle cx={x} cy={i < 4 ? 24 : 98} r="3.2" fill={accent} />
		{/each}
		<!-- battery on the left side: + (long plate) above − -->
		<line
			x1="33"
			y1="56"
			x2="55"
			y2="56"
			stroke="var(--circ-battery)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<line
			x1="39"
			y1="65"
			x2="49"
			y2="65"
			stroke="var(--circ-battery)"
			stroke-width="4.5"
			stroke-linecap="round"
		/>
		<!-- bulb on the right side, lit -->
		<circle cx="156" cy="61" r="30" fill="url(#art-glow-electric-circuits)" />
		<circle
			cx="156"
			cy="61"
			r="11"
			fill="var(--circ-glow)"
			stroke="var(--circ-wire)"
			stroke-width="2"
		/>
		<path
			d="M156 50 L156 56 l-4 3 l4 3 l4 -3 l-4 -3"
			fill="none"
			stroke={accent}
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
	{:else if slug === 'learning-from-data'}
		<!-- noisy points, a sensible fit and an overfit wiggle -->
		<line x1="18" x2="184" y1="104" y2="104" stroke="currentColor" opacity="0.25" />
		<path d={fitArt.smooth} fill="none" stroke="var(--fit-model)" stroke-width="2.4" />
		<path
			d={fitArt.wiggle}
			fill="none"
			stroke="var(--fit-test)"
			stroke-width="1.4"
			opacity="0.6"
			stroke-dasharray="3 3"
		/>
		{#each fitArt.points as p, i (i)}
			<circle cx={p.x} cy={p.y} r="3.4" fill="var(--fit-train)" />
		{/each}
	{:else if slug === 'pagerank'}
		<!-- a little web: pages sized by rank, links as arrows between them -->
		<g stroke="currentColor" stroke-width="1.5" opacity="0.45" fill="none" stroke-linecap="round">
			{#each rankArt.links as l (l.d)}
				<path d={l.d} />
			{/each}
		</g>
		<g fill="currentColor" opacity="0.45">
			{#each rankArt.links as l (l.d)}
				<path d={l.head} />
			{/each}
		</g>
		{#each rankArt.pages as p (p.x)}
			<circle
				cx={p.x}
				cy={p.y}
				r={p.r}
				fill={accent}
				fill-opacity="0.2"
				stroke={accent}
				stroke-width="2"
			/>
		{/each}
	{:else if slug === 'bridges-structures'}
		<!-- a truss over a gap: top chord and end posts pushed (red), bottom chord and
		     diagonals pulled (blue), a truck on the deck -->
		<path d="M0 72 H44 V120 H0 Z" fill="var(--struct-ground)" />
		<path d="M156 72 H200 V120 H156 Z" fill="var(--struct-ground)" />
		<path
			d="M0 72 H44 V120 M156 120 V72 H200"
			fill="none"
			stroke="var(--struct-ground-edge)"
			stroke-width="1.5"
		/>
		<g stroke-linecap="round" stroke-width="2">
			{#each [72, 100, 128] as x (x)}
				<line x1={x} y1="44" x2={x} y2="72" stroke="var(--struct-steel)" />
			{/each}
			<line x1="72" y1="44" x2="100" y2="72" stroke="var(--struct-tension)" />
			<line x1="128" y1="44" x2="100" y2="72" stroke="var(--struct-tension)" />
			<line x1="44" y1="72" x2="72" y2="44" stroke="var(--struct-compression)" stroke-width="3" />
			<line x1="156" y1="72" x2="128" y2="44" stroke="var(--struct-compression)" stroke-width="3" />
			<line x1="72" y1="44" x2="128" y2="44" stroke="var(--struct-compression)" stroke-width="3" />
			<line x1="44" y1="72" x2="156" y2="72" stroke="var(--struct-tension)" stroke-width="3" />
		</g>
		<rect x="82" y="59" width="24" height="9" rx="2" fill={accent} />
		<circle cx="88" cy="69" r="2.6" fill="var(--struct-road)" />
		<circle cx="100" cy="69" r="2.6" fill="var(--struct-road)" />
	{:else if slug === 'binary'}
		<!-- a byte, 0100 0001, and two of its readings: 65 and "A" -->
		{#each [0, 1, 0, 0, 0, 0, 0, 1] as b, i (i)}
			<rect
				x={15 + i * 21 + (i >= 4 ? 6 : 0)}
				y="22"
				width="17"
				height="17"
				rx="3.5"
				fill={b ? accent : 'none'}
				stroke={b ? 'none' : 'currentColor'}
				stroke-opacity="0.3"
			/>
		{/each}
		<path
			d="M100 48 V58 M60 70 L100 58 L140 70"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.3"
			stroke-width="1.5"
		/>
		<text x="60" y="94" text-anchor="middle" font-size="20" font-weight="700" fill={accent}>65</text
		>
		<rect
			x="125"
			y="74"
			width="30"
			height="30"
			rx="5"
			fill="none"
			stroke={accent}
			stroke-width="1.6"
		/>
		<text x="140" y="96" text-anchor="middle" font-size="19" font-weight="700" fill={accent}>A</text
		>
	{:else if slug === 'atmosphere-weather'}
		<!-- a globe lit from the left: trade winds and westerlies curving round it -->
		{#each [36, 48, 60, 72, 84] as y (y)}
			<line x1="18" x2="54" y1={y} y2={y} stroke="var(--atm-sun)" stroke-width="2" opacity="0.7" />
		{/each}
		<circle
			cx="104"
			cy="60"
			r="44"
			fill={accent}
			fill-opacity="0.1"
			stroke={accent}
			stroke-width="1.6"
		/>
		<line x1="60" x2="148" y1="60" y2="60" stroke="currentColor" opacity="0.35" />
		{#each [38, 82] as y (y)}
			<line
				x1="66"
				x2="142"
				y1={y}
				y2={y}
				stroke="currentColor"
				opacity="0.2"
				stroke-dasharray="2 3"
			/>
		{/each}
		{#each [1, -1] as h (h)}
			<!-- westerlies (towards the east) near 45° -->
			<path
				d="M80 {60 - h * 30} Q104 {60 - h * 24} 126 {60 - h * 31}"
				fill="none"
				stroke={accent}
				stroke-width="2.2"
				stroke-linecap="round"
			/>
			<path d="M126 {60 - h * 35} L133 {60 - h * 32} L125 {60 - h * 27} Z" fill={accent} />
			<!-- trade winds (from the east, slanting towards the equator) near 15° -->
			<path
				d="M134 {60 - h * 16} Q106 {60 - h * 14} 80 {60 - h * 6}"
				fill="none"
				stroke={accent}
				stroke-width="2.2"
				stroke-linecap="round"
			/>
			<path d="M81 {60 - h * 2} L74 {60 - h * 4} L80 {60 - h * 10} Z" fill={accent} />
		{/each}
		<!-- warm tropics, heat carried polewards -->
		<path
			d="M164 52 Q172 38 168 24"
			fill="none"
			stroke="var(--atm-warm)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path d="M164 25 L168 18 L172 26 Z" fill="var(--atm-warm)" />
		<path
			d="M164 68 Q172 82 168 96"
			fill="none"
			stroke="var(--atm-warm)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path d="M164 95 L168 102 L172 94 Z" fill="var(--atm-warm)" />
	{:else if slug === 'graph-search'}
		<!-- a small grid: a wall, the shaded ripple of the search, its frontier and the route -->
		{#each gridArt as g (g.i)}
			<rect
				x={g.x}
				y={g.y}
				width="14"
				height="14"
				style:fill={g.kind === 'wall'
					? 'var(--gs-wall)'
					: g.kind === 'seen'
						? `color-mix(in srgb, var(--gs-visited-far) ${g.shade}%, var(--gs-visited))`
						: g.kind === 'edge'
							? 'var(--gs-frontier)'
							: 'var(--gs-ground)'}
				stroke="currentColor"
				stroke-opacity="0.12"
			/>
		{/each}
		<path
			d="M51 59 V31 H121 V59 H149"
			fill="none"
			stroke={accent}
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<circle cx="51" cy="59" r="5.5" fill="var(--gs-start)" />
		<circle cx="149" cy="59" r="5.5" fill="var(--gs-goal)" />
	{:else if slug === 'ecosystems'}
		<!-- rabbits and foxes rising and falling in turn, over a strip of grass -->
		<rect x="0" y="96" width="200" height="24" fill={accent} opacity="0.22" />
		<path
			d={ecoArt.predator}
			fill="none"
			stroke="var(--eco-predator)"
			stroke-width="1.8"
			stroke-linecap="round"
			opacity="0.9"
		/>
		<path
			d={ecoArt.prey}
			fill="none"
			stroke="var(--eco-prey)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path d={rabbitIcon} transform="translate(64 104) scale(1.3)" fill="var(--eco-prey)" />
		<path d={foxIcon} transform="translate(140 104) scale(-1.3 1.3)" fill="var(--eco-predator)" />
	{:else if slug === 'chaos-fractals'}
		<!-- the Mandelbrot set: a soft fringe round the silhouette, the antenna to −2 -->
		<g fill="none" stroke={accent} stroke-linejoin="round" opacity="0.22" stroke-width="7">
			<path d={mandelArt.cardioid} />
			{#each mandelArt.bulbs as b, i (i)}
				<circle cx={b.x} cy={b.y} r={b.r} />
			{/each}
		</g>
		<line
			x1={mandelArt.tip}
			x2={mandelArt.neck}
			y1="60"
			y2="60"
			stroke={accent}
			stroke-width="1.5"
			stroke-linecap="round"
		/>
		<path d={mandelArt.cardioid} fill={accent} />
		{#each mandelArt.bulbs as b, i (i)}
			<circle cx={b.x} cy={b.y} r={b.r} fill={accent} />
		{/each}
	{:else if slug === 'orbits-kepler'}
		<!-- a star at one focus of an ellipse (c = √(70² − 48²) ≈ 51), a planet on the ellipse -->
		<ellipse
			cx="100"
			cy="60"
			rx="70"
			ry="48"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.4"
		/>
		<circle cx="49" cy="60" r="16" fill={accent} opacity="0.2" />
		<circle cx="49" cy="60" r="10" fill={accent} />
		<circle cx="157.8" cy="32.9" r="6" fill="var(--orb-planet)" />
	{:else if slug === 'bayes-theorem'}
		<!-- a crowd tested: few of the positives (outlined) are truly ill -->
		<path d={bayesArt.tn} fill="currentColor" opacity="0.2" />
		<path d={bayesArt.fp} fill="var(--bay-fp)" />
		<path d={bayesArt.tp} fill={accent} />
		<rect
			x="15"
			y="10"
			width="142"
			height="16"
			rx="3"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.7"
		/>
	{:else if slug === 'oscillations-resonance'}
		<!-- a mass on a spring and the wave it traces, dying away -->
		<line x1="18" x2="62" y1="16" y2="16" stroke="currentColor" stroke-width="2.5" opacity="0.5" />
		<path
			d={oscArt.coil}
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linejoin="round"
			opacity="0.6"
		/>
		<rect x="28" y="78" width="24" height="20" rx="4" fill={accent} />
		<line x1="70" x2="190" y1="62" y2="62" stroke="currentColor" opacity="0.25" />
		<line x1="54" x2="76" y1="88" y2="88" stroke={accent} stroke-dasharray="2 3" opacity="0.6" />
		<path d={oscArt.wave} fill="none" stroke={accent} stroke-width="2.4" stroke-linecap="round" />
	{:else if slug === 'logic-gates'}
		<!-- an AND gate: both inputs on, so the lamp lights -->
		<path
			d="M34 44 H76 M34 76 H76 M132 60 H160"
			fill="none"
			stroke={accent}
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx="30" cy="44" r="5" fill={accent} />
		<circle cx="30" cy="76" r="5" fill={accent} />
		<path
			d="M76 30 H102 A30 30 0 0 1 102 90 H76 Z"
			fill={accent}
			fill-opacity="0.15"
			stroke="currentColor"
			stroke-opacity="0.7"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
		<circle cx="170" cy="60" r="17" fill={accent} opacity="0.2" />
		<circle cx="170" cy="60" r="10" fill={accent} />
	{:else if slug === 'central-limit-theorem'}
		<!-- pins over a bell-shaped histogram, with the normal curve -->
		{#each cltArt.pins as p (p.id)}
			<circle cx={p.x} cy={p.y} r="2" fill="currentColor" opacity="0.45" />
		{/each}
		<circle cx="112" cy="21" r="3" fill={accent} />
		{#each cltArt.bars as b (b.k)}
			<rect x={b.x} y={b.y} width="8" height={b.h} rx="1.5" fill={accent} opacity="0.35" />
		{/each}
		<line
			x1="38"
			x2="162"
			y1="108"
			y2="108"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.4"
		/>
		<path d={cltArt.curve} fill="none" stroke={accent} stroke-width="2" stroke-linecap="round" />
	{:else if slug === 'atoms-periodic-table'}
		<!-- a packed nucleus in a soft electron cloud: dots, not orbits -->
		<defs>
			<radialGradient id="art-atom-cloud">
				<stop offset="0" stop-color={accent} stop-opacity="0.22" />
				<stop offset="0.6" stop-color={accent} stop-opacity="0.1" />
				<stop offset="1" stop-color={accent} stop-opacity="0" />
			</radialGradient>
		</defs>
		<ellipse cx="100" cy="60" rx="78" ry="56" fill="url(#art-atom-cloud)" />
		{#each atomArt.dots as d (d.i)}
			<circle cx={d.x} cy={d.y} r="2" fill="currentColor" opacity="0.5" />
		{/each}
		{#each atomArt.nucleons as n (n.i)}
			<circle
				cx={n.x}
				cy={n.y}
				r="4.6"
				fill={n.p ? accent : 'currentColor'}
				fill-opacity={n.p ? 1 : 0.4}
				stroke="var(--surface)"
				stroke-width="0.8"
			/>
		{/each}
	{:else if slug === 'chemical-bonds'}
		<!-- a bent water molecule: two bonds, two lone-pair lobes, δ− oxygen and δ+ hydrogens -->
		{#each [-1, 1] as k (k)}
			<ellipse
				cx={100 + k * 13}
				cy="34"
				rx="9"
				ry="16"
				transform="rotate({k * 28} {100 + k * 13} 34)"
				fill={accent}
				fill-opacity="0.18"
				stroke={accent}
				stroke-opacity="0.5"
			/>
			<line
				x1="100"
				y1="62"
				x2={100 + k * 40}
				y2="93"
				stroke="currentColor"
				stroke-opacity="0.45"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<circle
				cx={100 + k * 40}
				cy="93"
				r="11"
				fill="var(--surface)"
				stroke="currentColor"
				stroke-opacity="0.5"
				stroke-width="1.5"
			/>
			<text
				x={100 + k * 40}
				y="97"
				text-anchor="middle"
				font-size="11"
				font-weight="700"
				fill="currentColor">H</text
			>
		{/each}
		<circle cx="100" cy="62" r="18" fill="#e5484d" stroke="var(--surface)" stroke-width="1.5" />
		<text x="100" y="67" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">O</text>
	{:else if slug === 'error-correction'}
		<!-- three overlapping parity circles; one flipped bit where two of them fail -->
		{#each [{ x: 82, y: 50, bad: true }, { x: 118, y: 50, bad: false }, { x: 100, y: 81, bad: true }] as c (c.x + c.y)}
			<circle
				cx={c.x}
				cy={c.y}
				r="34"
				fill={accent}
				fill-opacity="0.08"
				stroke={c.bad ? accent : 'currentColor'}
				stroke-opacity={c.bad ? 1 : 0.45}
				stroke-width="2"
			/>
		{/each}
		{#each [{ x: 66, y: 42, on: 0 }, { x: 134, y: 42, on: 1 }, { x: 100, y: 38, on: 1 }, { x: 100, y: 100, on: 0 }, { x: 118, y: 72, on: 1 }, { x: 100, y: 62, on: 1 }] as b (b.x * 1000 + b.y)}
			<circle
				cx={b.x}
				cy={b.y}
				r="6"
				fill={b.on ? 'currentColor' : 'none'}
				fill-opacity="0.55"
				stroke="currentColor"
				stroke-opacity="0.55"
				stroke-width="1.5"
			/>
		{/each}
		<circle
			cx="82"
			cy="72"
			r="10"
			fill="none"
			stroke={accent}
			stroke-width="2"
			stroke-dasharray="3 2"
		/>
		<circle cx="82" cy="72" r="6" fill={accent} />
	{:else if slug === 'entropy'}
		<!-- a box of fast (hot) and slow (cold) particles, the wall between them lifting -->
		<rect
			x="28"
			y="18"
			width="144"
			height="86"
			rx="6"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.45"
		/>
		<line
			x1="100"
			x2="100"
			y1="18"
			y2="62"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.4"
		/>
		{#each [[44, 34, 8, -6], [62, 52, 9, 4], [48, 80, -7, 7], [80, 30, 6, 6], [74, 70, 9, -3], [88, 92, -8, -5], [58, 96, 8, 0], [108, 84, 9, -4]] as [x, y, dx, dy], i (i)}
			<line
				x1={x - dx * 1.6}
				y1={y - dy * 1.6}
				x2={x}
				y2={y}
				stroke={accent}
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.35"
			/>
			<circle cx={x} cy={y} r="4" fill={accent} />
		{/each}
		{#each [[122, 32], [146, 44], [130, 62], [156, 74], [118, 52], [140, 92], [160, 30], [124, 96]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="4" fill="currentColor" opacity="0.4" />
		{/each}
	{:else if slug === 'internet'}
		<!-- a small mesh of routers, packets taking two routes between two computers -->
		<path
			d="M22 60 H52 L92 28 L140 34 L178 60 M52 60 L92 92 L140 86 L178 60 M92 28 L92 92 M140 34 L140 86 M92 28 L140 86"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
			opacity="0.3"
		/>
		{#each [[52, 60], [92, 28], [92, 92], [140, 34], [140, 86]] as [x, y] (`${x},${y}`)}
			<circle
				cx={x}
				cy={y}
				r="7"
				fill="var(--surface)"
				stroke="currentColor"
				stroke-width="1.8"
				opacity="0.8"
			/>
		{/each}
		<rect x="10" y="52" width="16" height="16" rx="3" fill="currentColor" opacity="0.55" />
		<rect x="174" y="52" width="16" height="16" rx="3" fill="currentColor" opacity="0.55" />
		<rect x="66" y="38" width="12" height="8" rx="2" fill={accent} transform="rotate(-38 72 42)" />
		<rect x="110" y="26" width="12" height="8" rx="2" fill={accent} transform="rotate(7 116 30)" />
		<rect x="110" y="84" width="12" height="8" rx="2" fill={accent} transform="rotate(-7 116 88)" />
		<rect
			x="153"
			y="68"
			width="12"
			height="8"
			rx="2"
			fill={accent}
			transform="rotate(-34 159 72)"
		/>
	{:else if slug === 'primes-modular-arithmetic'}
		<!-- a 5 × 4 grid of 1–20 with the primes marked, beside a 7-hour clock with the powers of 3 -->
		{#each Array.from({ length: 20 }, (_, i) => i + 1) as n (n)}
			{@const prime = [2, 3, 5, 7, 11, 13, 17, 19].includes(n)}
			<rect
				x={14 + ((n - 1) % 5) * 18}
				y={22 + Math.floor((n - 1) / 5) * 20}
				width="14"
				height="16"
				rx="3"
				fill={prime ? accent : 'currentColor'}
				opacity={prime ? 0.9 : n === 1 ? 0.12 : 0.22}
			/>
		{/each}
		<circle
			cx="150"
			cy="60"
			r="36"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.35"
			stroke-width="2"
		/>
		{#each [0, 1, 2, 3, 4, 5, 6] as h (h)}
			<circle
				cx={150 + 36 * Math.sin((2 * Math.PI * h) / 7)}
				cy={60 - 36 * Math.cos((2 * Math.PI * h) / 7)}
				r="3"
				fill={h === 0 ? 'currentColor' : accent}
				opacity={h === 0 ? 0.4 : 1}
			/>
		{/each}
		<path
			d={[1, 3, 2, 6, 4, 5, 1]
				.map(
					(h, i) =>
						`${i ? 'L' : 'M'}${(150 + 36 * Math.sin((2 * Math.PI * h) / 7)).toFixed(1)} ${(60 - 36 * Math.cos((2 * Math.PI * h) / 7)).toFixed(1)}`
				)
				.join(' ')}
			fill="none"
			stroke={accent}
			stroke-width="1.8"
			stroke-linejoin="round"
		/>
	{:else if slug === 'complex-numbers'}
		<!-- the complex plane: z, w and their product zw (lengths multiply, angles add) -->
		<path d="M44 66 H156 M100 18 V112" stroke="currentColor" stroke-width="1.5" opacity="0.4" />
		<circle
			cx="100"
			cy="66"
			r="34"
			fill="none"
			stroke="currentColor"
			stroke-dasharray="2 3"
			opacity="0.5"
		/>
		<path d="M114 66 A14 14 0 0 0 104.8 52.8" fill="none" stroke={accent} stroke-width="2" />
		<path
			d="M100 66 L137.6 52.3 M100 66 L126.4 34.6"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			opacity="0.6"
		/>
		<circle cx="137.6" cy="52.3" r="4" fill="currentColor" opacity="0.6" />
		<circle cx="126.4" cy="34.6" r="4" fill="currentColor" opacity="0.6" />
		<path d="M100 66 L116.4 20.9" stroke={accent} stroke-width="3" stroke-linecap="round" />
		<circle cx="116.4" cy="20.9" r="5.5" fill={accent} />
	{:else if slug === 'electromagnetism'}
		<!-- a + and a − charge with the field lines running between them -->
		{#each [-34, -16, 0, 16, 34] as k (k)}
			<path
				d="M62 {60 + Math.sign(k) * 4} Q100 {60 + k * 1.6} 138 {60 + Math.sign(k) * 4}"
				fill="none"
				stroke={accent}
				stroke-width="1.6"
				opacity={k === 0 ? 0.9 : 0.6}
			/>
		{/each}
		<path d="M48 60 H18 M152 60 H182" stroke={accent} stroke-width="1.6" opacity="0.4" />
		<circle cx="56" cy="60" r="12" fill="var(--em-plus)" />
		<circle cx="144" cy="60" r="12" fill="var(--em-minus)" />
		<path d="M50 60 H62 M56 54 V66 M138 60 H150" stroke="#fff" stroke-width="2.4" />
	{:else if slug === 'heart-circulation'}
		<!-- a heart, its blue right side and red left side, over an ECG trace -->
		<path
			d="M70 30 C52 14 24 22 26 46 C28 66 50 82 70 98 C90 82 112 66 114 46 C116 22 88 14 70 30 Z"
			fill="currentColor"
			fill-opacity="0.12"
			stroke="currentColor"
			stroke-opacity="0.5"
			stroke-width="2"
		/>
		<path d="M40 44 C40 34 60 34 64 42 L64 80 C54 72 42 62 40 50 Z" fill="var(--hc-deoxy)" />
		<path d="M76 42 C80 34 100 34 100 44 L100 50 C98 62 86 72 76 80 Z" fill={accent} />
		<path
			d="M120 74 H136 L140 70 L144 74 H150 L154 80 L160 34 L166 88 L170 74 H180 L186 66 L192 74 H196"
			fill="none"
			stroke={accent}
			stroke-width="2.2"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{:else if slug === 'homeostasis'}
		<!-- a feedback loop beside a glucose curve that rises after a meal and comes back, with insulin below -->
		<g transform="translate(50 60)">
			<path
				d="M0 -30 A30 30 0 1 1 -26 15"
				fill="none"
				stroke={accent}
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d="M-33 6 L-26 17 L-15 10"
				fill="none"
				stroke={accent}
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<circle cx="0" cy="0" r="7" fill="var(--hm-insulin)" />
		</g>
		<rect x="100" y="64" width="92" height="16" fill="var(--hm-glucagon)" opacity="0.15" />
		<path
			d="M100 72 C 112 72, 116 30, 128 30 S 146 62, 160 70 S 180 72, 192 72"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path
			d="M100 104 C 114 104, 120 84, 132 84 S 148 102, 162 103 S 182 104, 192 104"
			fill="none"
			stroke="var(--hm-insulin)"
			stroke-width="1.8"
			stroke-linecap="round"
		/>
	{:else if slug === 'reinforcement-learning'}
		<!-- a small grid world: squares shaded by learnt value, a route of arrows to the reward -->
		{#each [0, 1, 2, 3, 4, 5] as c (c)}
			{#each [0, 1, 2] as r (r)}
				<rect
					x={37 + c * 21}
					y={28 + r * 21}
					width="20"
					height="20"
					rx="2"
					fill={c === 5 && r === 1 ? accent : c === 2 && r === 2 ? 'var(--rl-pit)' : 'currentColor'}
					fill-opacity={c === 5 && r === 1
						? 1
						: c === 2 && r === 2
							? 0.85
							: 0.06 + 0.07 * Math.max(0, c - Math.abs(r - 1))}
				/>
			{/each}
		{/each}
		<path
			d="M47 59 H66 M68 59 l-4 -4 M68 59 l-4 4 M89 59 H108 M110 59 l-4 -4 M110 59 l-4 4 M131 59 H150 M152 59 l-4 -4 M152 59 l-4 4"
			stroke={accent}
			stroke-width="2"
			stroke-linecap="round"
			fill="none"
		/>
		<circle cx="47" cy="59" r="5" fill={accent} />
	{:else if slug === 'fourier-transform'}
		<!-- a 1 Hz circle carrying a 3 Hz circle; the last point's height traces a near-square wave -->
		<circle
			cx="50"
			cy="60"
			r={fourierArt.r1}
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.45"
		/>
		<circle
			cx={fourierArt.c2.x}
			cy={fourierArt.c2.y}
			r={fourierArt.r3}
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.45"
		/>
		<path
			d="M50 60 L{fourierArt.c2.x} {fourierArt.c2.y} L{fourierArt.tip.x} {fourierArt.tip.y}"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			opacity="0.7"
		/>
		<path
			d="M{fourierArt.tip.x} {fourierArt.tip.y} H110"
			stroke={accent}
			stroke-dasharray="2 3"
			opacity="0.7"
		/>
		<path
			d={fourierArt.wave}
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linejoin="round"
		/>
		<circle cx={fourierArt.tip.x} cy={fourierArt.tip.y} r="4" fill={accent} />
	{:else if slug === 'motors-generators'}
		<!-- a coil seen end-on between two magnet poles, turning anticlockwise -->
		<path d="M18 22 H52 V40 Q42 60 52 80 V98 H18 Z" fill="var(--em-north)" opacity="0.85" />
		<path d="M182 22 H148 V40 Q158 60 148 80 V98 H182 Z" fill="var(--em-south)" opacity="0.85" />
		<text x="31" y="65" fill="#fff" font-size="14" font-weight="800">N</text>
		<text x="160" y="65" fill="#fff" font-size="14" font-weight="800">S</text>
		{#each [40, 50, 60, 70, 80] as y (y)}
			<path d="M60 {y} H140" stroke={accent} stroke-width="1" opacity="0.3" />
		{/each}
		<path d="M82 92 L118 28" stroke={accent} stroke-width="3" stroke-linecap="round" />
		<circle cx="82" cy="92" r="7" fill={accent} />
		<circle cx="118" cy="28" r="7" fill={accent} />
		<path
			d="M96 97 A36 36 0 0 0 130 66"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			opacity="0.6"
		/>
		<path d="M131 60 l3 10 l-9 -3 z" fill="currentColor" opacity="0.6" />
	{:else if slug === 'ocean-currents'}
		<!-- an ocean basin: a warm gyre squeezed against the west, a cold gyre north of it -->
		<rect
			x="34"
			y="12"
			width="132"
			height="96"
			rx="6"
			fill={accent}
			fill-opacity="0.08"
			stroke={accent}
			stroke-opacity="0.5"
		/>
		{#each [0, 1, 2] as k (k)}
			{@const x0 = 40 + k * 3}
			{@const w = 112 - k * 34}
			{@const g = [
				{ cy: 78, h: 22 - k * 7, c: 'var(--oc-warm)' },
				{ cy: 36, h: 15 - k * 5, c: 'var(--oc-cold)' }
			]}
			{#each g as l (l.cy)}
				<path
					d="M{x0} {l.cy} C{x0} {l.cy - l.h} {x0 + 6} {l.cy - l.h} {x0 + w * 0.22} {l.cy -
						l.h} C{x0 + w} {l.cy - l.h} {x0 + w} {l.cy + l.h} {x0 + w * 0.22} {l.cy + l.h} C{x0 +
						6} {l.cy + l.h} {x0} {l.cy + l.h} {x0} {l.cy} Z"
					fill="none"
					stroke={l.c}
					stroke-width={k === 0 ? 2 : 1.5}
					opacity={0.9 - k * 0.2}
				/>
			{/each}
		{/each}
		<path d="M36 74 L40 66 L44 74 Z" fill="var(--oc-warm)" />
	{:else if slug === 'waves-interference'}
		<!-- two sources in a ripple tank: their crests cross in bands -->
		{#each waveArt as a (a.id)}
			<path d={a.d} fill="none" stroke={accent} stroke-width="1.6" opacity={a.o} />
		{/each}
		<circle cx="40" cy="44" r="4.5" fill="currentColor" opacity="0.75" />
		<circle cx="40" cy="76" r="4.5" fill="currentColor" opacity="0.75" />
	{:else if slug === 'radioactivity'}
		<!-- a grid of nuclei, some decayed, beside the halving curve -->
		{#each radArt.cells as c (c.k)}
			<rect
				x={c.x}
				y={c.y}
				width="7"
				height="7"
				rx="1.5"
				fill={c.on ? 'var(--rad-parent)' : 'var(--rad-daughter)'}
			/>
		{/each}
		<path d={radArt.curve} fill="none" stroke={accent} stroke-width="2.4" stroke-linecap="round" />
		{#each [1, 2, 3] as h (h)}
			<circle cx={112 + h * 20} cy={104 - 80 / 2 ** h} r="2.6" fill={accent} />
		{/each}
	{:else if slug === 'linear-transformations'}
		<!-- the square grid, the same grid moved by a matrix, and where î and ĵ landed -->
		<path d={linearArt.square} stroke="currentColor" stroke-width="1" opacity="0.18" fill="none" />
		<path d={linearArt.moved} stroke={accent} stroke-width="1.2" opacity="0.55" fill="none" />
		<path d={linearArt.unit} fill={accent} fill-opacity="0.18" />
		{#each linearArt.arrows as a (a.c)}
			<path d="M100 60 L{a.x} {a.y}" stroke={a.c} stroke-width="3" stroke-linecap="round" />
			<circle cx={a.x} cy={a.y} r="4" fill={a.c} />
		{/each}
	{:else if slug === 'cpu'}
		<!-- a chip with its pins, and the fetch → decode → execute cycle going round inside it -->
		{#each [0, 1, 2, 3, 4] as i (i)}
			<path
				d="M{72 + i * 14} 18 V26 M{72 + i * 14} 94 V102 M58 {32 + i * 14} H66 M134 {32 +
					i * 14} H142"
				stroke="currentColor"
				stroke-opacity="0.45"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		{/each}
		<rect
			x="66"
			y="26"
			width="68"
			height="68"
			rx="7"
			fill={accent}
			fill-opacity="0.12"
			stroke="currentColor"
			stroke-opacity="0.7"
			stroke-width="2"
		/>
		<path
			d="M106.2 41 A20 20 0 0 1 119.6 64.2 M113.4 74.9 A20 20 0 0 1 86.6 74.9 M80.4 64.2 A20 20 0 0 1 93.8 41"
			fill="none"
			stroke={accent}
			stroke-width="2.5"
		/>
		<path
			d="M119 67.1 L122.9 62.8 L117.1 61.6 Z M84.4 72.9 L86.1 78.4 L90.1 74 Z M96.7 40.1 L91 38.8 L92.8 44.5 Z"
			fill={accent}
		/>
		{#each [{ x: 100, y: 40 }, { x: 117.3, y: 70 }, { x: 82.7, y: 70 }] as d (d.x)}
			<circle cx={d.x} cy={d.y} r="4.5" fill={accent} />
		{/each}
	{:else if slug === 'cryptography'}
		<!-- a padlock beside an 8 × 8 grid of hash bits (a fixed pattern) -->
		<path
			d="M38 52 V40 a18 18 0 0 1 36 0 V52"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.45"
			stroke-width="5"
			stroke-linecap="round"
		/>
		<rect x="28" y="50" width="56" height="48" rx="7" fill={accent} />
		<circle cx="56" cy="69" r="6" fill="var(--surface)" />
		<rect x="53.5" y="71" width="5" height="14" rx="2" fill="var(--surface)" />
		{#each Array.from({ length: 64 }, (_, k) => k) as k (k)}
			{@const on = (k * 53 + 11) % 100 >= 50}
			<rect
				x={104 + (k % 8) * 10}
				y={22 + Math.floor(k / 8) * 10}
				width="8"
				height="8"
				rx="1.5"
				fill={on ? accent : 'currentColor'}
				opacity={on ? 0.9 : 0.16}
			/>
		{/each}
	{:else if slug === 'special-relativity'}
		<!-- a spacetime diagram: the platform's axes, the 45° light line and the train's
		     axes tilted towards it (β = 0.5), with ticks of the train's clock -->
		<line x1="60" y1="104" x2="60" y2="14" stroke="currentColor" opacity="0.45" />
		<line x1="60" y1="104" x2="176" y2="104" stroke="currentColor" opacity="0.45" />
		<line
			x1="60"
			y1="104"
			x2="150"
			y2="14"
			stroke="var(--rel-light)"
			stroke-width="2"
			stroke-dasharray="4 3"
		/>
		<line x1="60" y1="104" x2="105" y2="14" stroke={accent} stroke-width="2.4" />
		<line x1="60" y1="104" x2="176" y2="46" stroke={accent} stroke-width="2.4" />
		{#each [1, 2, 3] as k (k)}
			<circle cx={60 + k * 13.86} cy={104 - k * 27.71} r="3.2" fill={accent} />
			<line
				x1="60"
				x2={60 + k * 13.86}
				y1={104 - k * 27.71}
				y2={104 - k * 27.71}
				stroke="currentColor"
				opacity="0.25"
				stroke-dasharray="2 3"
			/>
		{/each}
		<rect x="24" y="22" width="22" height="14" rx="3" fill="var(--rel-car)" stroke={accent} />
		<path
			d="M28 33 L32 25 L36 33 L40 25"
			fill="none"
			stroke="var(--rel-light)"
			stroke-width="1.4"
		/>
	{:else if slug === 'semiconductors'}
		<!-- a silicon lattice with one phosphorus atom and its spare electron, beside two bands and a gap -->
		{#each [0, 1, 2] as r (r)}
			{#each [0, 1, 2] as c (c)}
				{#if c < 2}
					<line
						x1={28 + c * 30}
						y1={30 + r * 30}
						x2={58 + c * 30}
						y2={30 + r * 30}
						stroke="currentColor"
						stroke-opacity="0.35"
						stroke-width="2"
					/>
				{/if}
				{#if r < 2}
					<line
						x1={28 + c * 30}
						y1={30 + r * 30}
						x2={28 + c * 30}
						y2={60 + r * 30}
						stroke="currentColor"
						stroke-opacity="0.35"
						stroke-width="2"
					/>
				{/if}
			{/each}
		{/each}
		{#each [0, 1, 2] as r (r)}
			{#each [0, 1, 2] as c (c)}
				{@const p = r === 1 && c === 1}
				<circle
					cx={28 + c * 30}
					cy={30 + r * 30}
					r="9"
					fill={p ? '#2f9e44' : 'var(--surface)'}
					stroke={p ? '#2f9e44' : 'currentColor'}
					stroke-opacity={p ? 1 : 0.5}
					stroke-width="1.5"
				/>
			{/each}
		{/each}
		<circle cx="74" cy="46" r="4" fill={accent} />
		<rect
			x="128"
			y="18"
			width="46"
			height="26"
			rx="3"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.5"
		/>
		<rect
			x="128"
			y="76"
			width="46"
			height="26"
			rx="3"
			fill={accent}
			fill-opacity="0.35"
			stroke={accent}
		/>
		<circle cx="151" cy="36" r="3.5" fill={accent} />
		<path d="M118 44 V76" stroke="currentColor" stroke-opacity="0.5" marker-start="none" />
	{:else if slug === 'light-optics'}
		<!-- a beam of white light split by a prism into a fan of colours -->
		<path d="M18 74 L84 62" stroke="currentColor" stroke-width="2.4" opacity="0.6" />
		{#each opticsArt as r (r.c)}
			<path d="M84 62 L116 {r.y1} L184 {r.y2}" fill="none" stroke={r.c} stroke-width="2.2" />
		{/each}
		<path
			d="M100 22 L134 86 L66 86 Z"
			fill={accent}
			fill-opacity="0.16"
			stroke={accent}
			stroke-width="1.6"
			stroke-linejoin="round"
		/>
	{:else if slug === 'compression'}
		<!-- a small Huffman tree with 0/1 branches beside an 8 × 8 block of DCT coefficients, strong
		     at the top left (slow patterns) and fading towards the fast ones -->
		<path
			d="M52 26 L30 54 M52 26 L74 54 M74 54 L60 86 M74 54 L88 86"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.5"
			stroke-width="2"
		/>
		{#each [{ x: 52, y: 26 }, { x: 74, y: 54 }] as n (n.x)}
			<circle cx={n.x} cy={n.y} r="5" fill="currentColor" opacity="0.55" />
		{/each}
		{#each [{ x: 30, y: 54 }, { x: 60, y: 86 }, { x: 88, y: 86 }] as n (n.x)}
			<circle cx={n.x} cy={n.y} r="7" fill={accent} />
		{/each}
		{#each Array.from({ length: 64 }, (_, k) => k) as k (k)}
			{@const r = Math.floor(k / 8)}
			{@const c = k % 8}
			<rect
				x={112 + c * 9}
				y={24 + r * 9}
				width="7.5"
				height="7.5"
				rx="1.2"
				fill={r + c < 4 ? accent : 'currentColor'}
				opacity={r + c < 4 ? 0.95 - (r + c) * 0.18 : 0.12}
			/>
		{/each}
	{:else if slug === 'calculus'}
		<!-- rectangles under a rising curve, and the tangent at one point -->
		{#each calcArt.rects as r (r.x)}
			<rect
				x={r.x}
				y={r.y}
				width="26"
				height={104 - r.y}
				fill={accent}
				fill-opacity="0.16"
				stroke={accent}
				stroke-opacity="0.5"
			/>
		{/each}
		<line x1="18" x2="186" y1="104" y2="104" stroke="currentColor" opacity="0.35" />
		<path d={calcArt.curve} fill="none" stroke="var(--calc-curve)" stroke-width="2.6" />
		<line
			x1={calcArt.tangent.x - 40}
			y1={calcArt.tangent.y - 40 * calcArt.tangent.k}
			x2={calcArt.tangent.x + 40}
			y2={calcArt.tangent.y + 40 * calcArt.tangent.k}
			stroke="var(--calc-slope)"
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<circle cx={calcArt.tangent.x} cy={calcArt.tangent.y} r="4.5" fill={accent} />
	{:else if slug === 'states-of-matter'}
		<!-- a phase diagram (sublimation, boiling and melting lines meeting at the triple point),
		     with a crystal, a liquid and a gas in its three regions -->
		<path
			d="M28 108 Q66 98 88 74 Q122 52 162 28 M88 74 L98 14"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity="0.5"
		/>
		<circle cx="162" cy="28" r="3" fill="currentColor" opacity="0.5" />
		{#each [0, 1, 2] as r (r)}
			{#each [0, 1, 2, 3] as c (c)}
				<circle cx={36 + c * 10 + (r % 2) * 5} cy={34 + r * 9} r="4" fill={accent} />
			{/each}
		{/each}
		{#each [[108, 44], [116, 50], [107, 53], [117, 41], [125, 46], [114, 59]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="4" fill={accent} opacity="0.8" />
		{/each}
		{#each [[124, 96], [146, 104], [168, 84], [108, 108], [176, 106], [152, 72]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="4" fill={accent} opacity="0.55" />
		{/each}
	{:else if slug === 'black-holes'}
		<!-- a black hole with its photon sphere: one ray bent on its way past, one captured -->
		<circle
			cx="104"
			cy="62"
			r="21"
			fill="none"
			stroke={accent}
			stroke-width="1.4"
			stroke-dasharray="3 3"
			opacity="0.7"
		/>
		<circle cx="104" cy="62" r="14" fill="currentColor" opacity="0.85" />
		<path
			d="M14 30 L60 30 C86 30 104 32 124 40 C142 47 160 64 186 84"
			fill="none"
			stroke="var(--bh-light)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M14 52 L58 52 C78 52 96 48 110 48 C126 50 124 70 108 72"
			fill="none"
			stroke="var(--bh-light)"
			stroke-width="2"
			stroke-linecap="round"
			opacity="0.6"
		/>
		<path d="M14 30 H186" stroke="currentColor" stroke-dasharray="2 4" opacity="0.3" />
	{:else if slug === 'quantum-mechanics'}
		<!-- a wall with two slits, and the dots of single electrons piling up in fringes on a screen -->
		<path
			d="M70 14 V50 M70 56 V64 M70 70 V106"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.6"
		/>
		{#each [0, 1, 2, 3] as r (r)}
			<path
				d="M{78 + r * 18} {60 - 12 - r * 9} Q{86 + r * 22} 60 {78 + r * 18} {60 + 12 + r * 9}"
				fill="none"
				stroke={accent}
				stroke-width="1.4"
				opacity={0.6 - r * 0.12}
			/>
		{/each}
		<line
			x1="168"
			y1="12"
			x2="168"
			y2="108"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.5"
		/>
		{#each qmDots as d, i (i)}
			<circle cx={d.x} cy={d.y} r="1.7" fill={accent} />
		{/each}
		<path d="M24 60 H62" stroke={accent} stroke-width="2" stroke-linecap="round" />
		<circle cx="24" cy="60" r="4" fill={accent} />
	{:else if slug === 'acids-bases'}
		<!-- a titration curve (strong acid, strong base) beside a flask turning pink -->
		<path
			d="M88 100 C 120 99, 140 94, 148 86 L 152 34 C 158 26, 176 23, 192 22"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path d="M88 61 H192" stroke="currentColor" stroke-dasharray="2 4" opacity="0.35" />
		<path
			d="M38 22 V48 L18 92 Q16 100 24 100 H64 Q72 100 70 92 L50 48 V22"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linejoin="round"
			opacity="0.6"
		/>
		<path
			d="M27 74 H61 L69 92 Q70 98 64 98 H24 Q18 98 19 92 Z"
			fill="var(--ab-pink)"
			opacity="0.75"
		/>
		<circle cx="44" cy="12" r="3" fill="var(--ab-pink)" />
	{:else if slug === 'gradient-descent'}
		<!-- contour rings of a valley and a ball's trail of steps zigzagging down to the bottom -->
		{#each [14, 28, 42, 56, 70] as r, i (r)}
			<ellipse
				cx="112"
				cy="62"
				rx={r * 1.25}
				ry={r * 0.62}
				fill="none"
				stroke="currentColor"
				stroke-width="1.2"
				opacity={0.55 - i * 0.08}
				transform="rotate(-18 112 62)"
			/>
		{/each}
		<path
			d="M38 30 L70 64 L80 38 L98 70 L104 50 L110 63"
			fill="none"
			stroke={accent}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		{#each [[38, 30], [70, 64], [80, 38], [98, 70], [104, 50]] as [x, y] (x)}
			<circle cx={x} cy={y} r="2.6" fill={accent} />
		{/each}
		<circle cx="110" cy="63" r="5.5" fill={accent} />
	{:else if slug === 'embeddings'}
		<!-- clumps of word dots, and two parallel arrows: man → woman, king → queen -->
		{#each [[40, 34], [30, 52], [52, 46], [44, 60], [58, 30], [26, 40], [150, 84], [164, 92], [158, 76], [172, 80], [146, 98], [168, 102], [150, 28], [162, 22], [170, 36], [142, 40]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="3.2" fill={accent} opacity={0.35 + (i % 3) * 0.2} />
		{/each}
		<path
			d="M60 100 L104 90 M76 62 L120 52"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			opacity="0.75"
		/>
		<path
			d="M98 86 L106 89.6 L99.6 95 M114 48 L122 51.6 L115.6 57"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.75"
		/>
		<path
			d="M60 100 L76 62 M104 90 L120 52"
			stroke="currentColor"
			stroke-dasharray="2 3"
			opacity="0.4"
		/>
		{#each [[60, 100], [104, 90], [76, 62], [120, 52]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="4" fill={accent} />
		{/each}
	{:else if slug === 'carbon-cycle'}
		<!-- a cross-section: air above land and sea, a deep ocean much bigger than the air,
		     a two-way flow with plants and one with the sea surface, and a one-way arrow up
		     from buried fossil fuels -->
		<rect x="18" y="64" width="78" height="44" rx="3" fill="currentColor" opacity="0.12" />
		<rect x="96" y="64" width="90" height="44" rx="3" fill={accent} opacity="0.35" />
		<rect x="96" y="64" width="90" height="5" fill={accent} opacity="0.7" />
		<rect x="80" y="14" width="40" height="14" rx="3" fill={accent} opacity="0.55" />
		<circle cx="46" cy="52" r="10" fill="var(--cc-plants)" opacity="0.8" />
		<rect x="44.5" y="56" width="3" height="8" fill="var(--cc-plants)" opacity="0.8" />
		<path
			d="M62 52 Q74 30 86 28 M92 30 Q80 40 66 56"
			fill="none"
			stroke="var(--cc-plants)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M120 28 Q140 40 146 62 M152 60 Q148 38 124 24"
			fill="none"
			stroke={accent}
			stroke-width="2"
			stroke-linecap="round"
		/>
		<rect x="30" y="86" width="26" height="14" rx="2" fill="currentColor" opacity="0.55" />
		<path
			d="M43 84 L43 34 L76 22"
			fill="none"
			stroke="var(--cc-human)"
			stroke-width="2.6"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if slug === 'rockets'}
		<!-- a rocket climbing on a curving gravity turn over the Earth's limb, an orbit ring above -->
		<path d="M10 118 Q100 84 190 118" fill="var(--sky-ocean)" opacity="0.35" />
		<path
			d="M40 104 C60 84 90 52 150 30"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			stroke-dasharray="3 4"
			opacity="0.5"
		/>
		<ellipse
			cx="100"
			cy="112"
			rx="96"
			ry="84"
			fill="none"
			stroke={accent}
			stroke-width="1.2"
			stroke-dasharray="2 4"
			opacity="0.6"
		/>
		<g transform="translate(118 44) rotate(62)">
			<path d="M-4 18 L0 34 L4 18 Z" fill="var(--rk-flame)" />
			<rect x="-5" y="-10" width="10" height="28" rx="2" fill="currentColor" opacity="0.85" />
			<path d="M-5 -10 Q0 -24 5 -10 Z" fill={accent} />
			<path d="M-5 12 L-10 20 L-5 18 Z M5 12 L10 20 L5 18 Z" fill={accent} />
		</g>
	{:else if slug === 'plate-tectonics'}
		<!-- an ocean plate sinking under a continent, with a volcano above the sinking plate -->
		<path d="M10 60 H186" stroke="var(--pt-sea-edge)" stroke-width="1" opacity="0.8" />
		<path d="M10 60 H96 L98 76 H10 Z" fill="var(--pt-sea)" />
		<path
			d="M10 76 H98 L104 78 C124 84 148 100 176 118 L160 118 C138 104 118 92 100 86 L10 86 Z"
			fill="var(--pt-ocean-crust)"
		/>
		<path
			d="M98 76 C108 66 118 58 124 56 L132 40 L138 56 C150 54 170 52 190 52 V96 C170 88 140 82 104 78 Z"
			fill="var(--pt-continent)"
		/>
		<path d="M132 40 L134 30" stroke={accent} stroke-width="2.5" stroke-linecap="round" />
		<circle cx="128" cy="84" r="2.5" fill={accent} opacity="0.8" />
		<circle cx="131" cy="70" r="2" fill={accent} opacity="0.7" />
		<path
			d="M30 100 H70"
			stroke="currentColor"
			stroke-width="1.4"
			marker-end="url(#pt-art-head)"
			opacity="0.5"
		/>
		<defs>
			<marker
				id="pt-art-head"
				viewBox="0 0 10 10"
				refX="8"
				refY="5"
				markerWidth="5"
				markerHeight="5"
				orient="auto"
			>
				<path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
			</marker>
		</defs>
	{:else if slug === 'the-cell'}
		<!-- a liver cell with its nucleus, mitochondria and ER, and a zoom box onto one ribosome-studded sheet -->
		<path
			d="M22 40 L44 18 L96 16 L120 38 L116 92 L86 108 L36 104 L18 76 Z"
			fill={accent}
			fill-opacity="0.08"
			stroke={accent}
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<circle cx="62" cy="62" r="18" fill="currentColor" opacity="0.12" />
		<circle
			cx="62"
			cy="62"
			r="18"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			opacity="0.55"
		/>
		<circle cx="67" cy="57" r="5" fill="currentColor" opacity="0.4" />
		{#each [[34, 44, 0.4], [92, 34, -0.3], [98, 74, 1.2], [44, 90, 0.2]] as [x, y, a], i (i)}
			<rect
				x={x - 8}
				y={y - 4}
				width="16"
				height="8"
				rx="4"
				fill={accent}
				opacity="0.75"
				transform="rotate({(a * 180) / Math.PI} {x} {y})"
			/>
		{/each}
		<path
			d="M50 86 Q62 92 76 86 M48 92 Q62 99 80 92"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-dasharray="1.5 2.5"
			opacity="0.55"
		/>
		<rect
			x="74"
			y="80"
			width="12"
			height="9"
			fill="none"
			stroke="currentColor"
			stroke-width="1"
			opacity="0.6"
		/>
		<path
			d="M86 80 L138 30 M86 89 L138 98"
			stroke="currentColor"
			stroke-width="0.8"
			opacity="0.35"
		/>
		<rect
			x="138"
			y="30"
			width="48"
			height="68"
			rx="6"
			fill="currentColor"
			fill-opacity="0.05"
			stroke="currentColor"
			stroke-width="1.2"
			opacity="0.7"
		/>
		<path d="M140 52 H184" stroke={accent} stroke-width="3" opacity="0.6" />
		{#each [148, 162, 176] as x (x)}
			<circle cx={x} cy="66" r="6" fill="currentColor" opacity="0.45" />
		{/each}
	{:else if slug === 'neural-networks'}
		<!-- a small network: two inputs, a hidden layer of three, one output, weights as lines -->
		{#each [40, 80] as y1 (y1)}
			{#each [30, 60, 90] as y2 (y2)}
				<line x1="58" {y1} x2="100" {y2} stroke="currentColor" stroke-width="1.2" opacity="0.5" />
			{/each}
		{/each}
		{#each [30, 60, 90] as y2 (y2)}
			<line x1="100" y1={y2} x2="142" y2="60" stroke={accent} stroke-width="1.6" opacity="0.8" />
		{/each}
		{#each [40, 80] as y (y)}
			<circle cx="58" cy={y} r="7" fill="none" stroke="currentColor" stroke-width="1.4" />
		{/each}
		{#each [30, 60, 90] as y (y)}
			<circle cx="100" cy={y} r="8" fill={accent} opacity="0.85" />
		{/each}
		<circle cx="142" cy="60" r="9" fill="none" stroke={accent} stroke-width="2.2" />
	{:else if slug === 'quantum-computing'}
		<!-- a Bloch sphere with its state arrow, and Grover's amplitudes: one bar grown tall -->
		<circle
			cx="58"
			cy="60"
			r="38"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			opacity="0.6"
		/>
		<ellipse
			cx="58"
			cy="60"
			rx="38"
			ry="11"
			fill="none"
			stroke="currentColor"
			stroke-width="1"
			opacity="0.4"
		/>
		<path d="M58 60 L82 33" stroke={accent} stroke-width="2.5" stroke-linecap="round" />
		<circle cx="82" cy="33" r="4" fill={accent} />
		<circle cx="58" cy="60" r="2" fill="currentColor" opacity="0.6" />
		<line
			x1="112"
			y1="96"
			x2="188"
			y2="96"
			stroke="currentColor"
			stroke-width="1.2"
			opacity="0.5"
		/>
		{#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
			<rect
				x={114 + k * 9.5}
				y={k === 5 ? 26 : 88}
				width="6"
				height={k === 5 ? 70 : 8}
				rx="1.5"
				fill={accent}
				opacity={k === 5 ? 1 : 0.45}
			/>
		{/each}
	{:else if slug === 'reaction-rates-equilibrium'}
		<!-- an energy profile: reactants, a barrier with a lower catalysed path, products a little lower -->
		<path
			d="M20 84 H52 C 72 84, 82 20, 100 20 C 118 20, 128 88, 148 88 H184"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path
			d="M52 84 C 72 84, 84 56, 100 56 C 116 56, 128 88, 148 88"
			fill="none"
			stroke="var(--rr-cat)"
			stroke-width="2"
			stroke-dasharray="4 4"
		/>
		<circle cx="36" cy="76" r="6" fill={accent} opacity="0.8" />
		<circle cx="166" cy="80" r="6" fill={accent} opacity="0.8" />
		<circle cx="174" cy="80" r="3" fill="currentColor" opacity="0.5" />
		<circle cx="29" cy="76" r="3" fill="currentColor" opacity="0.5" />
		<path d="M100 26 V80" stroke="currentColor" stroke-dasharray="2 3" opacity="0.4" />
	{:else if slug === 'exoplanets'}
		<!-- a planet crossing its star, and the dip it makes in the star's light -->
		<circle cx="58" cy="52" r="30" fill="var(--ex-star-g)" opacity="0.9" />
		<circle cx="70" cy="58" r="7" fill="currentColor" opacity="0.85" />
		<path
			d="M104 40 H136 C142 40 143 52 148 52 H162 C167 52 168 40 174 40 H192"
			fill="none"
			stroke={accent}
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		<path
			d="M104 86 C116 70 128 70 140 86 S164 102 176 86 S188 76 192 80"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			opacity="0.55"
		/>
	{:else if slug === 'greenhouse-effect'}
		<!-- sunlight down through a band of air to the ground; infrared up from the ground,
		     one wave escaping, one absorbed in the air and sent back down -->
		<rect x="18" y="96" width="164" height="12" rx="2" fill="currentColor" opacity="0.18" />
		<rect x="18" y="40" width="164" height="26" rx="4" fill={accent} opacity="0.14" />
		<circle cx="38" cy="16" r="9" fill="var(--gh-sun)" />
		<path
			d="M46 24 L78 94"
			fill="none"
			stroke="var(--gh-sun)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path
			d="M112 94 q4 -6 0 -12 q-4 -6 0 -12 q4 -6 0 -12 q-4 -6 0 -12 q4 -6 0 -12 q-4 -6 0 -12 q4 -6 0 -10"
			fill="none"
			stroke="var(--gh-ir)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M150 94 q4 -6 0 -12 q-4 -6 0 -12 q4 -6 0 -12"
			fill="none"
			stroke="var(--gh-ir)"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<circle cx="150" cy="54" r="5" fill={accent} />
		<path
			d="M160 60 q6 4 2 10 q-4 6 2 10 q6 4 2 12"
			fill="none"
			stroke="var(--gh-ir)"
			stroke-width="2"
			stroke-linecap="round"
			opacity="0.75"
		/>
	{:else if slug === 'vision-color'}
		<!-- an eye in cross-section focusing parallel rays on its retina, and the three cone
		     sensitivity curves -->
		<circle
			cx="62"
			cy="60"
			r="34"
			fill={accent}
			fill-opacity="0.1"
			stroke="currentColor"
			stroke-opacity="0.45"
			stroke-width="1.6"
		/>
		<path d="M30 46 Q22 60 30 74" fill="none" stroke={accent} stroke-width="2" />
		<ellipse
			cx="44"
			cy="60"
			rx="5"
			ry="11"
			fill={accent}
			fill-opacity="0.45"
			stroke={accent}
			stroke-width="1.2"
		/>
		<path d="M38 42 L38 50 M38 70 L38 78" stroke="currentColor" stroke-width="2.4" opacity="0.6" />
		{#each [-7, 0, 7] as h (h)}
			<path
				d="M6 {60 + h} L44 {60 + h} L96 60"
				fill="none"
				stroke="var(--vc-ray)"
				stroke-width="1.6"
			/>
		{/each}
		<circle cx="96" cy="60" r="2.6" fill="var(--vc-retina)" />
		{#each visionArt as k (k.c)}
			<path d={k.d} fill="none" stroke={k.c} stroke-width="2.2" stroke-linejoin="round" />
		{/each}
		<path d="M112 97 L188 97" stroke="currentColor" stroke-opacity="0.35" />
	{:else if slug === 'earthquakes'}
		<!-- half a slice through the Earth: curved rays from an earthquake, the core in the middle -->
		<path d="M4 116 A96 96 0 0 1 196 116 Z" fill="var(--eq-mantle)" />
		<path d="M48 116 A52 52 0 0 1 152 116 Z" fill="var(--eq-outer)" />
		<path d="M82 116 A18 18 0 0 1 118 116 Z" fill="var(--eq-inner)" />
		<g fill="none" stroke-width="1.6" stroke-linecap="round">
			{#each [1, -1] as k (k)}
				<path d="M100 22 Q{100 + k * 18} 70 {100 + k * 62} 42" stroke="var(--eq-p)" />
				<path d="M100 22 Q{100 + k * 30} 98 {100 + k * 88} 82" stroke="var(--eq-p)" />
				<path d="M100 22 Q{100 + k * 8} 52 {100 + k * 34} 28" stroke="var(--eq-s)" />
			{/each}
		</g>
		<path
			d="M100 14 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6 z"
			fill={accent}
		/>
	{:else if slug === 'dna-to-protein'}
		<!-- a DNA ladder, its RNA copy read three letters at a time, and the growing chain -->
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as i (i)}
			<line
				x1={22 + i * 9}
				x2={22 + i * 9}
				y1="26"
				y2="50"
				stroke={['#e8590c', '#e0a100', '#2f9e44', '#1c7ed6'][(i * 7) % 4]}
				stroke-width="3"
				opacity="0.85"
			/>
		{/each}
		<path d="M18 26 H98 M18 50 H98" stroke="currentColor" stroke-width="1.6" opacity="0.55" />
		<path d="M58 56 V70" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
		<path d="M18 80 H128" stroke={accent} stroke-width="2.5" />
		{#each [0, 1, 2, 3] as c (c)}
			<path
				d="M{20 + c * 27} 86 v4 h23 v-4"
				fill="none"
				stroke="currentColor"
				stroke-width="1"
				opacity="0.5"
			/>
		{/each}
		<ellipse cx="112" cy="72" rx="20" ry="13" fill="currentColor" opacity="0.12" />
		<ellipse cx="112" cy="90" rx="17" ry="7" fill="currentColor" opacity="0.12" />
		{#each [[118, 56], [130, 44], [144, 36], [160, 34], [175, 40], [184, 54]] as [x, y], i (i)}
			<circle
				cx={x}
				cy={y}
				r="6"
				fill={['#f2c94c', '#6fcf97', '#6ea8fe', '#f28b82'][i % 4]}
				stroke="currentColor"
				stroke-width="0.8"
				stroke-opacity="0.5"
			/>
		{/each}
	{:else if slug === 'meiosis-inheritance'}
		<!-- a crossed-over chromosome pair (mother's red, father's blue) dividing into four cells, each with one mixed chromatid -->
		{#each [{ x: 30, top: 'var(--mi-mom)', bottom: 'var(--mi-dad)' }, { x: 42, top: 'var(--mi-mom)', bottom: 'var(--mi-mom)' }, { x: 56, top: 'var(--mi-dad)', bottom: 'var(--mi-dad)' }, { x: 68, top: 'var(--mi-dad)', bottom: 'var(--mi-mom)' }] as c (c.x)}
			<path d="M{c.x} 22 V62" stroke={c.top} stroke-width="7" stroke-linecap="round" />
			<path d="M{c.x} 62 V100" stroke={c.bottom} stroke-width="7" stroke-linecap="round" />
		{/each}
		<circle cx="36" cy="44" r="3" fill="currentColor" opacity="0.55" />
		<circle cx="62" cy="44" r="3" fill="currentColor" opacity="0.55" />
		<path d="M84 60 H108" stroke={accent} stroke-width="2" opacity="0.8" />
		<path d="M104 55 L110 60 L104 65" fill="none" stroke={accent} stroke-width="2" />
		{#each [{ cx: 136, cy: 34, top: 'var(--mi-mom)', bottom: 'var(--mi-dad)' }, { cx: 176, cy: 34, top: 'var(--mi-mom)', bottom: 'var(--mi-mom)' }, { cx: 136, cy: 86, top: 'var(--mi-dad)', bottom: 'var(--mi-dad)' }, { cx: 176, cy: 86, top: 'var(--mi-dad)', bottom: 'var(--mi-mom)' }] as c, i (i)}
			<circle
				cx={c.cx}
				cy={c.cy}
				r="19"
				fill={accent}
				fill-opacity="0.08"
				stroke={accent}
				stroke-width="1.6"
			/>
			<path
				d="M{c.cx} {c.cy - 12} V{c.cy}"
				stroke={c.top}
				stroke-width="5"
				stroke-linecap="round"
			/>
			<path
				d="M{c.cx} {c.cy} V{c.cy + 12}"
				stroke={c.bottom}
				stroke-width="5"
				stroke-linecap="round"
			/>
		{/each}
	{:else if slug === 'convolution-vision'}
		<!-- a pixel grid with a 3 × 3 filter on it, and the feature map it builds -->
		{#each [0, 1, 2, 3, 4] as r (r)}
			{#each [0, 1, 2, 3, 4] as c (c)}
				<rect
					x={30 + c * 12}
					y={30 + r * 12}
					width="11"
					height="11"
					fill="currentColor"
					opacity={c === 2 || (r === 1 && c > 1) ? 0.75 : 0.12}
				/>
			{/each}
		{/each}
		<rect x="41" y="41" width="35" height="35" fill="none" stroke={accent} stroke-width="2.2" />
		<path d="M 80 58 L 114 58" stroke={accent} stroke-width="1.6" />
		<path d="M 110 54 L 116 58 L 110 62" fill="none" stroke={accent} stroke-width="1.6" />
		{#each [0, 1, 2, 3] as r (r)}
			{#each [0, 1, 2, 3] as c (c)}
				<rect
					x={122 + c * 12}
					y={36 + r * 12}
					width="11"
					height="11"
					fill={accent}
					opacity={c === 1 || c === 2 ? 0.8 : 0.15}
				/>
			{/each}
		{/each}
	{:else if slug === 'transformers'}
		<!-- a row of tokens; the last one attends back to the others, one arc per weight -->
		{#each [{ x: 30, w: 1 }, { x: 66, w: 4.5 }, { x: 102, w: 1.2 }, { x: 138, w: 2 }] as a (a.x)}
			<path
				d="M174 78 Q{(a.x + 174) / 2} {78 - (174 - a.x) * 0.45} {a.x} 78"
				fill="none"
				stroke={accent}
				stroke-width={a.w}
				stroke-linecap="round"
				opacity={0.35 + a.w / 8}
			/>
		{/each}
		{#each [30, 66, 102, 138, 174] as x (x)}
			<rect
				x={x - 14}
				y="82"
				width="28"
				height="16"
				rx="4"
				fill={x === 174 ? accent : 'none'}
				stroke={x === 174 ? accent : 'currentColor'}
				stroke-width="1.4"
				opacity={x === 174 ? 0.9 : 0.6}
			/>
		{/each}
	{:else if slug === 'respiration-atp'}
		<!-- a membrane with a proton pump and ATP synthase: protons cross back through the rotor, ATP pops out -->
		<rect x="16" y="56" width="168" height="16" rx="4" fill="currentColor" opacity="0.18" />
		<rect x="40" y="48" width="28" height="32" rx="8" fill="currentColor" opacity="0.45" />
		<rect x="122" y="52" width="36" height="24" rx="8" fill={accent} opacity="0.85" />
		<path d="M140 52 V34" stroke={accent} stroke-width="5" stroke-linecap="round" />
		<ellipse cx="140" cy="28" rx="20" ry="14" fill={accent} />
		<path d="M54 90 V100 M54 44 V30" stroke="currentColor" stroke-width="1.4" opacity="0.5" />
		{#each [[54, 24], [104, 96], [92, 100], [116, 100]] as [x, y] (`${x}-${y}`)}
			<circle cx={x} cy={y} r="4" fill="#f472b6" />
		{/each}
		<path
			d="M104 90 C 112 84, 120 84, 126 78"
			fill="none"
			stroke="#f472b6"
			stroke-width="1.6"
			opacity="0.8"
		/>
		<rect x="164" y="10" width="26" height="13" rx="6.5" fill="#f97316" />
	{:else if slug === 'standard-model'}
		<!-- a proton: three quarks, one of each colour, tied by gluon springs; an electron outside -->
		<circle cx="88" cy="60" r="42" fill={accent} opacity="0.1" />
		<path
			d="M88 32 L64 76 L112 76 Z"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-dasharray="2 3"
			opacity="0.5"
		/>
		<circle cx="88" cy="32" r="11" fill="var(--sm-red)" />
		<circle cx="64" cy="76" r="11" fill="var(--sm-green)" />
		<circle cx="112" cy="76" r="11" fill="var(--sm-blue)" />
		<text
			x="88"
			y="36.5"
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill="var(--sm-ball-ink)">u</text
		>
		<text
			x="64"
			y="80.5"
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill="var(--sm-ball-ink)">u</text
		>
		<text
			x="112"
			y="80.5"
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill="var(--sm-ball-ink)">d</text
		>
		<circle cx="166" cy="34" r="6" fill="var(--sm-lepton)" />
		<path
			d="M140 58 q6 -8 12 0 q6 8 12 0"
			fill="none"
			stroke="var(--sm-boson)"
			stroke-width="2"
			stroke-linecap="round"
		/>
	{:else if slug === 'deep-time'}
		<!-- the eons to scale (ICS colours), a globe, and a magnifier on the last sliver -->
		{#each [[12, 20.6, '#AE027E'], [32.6, 59, '#F0047F'], [91.6, 75.6, '#F73563'], [167.2, 20.8, '#9AD9DD']] as [x, w, c] (x)}
			<rect x={Number(x)} y="80" width={Number(w)} height="12" fill={String(c)} opacity="0.85" />
		{/each}
		<rect
			x="12"
			y="80"
			width="176"
			height="12"
			rx="2"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.4"
		/>
		<circle
			cx="62"
			cy="40"
			r="25"
			fill="var(--dt-sea)"
			stroke="currentColor"
			stroke-opacity="0.45"
			stroke-width="1.4"
		/>
		<path
			d="M48 30 q8 -9 18 -4 q9 5 4 13 q-3 8 -12 7 q-6 6 -11 -1 q-6 -7 1 -15 z"
			fill="var(--dt-land)"
			stroke="var(--dt-land-edge)"
		/>
		<path
			d="M38 46 q12 5 24 4 q12 -1 23 -6"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.3"
		/>
		<circle cx="184" cy="86" r="13" fill="none" stroke={accent} stroke-width="2.2" />
		<path d="M175 76 L150 40" stroke={accent} stroke-width="1.4" stroke-dasharray="3 3" />
		<path d="M184 79 L184 93" stroke={accent} stroke-width="2.4" />
		<text x="148" y="34" font-size="11" text-anchor="end" fill="currentColor" opacity="0.7">us</text
		>
	{:else if slug === 'redox-batteries'}
		<!-- a cell in cross-section: two electrodes, a dashed separator, an ion crossing
		     inside and an electron going round the wire through a lamp -->
		<rect x="40" y="46" width="44" height="58" rx="4" fill="currentColor" opacity="0.18" />
		<rect x="116" y="46" width="44" height="58" rx="4" fill={accent} opacity="0.35" />
		<path d="M100 46 V104" stroke="currentColor" stroke-dasharray="3 3" opacity="0.5" />
		<path
			d="M62 46 V22 H138 V46"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			opacity="0.6"
		/>
		<circle cx="100" cy="22" r="7" fill="var(--rb-lamp)" stroke="currentColor" opacity="0.9" />
		<circle cx="76" cy="22" r="3.2" fill="var(--rb-electron)" />
		<circle cx="92" cy="76" r="4.2" fill="var(--rb-li)" />
		<path d="M98 76 H110" stroke={accent} stroke-width="1.6" stroke-linecap="round" />
		<path d="M106 72 L111 76 L106 80" fill="none" stroke={accent} stroke-width="1.6" />
	{:else if slug === 'neurons'}
		<!-- a neuron: dendrites, cell body, a myelinated axon, and the spike it fires -->
		<g
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.55"
			stroke-width="1.6"
			stroke-linecap="round"
		>
			<path d="M40 78 L18 60 M28 68 L14 74 M40 78 L22 96 M30 88 L16 92 M40 78 L30 104" />
			<path d="M40 78 L56 50 M50 60 L44 44" />
		</g>
		<circle
			cx="44"
			cy="78"
			r="11"
			fill={accent}
			fill-opacity="0.3"
			stroke={accent}
			stroke-width="1.6"
		/>
		<path d="M55 80 L188 80" stroke="var(--nr-axon-edge)" stroke-width="3" stroke-linecap="round" />
		{#each [66, 98, 130, 162] as x (x)}
			<rect
				{x}
				y="75"
				width="26"
				height="10"
				rx="5"
				fill="var(--nr-myelin)"
				stroke="var(--nr-myelin-edge)"
				stroke-width="1"
			/>
		{/each}
		<path
			d="M70 46 L112 46 L118 44 L124 12 L130 50 L138 52 L146 47 L188 46"
			fill="none"
			stroke={accent}
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
	{:else if slug === 'immune-system'}
		<!-- an antibody beside two responses: a small slow first one, a big fast second one -->
		<g
			transform="translate(40 58)"
			fill="none"
			stroke={accent}
			stroke-width="5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M0 34 L0 4 L-20 -22 M0 4 L20 -22" />
			<path d="M-9 -2 L-26 -24 M9 -2 L26 -24" stroke-width="2.4" opacity="0.6" />
		</g>
		<path d="M80 100 L192 100" stroke="currentColor" stroke-opacity="0.35" />
		<path
			d="M80 99 C 96 99, 100 82, 110 82 S 122 98, 132 99 L140 99 C 146 99, 148 30, 158 30 S 172 80, 192 86"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<circle cx="88" cy="100" r="3" fill="var(--im-virus)" />
		<circle cx="142" cy="100" r="3" fill="var(--im-virus)" />
	{:else if slug === 'evolution'}
		<!-- a pale population (outlined bars) shifting dark (filled bars) under selection -->
		{#each [0, 1, 2, 3, 4, 5, 6] as k (k)}
			{@const before = [26, 40, 30, 16, 8, 4, 2][k]}
			{@const after = [3, 6, 12, 22, 34, 38, 24][k]}
			<rect
				x={40 + k * 18}
				y={100 - before}
				width="14"
				height={before}
				fill="none"
				stroke="currentColor"
				stroke-opacity="0.4"
				stroke-dasharray="3 2"
			/>
			<rect
				x={42 + k * 18}
				y={100 - after}
				width="10"
				height={after}
				rx="1.5"
				fill={['#ece6d4', '#d6cfba', '#b5ad97', '#8c8573', '#625d52', '#3f3b35', '#24221f'][k]}
				stroke={accent}
				stroke-width="1"
			/>
		{/each}
		<path d="M40 100 H172" stroke="currentColor" stroke-opacity="0.5" />
		<path d="M70 24 C 100 16, 130 16, 156 28" fill="none" stroke={accent} stroke-width="2" />
		<path d="M150 22 L157 28 L149 33" fill="none" stroke={accent} stroke-width="2" />
	{:else if slug === 'language-models'}
		<!-- a row of tokens, then a bar chart of next-token probabilities, the top one picked -->
		{#each [26, 62, 98] as x (x)}
			<rect
				x={x - 14}
				y="22"
				width="30"
				height="16"
				rx="4"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				opacity="0.6"
			/>
		{/each}
		<rect
			x="120"
			y="22"
			width="30"
			height="16"
			rx="4"
			fill="none"
			stroke={accent}
			stroke-width="1.6"
			stroke-dasharray="3 2"
		/>
		{#each [0.9, 0.62, 0.4, 0.22, 0.12] as w, i (i)}
			<rect
				x="40"
				y={52 + i * 12}
				width={w * 130}
				height="8"
				rx="2"
				fill={accent}
				opacity={i === 0 ? 0.95 : 0.45}
			/>
		{/each}
		<path
			d="M172 56 C188 48 186 34 158 30"
			fill="none"
			stroke={accent}
			stroke-width="1.6"
			stroke-linecap="round"
		/>
	{:else if slug === 'protein-folding'}
		<!-- the HP model: a 14-bead chain in its one best fold, water-repelling beads in a core -->
		<path
			d="M100 71 L122 71 L144 71 L144 49 L122 49 L100 49 L100 27 L78 27 L78 49 L56 49 L56 71 L78 71 L78 93 L100 93"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			opacity="0.55"
		/>
		{#each [[100, 71, 1], [122, 71, 1], [144, 71, 0], [144, 49, 0], [122, 49, 1], [100, 49, 1], [100, 27, 0], [78, 27, 0], [78, 49, 1], [56, 49, 0], [56, 71, 0], [78, 71, 1], [78, 93, 0], [100, 93, 1]] as [x, y, h], i (i)}
			<circle
				cx={x}
				cy={y}
				r="7"
				fill={h ? '#f08c00' : '#4dabf7'}
				stroke="currentColor"
				stroke-width="0.8"
				stroke-opacity="0.5"
			/>
		{/each}
	{:else if slug === 'carbon-polymers'}
		<!-- a zigzag carbon chain running into a benzene ring, with one cross-link to a second chain -->
		<path
			d="M14 74 L32 62 L50 74 L68 62 L86 74 L104 62"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.55"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path
			d="M14 104 L32 92 L50 104 L68 92 L86 104"
			fill="none"
			stroke={accent}
			stroke-opacity="0.7"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<line x1="50" y1="74" x2="50" y2="104" stroke="var(--cp-link)" stroke-width="3" />
		<polygon
			points="122,50 142,38 162,50 162,74 142,86 122,74"
			fill={accent}
			fill-opacity="0.12"
			stroke="currentColor"
			stroke-opacity="0.55"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<line
			x1="104"
			y1="62"
			x2="122"
			y2="62"
			stroke="currentColor"
			stroke-opacity="0.55"
			stroke-width="3"
		/>
		<circle cx="142" cy="62" r="13" fill="none" stroke={accent} stroke-width="2" />
		{#each [32, 68] as x (x)}
			<circle cx={x} cy="62" r="4" fill={accent} />
		{/each}
		<text x="174" y="44" font-size="13" font-weight="700" fill={accent}>OH</text>
		<line
			x1="162"
			y1="50"
			x2="174"
			y2="42"
			stroke="currentColor"
			stroke-opacity="0.55"
			stroke-width="2.5"
		/>
	{:else if slug === 'tensors'}
		<!-- one number grows into a row, a table and a block: tensors with 0, 1, 2 and 3 axes -->
		{#each tensorArt as c (c.k)}
			<rect
				x={c.x}
				y={c.y}
				width="11"
				height="11"
				rx="1.5"
				fill="color-mix(in srgb, {accent} {Math.round(c.o * 100)}%, var(--surface))"
				stroke="currentColor"
				stroke-opacity="0.55"
				stroke-width="1"
			/>
		{/each}
	{:else if slug === 'ice-ages'}
		<!-- the Sun off-centre in a stretched orbit; a tilted Earth with a northern ice cap -->
		<ellipse
			cx="96"
			cy="60"
			rx="80"
			ry="34"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			opacity="0.4"
		/>
		<circle cx="74" cy="60" r="12" fill="#f59f00" />
		<g transform="rotate(-24 160 52)">
			<circle cx="160" cy="52" r="20" fill={accent} />
			<path
				d="M145.7 38 A20 20 0 0 1 174.3 38 Z"
				fill="var(--ia-ice)"
				stroke="var(--ia-ice-edge)"
			/>
			<path d="M160 22 V82" stroke="currentColor" stroke-width="1.6" opacity="0.7" />
		</g>
		<path
			d="M150 78 A20 20 0 0 1 140 60"
			fill="none"
			stroke="currentColor"
			stroke-width="1.2"
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
	{:else if slug === 'big-bang'}
		<!-- a patch of galaxies seen from one of them: all recede, the farther the faster and redder -->
		{#each [[-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1]] as [i, j] (`${i},${j}`)}
			{@const r = Math.hypot(i, j)}
			<circle
				cx={100 + i * 36}
				cy={60 + j * 34}
				r="3.2"
				fill={r > 1.9 ? 'var(--bb-red)' : r > 1.2 ? 'var(--bb-mid)' : 'currentColor'}
				opacity={r > 1.9 ? 0.9 : 0.75}
			/>
			<path
				d="M{100 + i * 36 + (i / r) * 6} {60 + j * 34 + (j / r) * 6} l{(i / r) * r * 7} {(j / r) *
					r *
					7}"
				stroke={accent}
				stroke-width="1.6"
				stroke-linecap="round"
				opacity="0.8"
			/>
		{/each}
		<circle cx="100" cy="60" r="5" fill={accent} />
		<circle cx="100" cy="60" r="9" fill="none" stroke={accent} stroke-width="1.2" opacity="0.6" />
	{:else if slug === 'diffusion-models'}
		<!-- scattered noise on the left condenses, step by step, into a crescent on the right -->
		{#each [[22, 34], [40, 78], [30, 58], [54, 44], [18, 88], [48, 96], [62, 70], [36, 24], [58, 26], [26, 104]] as [x, y], i (i)}
			<circle cx={x} cy={y} r="3" fill="currentColor" opacity="0.45" />
		{/each}
		<path d="M 76 60 L 104 60" stroke={accent} stroke-width="1.6" />
		<path d="M 100 56 L 106 60 L 100 64" fill="none" stroke={accent} stroke-width="1.6" />
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as k (k)}
			<circle
				cx={150 + 34 * Math.cos(Math.PI * (0.1 + 0.08 * k))}
				cy={88 - 46 * Math.sin(Math.PI * (0.1 + 0.08 * k))}
				r="3.4"
				fill={accent}
			/>
		{/each}
	{:else if slug === 'mrna-vaccines'}
		<!-- a lipid bubble with its message, a ribosome reading it, and the spike it makes -->
		<circle cx="58" cy="60" r="30" fill="none" stroke={accent} stroke-width="5" opacity="0.85" />
		<path
			d="M40 62 C 46 50, 52 74, 58 62 S 70 50, 76 62"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
		/>
		<path
			d="M98 76 L182 76"
			fill="none"
			stroke={accent}
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-dasharray="6 4"
		/>
		<ellipse cx="124" cy="70" rx="13" ry="10" fill={accent} opacity="0.6" />
		<g stroke="currentColor" stroke-opacity="0.55" stroke-width="2.4" stroke-linecap="round">
			<path d="M162 76 L162 52" />
			<path d="M162 54 C 150 48, 152 36, 162 34 C 172 36, 174 48, 162 54" fill="none" />
		</g>
	{:else if slug === 'stars'}
		<!-- a massive star cut open: onion layers round an iron core, and a track on the HR diagram -->
		<circle cx="62" cy="60" r="44" fill="var(--st-h)" />
		<circle cx="62" cy="60" r="32" fill="var(--st-he)" />
		<circle cx="62" cy="60" r="22" fill="var(--st-co)" />
		<circle cx="62" cy="60" r="13" fill="var(--st-si)" />
		<circle cx="62" cy="60" r="6" fill="var(--st-fe)" />
		<path
			d="M128 88 L150 78 Q160 74 170 60 L178 40 Q182 30 174 28"
			fill="none"
			stroke={accent}
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<circle cx="128" cy="88" r="5" fill="#9bc2ff" />
		<circle cx="174" cy="28" r="6" fill="#ff8a4c" />
	{:else if slug === 'dark-matter'}
		<!-- a tilted galaxy inside its dashed dark halo; a flat measured rotation curve above a falling Kepler curve -->
		<circle
			cx="48"
			cy="60"
			r="36"
			fill={accent}
			fill-opacity="0.08"
			stroke={accent}
			stroke-width="1.4"
			stroke-dasharray="4 3"
		/>
		<ellipse
			cx="48"
			cy="60"
			rx="24"
			ry="9"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			opacity="0.6"
		/>
		<circle cx="48" cy="60" r="4" fill="currentColor" opacity="0.7" />
		<path d="M104 28 V92 H190" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
		<path
			d="M110 84 C118 50 126 46 134 52 S160 70 186 76"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			stroke-dasharray="4 3"
			opacity="0.55"
		/>
		{#each [[112, 70], [120, 48], [130, 40], [142, 38], [154, 38], [166, 39], [178, 38]] as [x, y] (x)}
			<circle cx={x} cy={y} r="3" fill={accent} />
		{/each}
	{:else if slug === 'gpu'}
		<!-- one big core beside a grid of many small lanes, a few of them switched off -->
		<rect
			x="16"
			y="34"
			width="52"
			height="52"
			rx="6"
			fill="var(--gpu-fast)"
			fill-opacity="0.18"
			stroke="var(--gpu-fast)"
			stroke-width="2.5"
		/>
		<text x="42" y="66" text-anchor="middle" font-size="13" font-weight="700" fill="var(--gpu-fast)"
			>CPU</text
		>
		{#each Array.from({ length: 48 }, (_, k) => k) as k (k)}
			<rect
				x={88 + (k % 12) * 9}
				y={30 + Math.floor(k / 12) * 15}
				width="7"
				height="12"
				rx="1.5"
				fill={k % 12 > 8 && k > 23 ? 'var(--gpu-idle)' : accent}
				fill-opacity={k % 12 > 8 && k > 23 ? 1 : 0.8}
			/>
		{/each}
	{:else if slug === 'medical-imaging'}
		<!-- a CT slice of a chest inside the scanner ring, an X-ray beam, and the sine waves of its sinogram -->
		<circle
			cx="62"
			cy="60"
			r="46"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.35"
			stroke-width="6"
		/>
		<ellipse
			cx="62"
			cy="60"
			rx="32"
			ry="22"
			fill="currentColor"
			fill-opacity="0.12"
			stroke="currentColor"
			stroke-opacity="0.5"
			stroke-width="1.4"
		/>
		<ellipse
			cx="48"
			cy="60"
			rx="9"
			ry="13"
			fill="var(--stage-bg)"
			stroke="currentColor"
			stroke-opacity="0.45"
		/>
		<ellipse
			cx="77"
			cy="60"
			rx="8"
			ry="12"
			fill="var(--stage-bg)"
			stroke="currentColor"
			stroke-opacity="0.45"
		/>
		<circle cx="62" cy="72" r="4" fill="currentColor" fill-opacity="0.7" />
		<circle cx="80" cy="64" r="2.2" fill={accent} />
		<path
			d="M30 22 L94 98"
			stroke={accent}
			stroke-width="8"
			stroke-opacity="0.25"
			stroke-linecap="round"
		/>
		<circle cx="30" cy="22" r="5" fill={accent} />
		<g fill="none" stroke-width="1.6" stroke-linecap="round">
			<path d="M130 16 C150 16 150 104 170 104 S190 16 190 16" stroke={accent} />
			<path d="M140 16 C155 16 160 104 175 104" stroke="currentColor" stroke-opacity="0.45" />
			<path d="M160 16 C170 40 170 80 160 104" stroke="currentColor" stroke-opacity="0.3" />
		</g>
		<rect
			x="126"
			y="12"
			width="68"
			height="96"
			rx="4"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.35"
		/>
	{:else if slug === 'gravitational-waves'}
		<!-- two black holes in orbit, the two-armed spiral of their waves, and the chirp -->
		<path
			d="M103.2 46.8 L102.1 46.1 L100.8 45.4 L99.3 44.9 L97.5 44.4 L95.5 44.1 L93.3 44.0 L91.1 44.0 L88.7 44.3 L86.3 44.8 L84.0 45.4 L81.7 46.3 L79.7 47.4 L77.8 48.7 L76.2 50.1 L75.0 51.8 L74.2 53.5 L73.7 55.4 L73.8 57.4 L74.3 59.4 L75.4 61.4 L77.0 63.4 L79.1 65.3 L81.7 67.1 L84.8 68.7 L88.4 70.2 L92.4 71.4 L96.8 72.3 L101.4 72.9 L106.3 73.2 L111.3 73.1 L116.4 72.7 L121.5 71.8 L126.5 70.6 L131.2 69.1 L135.6 67.1 L139.6 64.9 L143.1 62.3 L146.1 59.4 L148.4 56.2 L150.0 52.9 L150.8 49.4 L150.8 45.8"
			fill="none"
			stroke={accent}
			stroke-width="1.6"
			opacity="0.8"
		/>
		<path
			d="M96.8 57.2 L97.9 57.9 L99.2 58.6 L100.7 59.1 L102.5 59.6 L104.5 59.9 L106.7 60.0 L108.9 60.0 L111.3 59.7 L113.7 59.2 L116.0 58.6 L118.3 57.7 L120.3 56.6 L122.2 55.3 L123.8 53.9 L125.0 52.2 L125.8 50.5 L126.3 48.6 L126.2 46.6 L125.7 44.6 L124.6 42.6 L123.0 40.6 L120.9 38.7 L118.3 36.9 L115.2 35.3 L111.6 33.8 L107.6 32.6 L103.2 31.7 L98.6 31.1 L93.7 30.8 L88.7 30.9 L83.6 31.3 L78.5 32.2 L73.5 33.4 L68.8 34.9 L64.4 36.9 L60.4 39.1 L56.9 41.7 L53.9 44.6 L51.6 47.8 L50.0 51.1 L49.2 54.6 L49.2 58.2"
			fill="none"
			stroke={accent}
			stroke-width="1.6"
			opacity="0.8"
		/>
		<circle cx="91" cy="52" r="5.5" fill="currentColor" opacity="0.85" />
		<circle cx="110" cy="52" r="4.5" fill="currentColor" opacity="0.85" />
		<path
			d="M40.0 104.0 L41.0 104.8 L42.0 105.5 L43.0 105.9 L44.0 106.0 L45.0 105.8 L46.0 105.3 L47.0 104.6 L48.0 103.7 L49.0 102.9 L50.0 102.3 L51.0 101.9 L52.0 101.9 L53.0 102.2 L54.0 102.9 L55.0 103.8 L56.0 104.8 L57.0 105.6 L58.0 106.2 L59.0 106.4 L60.0 106.1 L61.0 105.5 L62.0 104.5 L63.0 103.5 L64.0 102.5 L65.0 101.7 L66.0 101.4 L67.0 101.6 L68.0 102.2 L69.0 103.3 L70.0 104.5 L71.0 105.7 L72.0 106.5 L73.0 106.9 L74.0 106.6 L75.0 105.8 L76.0 104.6 L77.0 103.2 L78.0 102.0 L79.0 101.1 L80.0 100.9 L81.0 101.3 L82.0 102.4 L83.0 103.8 L84.0 105.4 L85.0 106.7 L86.0 107.4 L87.0 107.3 L88.0 106.4 L89.0 104.9 L90.0 103.2 L91.0 101.6 L92.0 100.5 L93.0 100.3 L94.0 101.0 L95.0 102.6 L96.0 104.5 L97.0 106.4 L98.0 107.7 L99.0 108.0 L100.0 107.3 L101.0 105.5 L102.0 103.3 L103.0 101.2 L104.0 99.9 L105.0 99.7 L106.0 100.8 L107.0 102.9 L108.0 105.4 L109.0 107.6 L110.0 108.6 L111.0 108.3 L112.0 106.5 L113.0 103.8 L114.0 101.1 L115.0 99.3 L116.0 99.1 L117.0 100.6 L118.0 103.4 L119.0 106.5 L120.0 108.7 L121.0 109.2 L122.0 107.7 L123.0 104.6 L124.0 101.2 L125.0 98.8 L126.0 98.6 L127.0 100.7 L128.0 104.3 L129.0 107.9 L130.0 109.8 L131.0 109.0 L132.0 105.7 L133.0 101.4 L134.0 98.3 L135.0 98.2 L136.0 101.2 L137.0 105.9 L138.0 109.7 L139.0 110.2 L140.0 106.7 L141.0 101.4 L142.0 97.6 L143.0 98.2 L144.0 103.1 L145.0 108.9 L146.0 110.9 L147.0 107.1 L148.0 100.4 L149.0 96.8 L150.0 100.4 L151.0 108.1 L152.0 111.3 L153.0 105.3 L154.0 97.2 L155.0 99.5 L156.0 109.8 L157.0 108.6 L158.0 96.5 L159.0 107.6 L160.0 96.4"
			fill="none"
			stroke="currentColor"
			stroke-width="1.4"
			opacity="0.6"
		/>
	{:else if slug === 'graphics-3d'}
		<!-- a wireframe cube projected onto a screen of pixels, and a ray from the eye through one -->
		<rect
			x="96"
			y="18"
			width="88"
			height="84"
			rx="4"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.35"
			stroke-width="1.5"
			stroke-dasharray="3 4"
		/>
		{#each [0, 1, 2, 3] as k (k)}
			<rect
				x={120 + 10 * k}
				y={52 + 4 * (k % 2)}
				width="9"
				height="9"
				fill={accent}
				fill-opacity={0.25 + 0.18 * k}
			/>
		{/each}
		<path
			d="M128 40 L160 34 L172 46 L140 52 Z M128 40 L128 76 L140 88 L140 52 M140 88 L172 82 L172 46"
			fill="none"
			stroke="currentColor"
			stroke-opacity="0.6"
			stroke-width="2"
			stroke-linejoin="round"
		/>
		<line x1="22" y1="74" x2="150" y2="60" stroke={accent} stroke-width="2.5" />
		<circle cx="22" cy="74" r="6" fill="none" stroke="currentColor" stroke-width="2" />
		<circle cx="22" cy="74" r="2.2" fill="currentColor" />
		<circle cx="150" cy="60" r="3.5" fill={accent} />
	{:else if slug === 'cancer'}
		<!-- a sheet of cells with a red clone growing inside a yellow one -->
		{#each Array.from({ length: 60 }, (_, i) => i) as i (i)}
			{@const x = 40 + (i % 12) * 11}
			{@const y = 28 + Math.floor(i / 12) * 14}
			{@const d1 = Math.hypot((x - 112) / 11, (y - 56) / 14)}
			<circle
				cx={x}
				cy={y}
				r="4.6"
				fill={d1 < 1.6 ? accent : d1 < 3.2 ? '#e9b730' : 'none'}
				stroke={d1 < 3.2 ? 'none' : 'currentColor'}
				stroke-opacity="0.4"
			/>
		{/each}
	{:else if slug === 'turing-machines'}
		<!-- a strip of tape cells holding 1 0 1 1, the head (a triangle) over one cell -->
		{#each ['1', '0', '1', '1', '', ''] as sym, i (i)}
			<rect
				x={22 + i * 27}
				y="52"
				width="24"
				height="28"
				rx="3"
				fill={i === 3 ? accent : 'none'}
				fill-opacity={i === 3 ? 0.2 : 0}
				stroke="currentColor"
				stroke-width="1.4"
				opacity={i === 3 ? 1 : 0.55}
			/>
			<text
				x={34 + i * 27}
				y="71"
				text-anchor="middle"
				font-size="14"
				font-weight="600"
				fill="currentColor">{sym}</text
			>
		{/each}
		<path d="M103 26 L115 26 L109 44 Z" fill={accent} />
		<path d="M16 66 H20 M186 66 H190" stroke="currentColor" stroke-width="1.4" opacity="0.4" />
		<text x="109" y="100" text-anchor="middle" font-size="11" fill={accent} font-weight="600"
			>carry 1 → 0 L</text
		>
	{:else if slug === 'wireless-signals'}
		<!-- a phase-keyed carrier and a 16-QAM constellation blurred by noise -->
		<path d={wsWave} fill="none" stroke={accent} stroke-width="2" stroke-linejoin="round" />
		<line x1="115" x2="187" y1="60" y2="60" stroke="currentColor" stroke-opacity="0.3" />
		<line x1="151" x2="151" y1="22" y2="98" stroke="currentColor" stroke-opacity="0.3" />
		{#each wsDots as d, i (i)}
			<circle cx={d.x} cy={d.y} r="1.6" fill="currentColor" opacity="0.5" />
		{/each}
		{#each [0, 1, 2, 3] as i (i)}
			{#each [0, 1, 2, 3] as j (j)}
				<circle cx={124 + i * 18} cy={33 + j * 18} r="2.6" fill={accent} />
			{/each}
		{/each}
	{:else if slug === 'gps'}
		<!-- three circles of distance round three satellites, meeting at the receiver -->
		{#each [[52, 30, 63], [156, 26, 66], [112, 106, 41]] as [x, y, r] (`${x},${y}`)}
			<circle
				cx={x}
				cy={y}
				{r}
				fill="none"
				stroke="currentColor"
				stroke-width="1.2"
				opacity="0.45"
			/>
			<rect x={x - 5} y={y - 3} width="10" height="6" rx="1.5" fill={accent} />
			<path d="M{x - 11} {y}h5M{x + 6} {y}h5" stroke={accent} stroke-width="2" />
		{/each}
		<circle cx="104" cy="66" r="4.5" fill={accent} />
		<circle cx="104" cy="66" r="8" fill="none" stroke={accent} stroke-width="1.2" opacity="0.6" />
	{:else if slug === 'heat-engines'}
		<!-- a cylinder and piston, and the loop the gas traces on a pressure–volume chart -->
		<g stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round">
			<path d="M28 22 L28 96 L66 96 L66 22" opacity="0.5" />
			<path d="M47 66 L47 108" opacity="0.5" />
			<path d="M92 18 L92 102 L184 102" opacity="0.45" />
		</g>
		<rect x="30" y="62" width="34" height="9" rx="2" fill="currentColor" opacity="0.45" />
		<rect x="30" y="24" width="34" height="38" fill={accent} opacity="0.35" />
		<path
			d="M104 92 C 116 88, 116 70, 108 30 C 128 40, 150 62, 176 80 L 176 96 C 150 95, 126 94, 104 92 Z"
			fill={accent}
			fill-opacity="0.25"
			stroke={accent}
			stroke-width="2.4"
			stroke-linejoin="round"
		/>
	{:else if slug === 'solar-cells'}
		<!-- a sun's photons striking a tilted cell; an I–V curve with its maximum-power rectangle -->
		<circle cx="30" cy="28" r="12" fill={accent} opacity="0.85" />
		{#each [[46, 40], [40, 50], [52, 34]] as [x, y] (x)}
			<path
				d="M{x} {y} q4 -3 8 0 t8 0 t8 0"
				fill="none"
				stroke={accent}
				stroke-width="1.4"
				transform="rotate(35 {x} {y})"
			/>
		{/each}
		<path d="M30 96 L84 66 L96 74 L42 104 Z" fill="currentColor" opacity="0.18" />
		<path
			d="M30 96 L84 66 L96 74 L42 104 Z"
			fill="none"
			stroke="currentColor"
			stroke-width="1.2"
			opacity="0.6"
		/>
		<path d="M48 85 L60 92 M66 75 L78 82" stroke="currentColor" stroke-width="1" opacity="0.45" />
		<path d="M112 26 V96 H192" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5" />
		<rect x="112" y="40" width="58" height="56" fill={accent} fill-opacity="0.15" />
		<path
			d="M112 36 L160 37 C168 38 172 44 176 60 L182 96"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			opacity="0.75"
		/>
		<circle cx="170" cy="40" r="3.5" fill={accent} />
	{:else if slug === 'consensus-blockchains'}
		<!-- five servers in a ring (one leader) beside three blocks linked by hash -->
		{#each [0, 1, 2, 3, 4] as k (k)}
			{#each [0, 1, 2, 3, 4] as j (j)}
				{#if j > k}
					<line
						x1={46 + 28 * Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / 5)}
						y1={60 + 28 * Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / 5)}
						x2={46 + 28 * Math.cos(-Math.PI / 2 + (j * 2 * Math.PI) / 5)}
						y2={60 + 28 * Math.sin(-Math.PI / 2 + (j * 2 * Math.PI) / 5)}
						stroke="currentColor"
						stroke-opacity="0.25"
					/>
				{/if}
			{/each}
		{/each}
		{#each [0, 1, 2, 3, 4] as k (k)}
			<circle
				cx={46 + 28 * Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / 5)}
				cy={60 + 28 * Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / 5)}
				r="7"
				fill={k === 1 ? accent : 'var(--surface)'}
				stroke={k === 1 ? accent : 'currentColor'}
				stroke-opacity={k === 1 ? 1 : 0.5}
				stroke-width="2"
			/>
		{/each}
		{#each [0, 1, 2] as b (b)}
			<rect
				x={96 + b * 34}
				y="46"
				width="24"
				height="28"
				rx="4"
				fill={accent}
				opacity={0.55 + b * 0.2}
			/>
			{#if b > 0}
				<line
					x1={86 + b * 34}
					y1="60"
					x2={96 + b * 34}
					y2="60"
					stroke="currentColor"
					stroke-opacity="0.5"
					stroke-width="2"
				/>
			{/if}
		{/each}
	{:else if slug === 'feedback-control'}
		<!-- a drone overshooting its target height and settling on it, the loop arrow beside it -->
		<line
			x1="70"
			x2="192"
			y1="40"
			y2="40"
			stroke="currentColor"
			stroke-opacity="0.45"
			stroke-width="1.5"
			stroke-dasharray="4 4"
		/>
		<path
			d="M70 96 C 84 96, 88 24, 104 24 S 118 52, 130 48 S 146 36, 156 39 S 176 40, 192 40"
			fill="none"
			stroke={accent}
			stroke-width="2.6"
			stroke-linecap="round"
		/>
		<g transform="translate(36 60)">
			<rect x="-16" y="-4" width="32" height="8" rx="3" fill="currentColor" opacity="0.6" />
			<line x1="-22" x2="-10" y1="-8" y2="-8" stroke={accent} stroke-width="2.5" />
			<line x1="10" x2="22" y1="-8" y2="-8" stroke={accent} stroke-width="2.5" />
			<path
				d="M0 14 L0 30"
				stroke={accent}
				stroke-width="2.5"
				stroke-linecap="round"
				opacity="0.7"
			/>
			<path d="M-5 24 L0 32 L5 24" fill="none" stroke={accent} stroke-width="2.5" opacity="0.7" />
		</g>
	{:else if slug === 'power-grid'}
		<!-- a transmission tower carrying three wires, and a day's demand curve behind it -->
		<path
			d="M14 92 C40 92 46 66 66 60 C86 54 104 70 124 66 C144 62 160 30 186 40"
			fill="none"
			stroke={accent}
			stroke-width="2.5"
			stroke-linecap="round"
			opacity="0.8"
		/>
		<path
			d="M100 108 L112 30 L124 108 M104 82 H120 M107 60 H117 M88 40 H136 M92 54 H132"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linejoin="round"
			opacity="0.7"
		/>
		{#each [88, 136, 92, 132] as x, i (i)}
			<circle cx={x} cy={i < 2 ? 40 : 54} r="2.5" fill="currentColor" opacity="0.7" />
		{/each}
		<path
			d="M10 46 Q50 54 88 40 M136 40 Q166 50 192 44 M10 60 Q52 66 92 54 M132 54 Q164 64 192 58"
			fill="none"
			stroke="currentColor"
			stroke-width="1.2"
			opacity="0.5"
		/>
	{:else if slug === 'flight'}
		<!-- a cambered wing section tilted into the air, its streamlines turned down, and lift -->
		{#each ['M-2.0 100.5 L19.7 98.5 L40.6 97.0 L61.2 96.5 L82.1 96.6 L103.2 97.0 L124.3 97.8 L145.6 99.1 L167.4 100.9 L189.9 102.8 L201.3 103.7', 'M-2.0 85.8 L19.6 83.1 L39.6 80.9 L59.2 80.7 L79.8 81.1 L100.7 81.5 L121.5 82.2 L142.3 83.6 L163.6 85.8 L185.9 88.2 L203.1 89.8', 'M-2.0 60.2 L15.1 57.0 L26.3 53.7 L38.7 48.3 L55.5 44.3 L72.9 43.7 L89.4 45.0 L104.9 47.3 L119.5 50.1 L133.1 53.1 L146.0 56.1 L158.1 58.8 L169.8 61.0 L181.5 62.6 L193.2 64.0 L199.1 64.6', 'M-2.0 46.4 L16.1 43.0 L28.9 39.9 L43.1 36.5 L59.0 34.3 L75.2 34.0 L90.9 34.9 L106.0 36.6 L120.3 38.7 L134.0 41.1 L147.1 43.5 L159.6 45.7 L171.8 47.6 L183.8 49.2 L195.8 50.6 L201.7 51.2', 'M-2.0 31.7 L17.0 28.6 L30.3 26.3 L44.6 24.2 L59.6 22.8 L74.8 22.4 L89.9 22.9 L104.6 24.1 L118.9 25.7 L132.6 27.5 L145.8 29.4 L158.6 31.2 L171.1 32.9 L183.4 34.3 L195.6 35.7 L201.7 36.3'] as d (d)}
			<path {d} fill="none" stroke={accent} stroke-width="1.3" opacity="0.55" />
		{/each}
		<path
			d="M159.7 70.2 L154.5 68.9 L146.0 66.4 L134.5 63.1 L121.1 59.5 L106.6 56.0 L91.9 53.2 L77.8 51.4 L65.0 50.7 L54.3 51.3 L46.2 52.9 L41.0 55.1 L39.3 57.8 L41.1 60.4 L46.5 62.6 L55.5 64.2 L67.5 65.2 L82.1 65.7 L98.4 65.9 L115.2 66.2 L131.1 66.9 L144.5 68.0 L154.1 69.2 L159.7 70.2 Z"
			fill="currentColor"
			opacity="0.8"
		/>
		<line x1="80" y1="50" x2="80" y2="14" stroke={accent} stroke-width="2.4" />
		<path d="M74 19 L80 9 L86 19 Z" fill={accent} />
	{:else}
		<circle cx="100" cy="60" r="30" fill="none" stroke={accent} stroke-width="2" />
		<circle cx="100" cy="60" r="5" fill={accent} />
	{/if}
</svg>

<style>
	.art {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
