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
