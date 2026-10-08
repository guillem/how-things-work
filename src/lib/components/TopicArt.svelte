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
