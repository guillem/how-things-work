<script lang="ts">
	/**
	 * Two atoms and the electrons between them (`step.hints.phase`):
	 * - share: two hydrogen atoms approach; their clouds overlap and the two electrons settle
	 *   between the nuclei as a shared pair; dashed circles show each atom's shell now
	 *   holding two. No orbits are drawn: electrons are dots in a cloud, as in the atoms
	 *   explainer.
	 * - tug: a bonded pair chosen with `params.pair`; the shared pair sits off-centre towards
	 *   the more electronegative atom by an amount that grows with ΔEN (illustrative), and
	 *   the ΔEN scale below shows the bond type bands (`bond()` in ../model.ts). Na–Cl
	 *   shows the electron handed over.
	 * - ionic: sodium's outer electron jumps to chlorine's one empty place; the ions attract,
	 *   and one layer of the salt crystal appears beside them. Shells (2,8,1 etc.) come from
	 *   the element data (`shellCounts`). Cl⁻ is drawn larger than Na⁺, as it is (Shannon
	 *   1976 ionic radii: 181 and 102 pm), without being to scale.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG presentation
	 * attributes.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { shellCounts } from '../../atoms-periodic-table/atom';
	import { bond, data, electronegativity, type Sym } from '../model';
	import { ATOM, NEG, POS } from '../look';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'share'));
	const time = $derived(reduced ? 2.5 : t);

	const cloudR = (s: Sym) => 38 + 0.3 * (data(s).radius ?? 70);
	const jitter = (k: number) => (reduced ? 0 : 2.2 * Math.sin(t * 2.3 + k * 2.1));

	// ---- tug -------------------------------------------------------------------------------------
	const PAIRS: Record<string, [Sym, Sym]> = {
		HH: ['H', 'H'],
		ClCl: ['Cl', 'Cl'],
		CH: ['C', 'H'],
		HCl: ['H', 'Cl'],
		HF: ['H', 'F'],
		NaCl: ['Na', 'Cl']
	};
	const pair = $derived(PAIRS[String(params.pair ?? 'HCl')] ?? PAIRS.HCl);
	const b = $derived(bond(pair[0], pair[1]));
	// −1: pair sits on the left atom, +1: on the right, 0: in the middle.
	const pullTarget = $derived(
		b.pulls === null
			? 0
			: (b.pulls === pair[1] ? 1 : -1) * (b.kind === 'ionic' ? 1 : clamp(b.dEN / 2.2, 0, 0.8))
	);
	const pull = Tween.of(() => pullTarget, { duration: 800, easing: cubicInOut });
	const ionicMix = Tween.of(() => (b.kind === 'ionic' ? 1 : 0), {
		duration: 800,
		easing: cubicInOut
	});
	const TX = 480;
	const TY = 230;
	const tugGap = $derived(lerp(170, 230, ionicMix.current));
	const scaleX = (d: number) => 140 + (d / 3.3) * 680;
	const BANDS = [
		{ from: 0, to: 0.4, label: 'pure covalent', fill: 'var(--stage-grid)' },
		{ from: 0.4, to: 1.8, label: 'polar covalent', fill: 'var(--focus)' },
		{ from: 1.8, to: 3.3, label: 'ionic', fill: NEG }
	];

	// ---- share -----------------------------------------------------------------------------------
	const approach = $derived(smoothstep(0.2, 1.6, time));
	const settle = $derived(smoothstep(1.4, 2.2, time));
	const hA = $derived(lerp(240, 430, approach));
	const hB = $derived(lerp(720, 530, approach));

	// ---- ionic -----------------------------------------------------------------------------------
	const NA = { x: 190, y: 250 };
	const CL = { x: 390, y: 250 };
	const hop = $derived(smoothstep(0.5, 1.5, time));
	const ions = $derived(smoothstep(1.4, 1.8, time));
	const lattice = $derived(
		Array.from({ length: 25 }, (_, i) => {
			const r = Math.floor(i / 5);
			const c = i % 5;
			return {
				i,
				x: 600 + c * 64,
				y: 130 + r * 64,
				na: (r + c) % 2 === 0,
				o: smoothstep(1.6 + r * 0.12, 1.85 + r * 0.12, time)
			};
		})
	);
	const shells = (z: number) => shellCounts(z).join(',');
	/** Shells after gaining (+1) or losing (−1) one outer electron. */
	const ionShells = (z: number, d: number) => {
		const s = shellCounts(z);
		s[s.length - 1] += d;
		return s.filter((n) => n > 0).join(',');
	};
	// Lewis dot spots around an atom (top, right, bottom, left; two per side).
	const spot = (k: number, r: number) => {
		const side = k % 4;
		const second = k >= 4;
		const off = second ? 6 : -6;
		const [dx, dy] = [
			[0, -1],
			[1, 0],
			[0, 1],
			[-1, 0]
		][side];
		return { x: dx * r + (dy !== 0 ? off : 0), y: dy * r + (dx !== 0 ? off : 0) };
	};
	// Chlorine's 7 dots leave the second place on its left side empty (index 7).
	const clDots = [0, 1, 2, 3, 4, 5, 6].map((k) => spot(k, 36));
	const slot = spot(7, 36);
	const electron = $derived.by(() => {
		const from = { x: NA.x + 36, y: NA.y };
		const to = { x: CL.x + slot.x, y: CL.y + slot.y };
		return {
			x: lerp(from.x, to.x, hop),
			y: lerp(from.y, to.y, hop) - Math.sin(hop * Math.PI) * 60
		};
	});
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet nucleus(x: number, y: number, sym: Sym, r = 20, label: string = sym)}
	<circle cx={x} cy={y} {r} fill={ATOM[sym].fill} stroke={ATOM[sym].edge} stroke-width="1.5" />
	<text
		{x}
		y={y + r * 0.38}
		text-anchor="middle"
		font-weight="700"
		style:font-size="{r * 0.95}px"
		style:fill={ATOM[sym].ink}>{label}</text
	>
{/snippet}

{#snippet cloud(x: number, y: number, r: number, tint: string | null, strength: number)}
	<circle cx={x} cy={y} {r} fill="var(--atom-electron)" fill-opacity="0.1" />
	<circle cx={x} cy={y} r={r * 0.62} fill="var(--atom-electron)" fill-opacity="0.08" />
	{#if tint}
		<circle cx={x} cy={y} {r} fill={tint} fill-opacity={0.3 * strength} />
	{/if}
{/snippet}

{#snippet dot(x: number, y: number, unpaired = false)}
	{#if unpaired}
		<circle cx={x} cy={y} r="8" fill="var(--atom-electron)" opacity="0.25" />
	{/if}
	<circle cx={x} cy={y} r="4.5" fill="var(--atom-electron)" stroke="var(--stage-bg)" />
{/snippet}

<g>
	{#if phase === 'share'}
		{@const r = cloudR('H')}
		{@const mid = (hA + hB) / 2}
		{@render cloud(hA, TY, r, null, 0)}
		{@render cloud(hB, TY, r, null, 0)}
		<!-- the shared pair's density between the nuclei -->
		<ellipse
			cx={mid}
			cy={TY}
			rx={40 * settle}
			ry={28 * settle}
			fill="var(--atom-electron)"
			fill-opacity={0.22 * settle}
		/>
		{@render nucleus(hA, TY, 'H')}
		{@render nucleus(hB, TY, 'H')}
		<!-- each atom's electron: on its own atom, then shared between them -->
		{@render dot(lerp(hA + 30, mid, settle), TY + lerp(0, -6, settle) + jitter(0), settle < 0.5)}
		{@render dot(lerp(hB - 30, mid, settle), TY + lerp(0, 6, settle) + jitter(1), settle < 0.5)}
		<!-- each shell now holds two -->
		{#each [hA, hB] as x, i (i)}
			<circle
				cx={x + (i === 0 ? 14 : -14)}
				cy={TY}
				r="64"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 5"
				opacity={settle}
			/>
		{/each}
		{@render txt(mid, TY - 92, 'shared pair', 13, { weight: 600 })}
		<line
			x1={mid}
			y1={TY - 84}
			x2={mid}
			y2={TY - 16}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity={settle}
		/>
		{@render txt(hA - 4, TY + 104, 'H: 2 electrons', 12, { muted: true })}
		{@render txt(hB + 4, TY + 104, 'H: 2 electrons', 12, { muted: true })}

		<!-- the equation, filling in as it happens -->
		<g transform="translate(480 420)">
			{@render txt(-210, 0, 'H·', 26, { weight: 700 })}
			{@render txt(-150, 0, '+', 22, { muted: true })}
			{@render txt(-90, 0, '·H', 26, { weight: 700 })}
			<g opacity={settle}>
				{@render txt(-20, 0, '→', 22, { muted: true })}
				{@render txt(55, 0, 'H:H', 26, { weight: 700 })}
				{@render txt(125, 0, '=', 22, { muted: true })}
				{@render txt(195, 0, 'H–H', 26, { weight: 700 })}
				{@render txt(55, 30, 'shared pair', 12, { muted: true })}
				{@render txt(195, 30, 'one bond = one line', 12, { muted: true })}
			</g>
		</g>
		{@render txt(
			480,
			530,
			'Each hydrogen counts both shared electrons: a full shell of two, like helium.',
			14,
			{
				weight: 600
			}
		)}
	{:else if phase === 'tug'}
		{@const [A, B] = pair}
		{@const xA = TX - tugGap / 2}
		{@const xB = TX + tugGap / 2}
		{@const s = Math.abs(pull.current)}
		{@const left = pull.current < 0}
		{@const px = lerp(TX, pull.current > 0 ? xB - 30 : xA + 30, s)}
		{@const ionic = ionicMix.current}
		{@render cloud(
			xA,
			TY,
			cloudR(A) * lerp(1, 0.7, ionic * (left ? 0 : 1)),
			s > 0.05 ? (left ? NEG : POS) : null,
			s
		)}
		{@render cloud(
			xB,
			TY,
			cloudR(B) * lerp(1, 0.7, ionic * (left ? 1 : 0)),
			s > 0.05 ? (left ? POS : NEG) : null,
			s
		)}
		<ellipse
			cx={px}
			cy={TY}
			rx={36 - 10 * ionic}
			ry="26"
			fill="var(--atom-electron)"
			fill-opacity={0.22}
		/>
		{@render nucleus(xA, TY, A, 22)}
		{@render nucleus(xB, TY, B, 22)}
		{@render dot(px + jitter(0) * 0.5, TY - 6 + jitter(1))}
		{@render dot(px - jitter(0) * 0.5, TY + 6 - jitter(1))}

		<!-- electronegativities and partial charges -->
		{#each [{ x: xA, s: A, sign: left ? -1 : 1 }, { x: xB, s: B, sign: left ? 1 : -1 }] as at, i (i)}
			{@render txt(at.x, TY - cloudR(at.s) - 38, `${data(at.s).name}`, 13, { weight: 600 })}
			{@render txt(
				at.x,
				TY - cloudR(at.s) - 20,
				`electronegativity ${electronegativity(at.s).toFixed(2)}`,
				12,
				{
					muted: true
				}
			)}
			{#if s > 0.05}
				{@const full = ionic > 0.5}
				{@render txt(
					at.x,
					TY + cloudR(at.s) + 26,
					full ? (at.sign < 0 ? '−' : '+') : at.sign < 0 ? 'δ−' : 'δ+',
					22,
					{ weight: 700, color: at.sign < 0 ? NEG : POS }
				)}
			{/if}
		{/each}

		<!-- the ΔEN scale -->
		<g transform="translate(0 440)">
			{#each BANDS as band (band.label)}
				<rect
					x={scaleX(band.from)}
					y="0"
					width={scaleX(band.to) - scaleX(band.from)}
					height="18"
					fill={band.fill}
					fill-opacity={band.label === 'pure covalent' ? 1 : 0.22}
					stroke="var(--border-strong)"
				/>
				{@render txt((scaleX(band.from) + scaleX(band.to)) / 2, 38, band.label, 12, {
					weight:
						b.kind ===
						(band.label === 'pure covalent'
							? 'nonpolar'
							: band.label === 'polar covalent'
								? 'polar'
								: 'ionic')
							? 700
							: 500
				})}
			{/each}
			{#each [0, 0.4, 1.8, 3.3] as v (v)}
				{@render txt(scaleX(v), 56, v.toFixed(1), 11, { muted: true })}
			{/each}
			{@render txt(scaleX(0) - 12, 14, 'ΔEN', 12, { anchor: 'end', weight: 600 })}
			<path
				d="M{scaleX(b.dEN)} -2 l-8 -12 h16 z"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
			/>
			{@render txt(scaleX(b.dEN), -20, b.dEN.toFixed(2), 14, { weight: 700 })}
		</g>
		{@render txt(
			480,
			540,
			b.dEN === 0
				? `${A}–${B}: identical atoms share equally (difference 0).`
				: `${A}–${B}: difference ${electronegativity(b.pulls === A ? A : B).toFixed(2)} − ${electronegativity(b.pulls === A ? B : A).toFixed(2)} = ${b.dEN.toFixed(2)}: ${b.kind === 'nonpolar' ? 'practically equal sharing' : b.kind === 'polar' ? 'a polar covalent bond' : 'the electron is handed over (ionic)'}`,
			14,
			{ weight: 600 }
		)}
		{@render txt(
			480,
			562,
			'Bands: a rough guide (OpenStax Chemistry 2e); real bonds change gradually.',
			11,
			{
				muted: true
			}
		)}
	{:else}
		<!-- ionic: the electron hop -->
		{@const naR = lerp(cloudR('Na'), 46, ions)}
		{@const clR = cloudR('Cl')}
		{@render cloud(NA.x, NA.y, naR, ions > 0.5 ? POS : null, ions)}
		{@render cloud(CL.x, CL.y, clR, ions > 0.5 ? NEG : null, ions)}
		{@render nucleus(NA.x, NA.y, 'Na', 22, ions > 0.5 ? 'Na⁺' : 'Na')}
		{@render nucleus(CL.x, CL.y, 'Cl', 22, ions > 0.5 ? 'Cl⁻' : 'Cl')}
		{#each clDots as d, k (k)}
			<circle cx={CL.x + d.x} cy={CL.y + d.y} r="4" fill="var(--stage-ink)" />
		{/each}
		<circle
			cx={CL.x + slot.x}
			cy={CL.y + slot.y}
			r="5"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 2"
			opacity={1 - hop}
		/>
		{@render dot(electron.x, electron.y, hop < 0.99)}
		<!-- attraction -->
		<g opacity={smoothstep(1.7, 2.1, time)}>
			<line
				x1={NA.x + 62}
				y1={NA.y + 95}
				x2={CL.x - 62}
				y2={CL.y + 95}
				stroke="var(--stage-ink)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
				marker-start="url(#arrowhead)"
			/>
			{@render txt((NA.x + CL.x) / 2, NA.y + 125, 'opposite charges attract', 13, { weight: 600 })}
		</g>
		{@render txt(NA.x, 110, ions > 0.5 ? `Na⁺ (${ionShells(11, -1)})` : `Na (${shells(11)})`, 15, {
			weight: 700
		})}
		{@render txt(CL.x, 110, ions > 0.5 ? `Cl⁻ (${ionShells(17, 1)})` : `Cl (${shells(17)})`, 15, {
			weight: 700
		})}
		{@render txt(NA.x, 130, ions > 0.5 ? 'gave its outer electron' : 'one outer electron', 12, {
			muted: true
		})}
		{@render txt(CL.x, 130, ions > 0.5 ? 'full outer shell of 8' : 'one short of 8', 12, {
			muted: true
		})}
		{@render txt(290, 470, 'electrons per shell, from the element data', 11, { muted: true })}

		<!-- one layer of the salt crystal -->
		{#each lattice as c (c.i)}
			<g opacity={c.o}>
				<circle
					cx={c.x}
					cy={c.y}
					r={c.na ? 15 : 24}
					fill={c.na ? ATOM.Na.fill : ATOM.Cl.fill}
					stroke={c.na ? ATOM.Na.edge : ATOM.Cl.edge}
					stroke-width="1.2"
				/>
				<text
					x={c.x}
					y={c.y + 4}
					text-anchor="middle"
					font-weight="700"
					style:font-size="{c.na ? 10 : 11}px"
					style:fill="#ffffff">{c.na ? 'Na⁺' : 'Cl⁻'}</text
				>
			</g>
		{/each}
		<g opacity={smoothstep(2.0, 2.4, time)}>
			{@render txt(728, 450, 'Table salt: one layer of the crystal', 13, { weight: 600 })}
			{@render txt(728, 469, 'each Na⁺ surrounded by Cl⁻, and each Cl⁻ by Na⁺', 12, {
				muted: true
			})}
			{@render txt(728, 486, '(ions not to scale)', 11, { muted: true })}
		</g>
		{@render txt(480, 555, 'Na· + ·Cl  →  Na⁺ + Cl⁻   (an ionic bond)', 16, { weight: 700 })}
	{/if}
</g>
