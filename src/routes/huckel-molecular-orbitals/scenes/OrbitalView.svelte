<script lang="ts">
	/**
	 * A π system seen from above: the σ skeleton, and one molecular orbital drawn as a lobe on
	 * each atom (radius ∝ the coefficient's size, so area ∝ the electron's share, colour = its sign, the p orbital's upper lobe),
	 * with dashed marks where the orbital changes sign (its nodes). Optionally the π bond orders
	 * on the bonds, which also set the bonds' widths.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Solution } from '../huckel';
	import type { Pt } from './look';

	interface Props {
		sol: Solution;
		pts: Pt[];
		L: number;
		/** Orbital to draw, or null for the skeleton alone. */
		orbital: number | null;
		/** Coefficient drawn at the largest lobe size (the largest of the molecule's orbitals). */
		cRef?: number;
		/** Slow breathing of the lobes (1 = rest). */
		pulse?: number;
		orders?: boolean;
		/** Labels drawn on atoms (e.g. N), by index. */
		atomLabels?: Record<number, string>;
		/** Prefix for readout ids, unique per view in a scene. */
		tag?: string;
		/** Show the atoms' numbers next to them. */
		numbers?: boolean;
	}
	let {
		sol,
		pts,
		L,
		orbital,
		cRef,
		pulse = 1,
		orders = false,
		atomLabels = {},
		tag = 'mol',
		numbers = false
	}: Props = $props();

	const ring = $derived(sol.mol.ring && sol.mol.n >= 3);
	const center = $derived({
		x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
		y: pts.reduce((s, p) => s + p.y, 0) / pts.length
	});
	const ref = $derived(
		cRef ?? Math.max(...sol.orbitals.flatMap((o) => o.c.map((c) => Math.abs(c))))
	);
	const orb = $derived(orbital === null ? null : sol.orbitals[orbital]);
	const lobes = $derived(
		orb
			? orb.c.map((c, i) => ({
					i,
					x: pts[i].x,
					y: pts[i].y,
					r: (Math.abs(c) / ref) * 0.46 * L * pulse,
					pos: c > 0
				}))
			: []
	);

	/** Dashed marks across the skeleton where the orbital changes sign. */
	const nodes = $derived.by(() => {
		if (!orb) return [];
		const out: { k: string; x1: number; y1: number; x2: number; y2: number }[] = [];
		const h = 0.3 * L;
		const mark = (k: string, p: Pt, dir: Pt) => {
			const len = Math.hypot(dir.x, dir.y) || 1;
			const ux = (-dir.y / len) * h;
			const uy = (dir.x / len) * h;
			out.push({ k, x1: p.x - ux, y1: p.y - uy, x2: p.x + ux, y2: p.y + uy });
		};
		const c = orb.c;
		const zero = (v: number) => Math.abs(v) < 1e-9;
		sol.bonds.forEach(([i, j], b) => {
			if (zero(c[i]) || zero(c[j]) || c[i] * c[j] > 0) return;
			const u = Math.abs(c[i]) / (Math.abs(c[i]) + Math.abs(c[j]));
			const p = {
				x: pts[i].x + (pts[j].x - pts[i].x) * u,
				y: pts[i].y + (pts[j].y - pts[i].y) * u
			};
			mark(`b${b}`, p, { x: pts[j].x - pts[i].x, y: pts[j].y - pts[i].y });
		});
		c.forEach((v, i) => {
			if (!zero(v)) return;
			// The node passes through the atom: radially in a ring, across a chain.
			const dir = ring ? { x: center.y - pts[i].y, y: pts[i].x - center.x } : { x: 1, y: 0 };
			mark(`a${i}`, pts[i], dir);
		});
		return out;
	});

	const bonds = $derived(
		sol.bonds.map(([i, j], b) => {
			const p = sol.bondOrders[b];
			const mx = (pts[i].x + pts[j].x) / 2;
			const my = (pts[i].y + pts[j].y) / 2;
			if (!ring) {
				// A chain: straight above or below the bond, alternating, clear of the lobes.
				const up = b % 2 === 0 ? -1 : 1;
				return { b, i, j, p, lx: mx, ly: my + up * 0.62 * L + (up < 0 ? 0 : 9) };
			}
			// A ring: outwards.
			let nx = -(pts[j].y - pts[i].y);
			let ny = pts[j].x - pts[i].x;
			const len = Math.hypot(nx, ny) || 1;
			nx /= len;
			ny /= len;
			if (nx * (mx - center.x) + ny * (my - center.y) < 0) {
				nx = -nx;
				ny = -ny;
			}
			const off = 0.5 * L;
			return { b, i, j, p, lx: mx + nx * off, ly: my + ny * off + 4 };
		})
	);
	const atomR = $derived(Math.max(3, Math.min(6, L * 0.09)));
</script>

<g>
	<!-- lobes behind the skeleton -->
	{#each lobes as l (l.i)}
		{#if l.r > 0.5}
			<circle
				cx={l.x}
				cy={l.y}
				r={l.r}
				fill={l.pos ? 'var(--hk-pos)' : 'var(--hk-neg)'}
				fill-opacity="0.42"
				stroke={l.pos ? 'var(--hk-pos)' : 'var(--hk-neg)'}
				stroke-width="1.4"
			/>
		{/if}
	{/each}

	<!-- bonds -->
	{#each bonds as b (b.b)}
		<line
			x1={pts[b.i].x}
			y1={pts[b.i].y}
			x2={pts[b.j].x}
			y2={pts[b.j].y}
			stroke="var(--stage-ink)"
			stroke-width={orders ? 1.5 + 4.5 * Math.max(0, b.p) : 2.5}
			stroke-linecap="round"
			opacity="0.75"
		/>
	{/each}

	<!-- nodes -->
	{#each nodes as m (m.k)}
		<line
			x1={m.x1}
			y1={m.y1}
			x2={m.x2}
			y2={m.y2}
			stroke="var(--hk-node)"
			stroke-width="1.6"
			stroke-dasharray="4 3"
		/>
	{/each}

	<!-- atoms -->
	{#each pts as p, i (i)}
		{#if atomLabels[i]}
			<circle
				cx={p.x}
				cy={p.y}
				r="11"
				fill="var(--stage-bg)"
				stroke="var(--hk-n)"
				stroke-width="1.6"
			/>
			<text
				x={p.x}
				y={p.y + 4.5}
				text-anchor="middle"
				font-size="13"
				font-weight="700"
				fill="var(--hk-n)">{atomLabels[i]}</text
			>
		{:else}
			<circle cx={p.x} cy={p.y} r={atomR} fill="var(--stage-ink)" />
		{/if}
		{#if numbers}
			<Readout id="{tag}-num-{i}">
				<Label
					x={ring
						? p.x + ((p.x - center.x) / Math.hypot(p.x - center.x, p.y - center.y)) * 16
						: p.x}
					y={ring
						? p.y + ((p.y - center.y) / Math.hypot(p.x - center.x, p.y - center.y)) * 16 + 4
						: p.y + (i % 2 === 0 ? 20 : -12)}
					text={String(i + 1)}
					size={11}
					muted
				/>
			</Readout>
		{/if}
	{/each}

	<!-- bond orders -->
	{#if orders}
		{#each bonds as b (b.b)}
			<Readout id="{tag}-order-{b.b}">
				<Label x={b.lx} y={b.ly} text={b.p.toFixed(3)} size={11} tabular weight={600} />
			</Readout>
		{/each}
	{/if}
</g>
