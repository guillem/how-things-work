<script lang="ts">
	/**
	 * Doping silicon (steps `donor` and `acceptor`). The reader's crystal is kept per step in
	 * `params['dope:<step id>']`, one character per site ('.' silicon, 'P', 'A' arsenic,
	 * 'B'); `hints.start` puts one dopant in the middle at first. The chips at the top pick
	 * the dopant (`params['pick:<step id>']`, default `hints.pick`); clicking an atom
	 * swaps it.
	 *
	 * - A donor's fifth electron circles it loosely for a moment, then leaves as a free
	 *   electron (the donor becomes a fixed + ion); in the bands it rises from the donor
	 *   level, just below the conduction band, into the band.
	 * - An acceptor starts with one bond short of an electron: a hole. A neighbouring bond's
	 *   electron hops in (the acceptor becomes a fixed − ion), and the hole wanders on, hop
	 *   by hop. In the bands an electron rises from the valence band onto the acceptor level
	 *   and leaves a hole behind.
	 * - Donors and acceptors pair off (compensation): the donor's electron moves straight
	 *   into the acceptor's empty place, and neither leaves a free carrier.
	 * - With `params.field` (− left, + right) electrons drift right and holes left.
	 * - Each dopant's animation runs from the moment the reader places it, not from the step's
	 *   start, so a dopant added later still shows its electron leave or pair off.
	 *
	 * Level spacings are to scale (gap 1.12 eV, donor and acceptor levels 45–54 meV);
	 * the patch is not: real doping is far sparser.
	 */
	import { SvelteMap } from 'svelte/reactivity';
	import { hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		GAPS,
		IONISATION,
		elementName,
		patchCarriers,
		role,
		type Dopant,
		type Site
	} from '../model';
	import {
		bondDot,
		bondPath,
		bondsOf,
		dotsPath,
		holeAt,
		keySet,
		makeLattice,
		wander
	} from '../lattice';

	let { step, t, params, setParam, playing }: StageProps = $props();
	const drift = $derived(params.field !== false ? 22 : 0);
	const holeDir = $derived(params.field !== false ? -1 : 0);

	const L = makeLattice(7, 5, 80, 150, 60);
	const ATOM_R = 18;
	const bondsD = bondPath(L, ATOM_R);
	const CODE: Record<string, Site> = { '.': 'Si', P: 'P', A: 'As', B: 'B' };
	const CHAR: Record<Site, string> = { Si: '.', P: 'P', As: 'A', B: 'B' };
	const MIDDLE = 17;

	const key = $derived(`dope:${step.id}`);
	const pickKey = $derived(`pick:${step.id}`);
	const startSites = $derived.by(() => {
		const s = Array<Site>(L.atoms.length).fill('Si');
		const d = String(step.hints?.start ?? '');
		if (d === 'P' || d === 'As' || d === 'B') s[MIDDLE] = d;
		return s;
	});
	const sites = $derived.by((): Site[] => {
		const saved = params[key];
		if (typeof saved !== 'string' || saved.length !== L.atoms.length) return startSites;
		return saved.split('').map((c) => CODE[c] ?? 'Si');
	});
	const pick = $derived.by((): Dopant => {
		const v = String(params[pickKey] ?? step.hints?.pick ?? 'P');
		return v === 'As' || v === 'B' ? v : 'P';
	});
	const counts = $derived(patchCarriers(sites));

	/**
	 * When the reader placed each dopant (step time, keyed `<step id>:<site>`), so that its
	 * animation starts then rather than with the step. Sites never placed by a click, or
	 * placed before the step's clock restarted, count from the step's start.
	 */
	const placed = new SvelteMap<string, number>();
	const placedAt = (i: number) => {
		const p = placed.get(`${step.id}:${i}`);
		return p === undefined || p > t ? undefined : p;
	};
	/** Seconds since this site's dopant arrived. In reduced motion `t` is a frozen, finished frame
	 * and nothing is recorded (`playing` is false), so every dopant shows its end state. */
	const age = (i: number) => t - (placedAt(i) ?? 0);

	function toggle(i: number) {
		const next = sites.slice();
		next[i] = next[i] === 'Si' ? pick : 'Si';
		if (next[i] !== 'Si' && playing) placed.set(`${step.id}:${i}`, t);
		else placed.delete(`${step.id}:${i}`);
		setParam(key, next.map((s) => CHAR[s]).join(''));
	}
	const reset = () => {
		for (const k of [...placed.keys()]) if (k.startsWith(`${step.id}:`)) placed.delete(k);
		setParam(key, startSites.map((s) => CHAR[s]).join(''));
	};
	const onKey = (e: KeyboardEvent, act: () => void) => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		act();
	};

	// ---- carriers ----------------------------------------------------------------------------
	/** Dopants of one role, oldest first, so that a new dopant never re-pairs older ones. */
	const ofRole = (r: 'donor' | 'acceptor') =>
		L.atoms
			.filter((a) => role(sites[a.i]) === r)
			.map((a) => a.i)
			.sort((a, b) => (placedAt(a) ?? -1) - (placedAt(b) ?? -1) || a - b);
	const donors = $derived(ofRole('donor'));
	const acceptors = $derived(ofRole('acceptor'));
	const paired = $derived(Math.min(donors.length, acceptors.length));
	/** The bond of an acceptor that starts one electron short. */
	const emptyBond = (atom: number) => {
		const bs = bondsOf(L, atom);
		return bs[Math.floor(hash(atom, 4) * bs.length) % bs.length];
	};
	const FREE_AT = 0.9;
	const HOP = 1.0;

	const electrons = $derived(
		donors.slice(paired).map((d) => {
			const a = L.atoms[d];
			const s = age(d);
			const ang = s * 3.2 + d;
			const orbit = { x: a.x + 27 * Math.cos(ang), y: a.y + 27 * Math.sin(ang) };
			const start = {
				x: a.x + 27 * Math.cos(FREE_AT * 3.2 + d),
				y: a.y + 27 * Math.sin(FREE_AT * 3.2 + d)
			};
			const w = wander(L, start, Math.max(0, s - FREE_AT), d + 5, drift);
			const bound = s < FREE_AT;
			return {
				d,
				free: smoothstep(FREE_AT - 0.3, FREE_AT, s),
				x: bound ? orbit.x : w.x,
				y: bound ? orbit.y : w.y,
				opacity: bound ? 1 : w.opacity
			};
		})
	);
	const holes = $derived(
		acceptors.slice(paired).map((acc) => {
			const h = holeAt(L, emptyBond(acc), acc + 2, age(acc), HOP, holeDir);
			const a = bondDot(L, h.cur, 0);
			const b = bondDot(L, h.next, 0);
			const near = Math.hypot(a.x - b.x, a.y - b.y) < L.gap * 1.2;
			const hopping = near && h.p > 0 && h.p < 1;
			return {
				acc,
				cur: h.cur,
				next: h.next,
				x: near ? lerp(a.x, b.x, h.p) : a.x,
				y: near ? lerp(a.y, b.y, h.p) : a.y,
				hopper: hopping ? { x: lerp(b.x, a.x, h.p), y: lerp(b.y, a.y, h.p) } : null
			};
		})
	);
	/** Compensating pairs: the donor's electron moves into the acceptor's empty place. */
	const transfers = $derived(
		Array.from({ length: paired }, (_, k) => {
			const d = L.atoms[donors[k]];
			const slot = bondDot(L, emptyBond(acceptors[k]), 0);
			const u = smoothstep(0.4, 1.6, Math.min(age(donors[k]), age(acceptors[k])));
			return {
				k,
				d: donors[k],
				acc: acceptors[k],
				u,
				x: lerp(d.x + 20, slot.x, u),
				y: lerp(d.y - 20, slot.y, u) - Math.sin(u * Math.PI) * 30
			};
		})
	);
	const dots = $derived.by(() => {
		const miss: string[] = [];
		for (const h of holes) {
			miss.push(`${h.cur}:0`);
			if (h.hopper) miss.push(`${h.next}:0`);
		}
		for (const tr of transfers) if (tr.u < 1) miss.push(`${emptyBond(tr.acc)}:0`);
		return dotsPath(L, 3.4, keySet(miss));
	});
	/** Is this dopant a fixed ion yet? */
	const ionised = (atom: number) => {
		const di = donors.indexOf(atom);
		if (di >= 0) return di < paired ? transfers[di].u >= 1 : age(atom) >= FREE_AT;
		const ai = acceptors.indexOf(atom);
		return ai < paired ? transfers[ai].u >= 1 : age(atom) >= HOP;
	};

	// ---- bands ---------------------------------------------------------------------------------
	const BX0 = 560;
	const BX1 = 890;
	const EC = 240;
	const PX_PER_EV = 200 / GAPS.Si.gap;
	const EV = EC + PX_PER_EV * GAPS.Si.gap;
	const toBand = (x: number) =>
		BX0 + 16 + ((x - L.box.x0) / (L.box.x1 - L.box.x0)) * (BX1 - BX0 - 32);
	const level = (s: Site) =>
		role(s) === 'donor'
			? EC + PX_PER_EV * IONISATION[s as Dopant]
			: EV - PX_PER_EV * IONISATION[s as Dopant];
	const COLOR: Record<Site, string> = {
		Si: 'var(--semi-si)',
		P: 'var(--semi-donor)',
		As: 'var(--semi-arsenic)',
		B: 'var(--semi-acceptor)'
	};
	const CHIPS: { sym: Dopant; x: number; note: string }[] = [
		{ sym: 'P', x: 140, note: 'donor (5 e⁻)' },
		{ sym: 'As', x: 270, note: 'donor (5 e⁻)' },
		{ sym: 'B', x: 400, note: 'acceptor (3 e⁻)' }
	];
	const verdict = $derived(
		counts.electrons > 0
			? 'n-type: the moving charges are negative'
			: counts.holes > 0
				? 'p-type: the moving charges are positive holes'
				: counts.donors > 0
					? 'donors and acceptors cancel: no free carriers'
					: 'pure silicon: practically no free carriers'
	);
	const firstDonor = $derived(donors[0]);
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

<g>
	<!-- palette -->
	{@render txt(24, 47, 'Put in:', 13, { anchor: 'start', weight: 700 })}
	{#each CHIPS as c (c.sym)}
		<g
			class="chip"
			role="button"
			tabindex="0"
			aria-label="Choose {elementName(c.sym).toLowerCase()}"
			aria-pressed={pick === c.sym}
			onclick={() => setParam(pickKey, c.sym)}
			onkeydown={(e) => onKey(e, () => setParam(pickKey, c.sym))}
		>
			<rect
				x={c.x - 52}
				y="22"
				width="122"
				height="42"
				rx="10"
				fill="var(--surface)"
				stroke={pick === c.sym ? 'var(--focus)' : 'var(--border)'}
				stroke-width={pick === c.sym ? 2.5 : 1}
			/>
			<circle cx={c.x - 31} cy="43" r="13" fill={COLOR[c.sym]} />
			<text
				x={c.x - 31}
				y="47.5"
				text-anchor="middle"
				font-weight="700"
				style:font-size="12px"
				style:fill="#fff">{c.sym}</text
			>
			{@render txt(c.x - 12, 40, elementName(c.sym).toLowerCase(), 12, {
				anchor: 'start',
				weight: 600
			})}
			{@render txt(c.x - 12, 55, c.note, 10, { anchor: 'start', muted: true })}
		</g>
	{/each}
	<g
		class="chip"
		role="button"
		tabindex="0"
		aria-label="Start again"
		onclick={reset}
		onkeydown={(e) => onKey(e, reset)}
	>
		<rect
			x="480"
			y="22"
			width="62"
			height="42"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(511, 48, 'Reset', 12, { weight: 600 })}
	</g>

	<!-- battery plates -->
	<g opacity={drift ? 1 : 0.25}>
		<rect
			x={L.box.x0 - 24}
			y={L.box.y0}
			width="8"
			height={L.box.y1 - L.box.y0}
			rx="3"
			fill="var(--circ-low)"
		/>
		<rect
			x={L.box.x1 + 16}
			y={L.box.y0}
			width="8"
			height={L.box.y1 - L.box.y0}
			rx="3"
			fill="var(--circ-high)"
		/>
		{@render txt(L.box.x0 - 20, L.box.y0 - 8, '−', 18, { weight: 700 })}
		{@render txt(L.box.x1 + 20, L.box.y0 - 8, '+', 18, { weight: 700 })}
	</g>

	<!-- crystal -->
	<path d={bondsD} stroke="var(--semi-bond)" stroke-width="1.4" fill="none" />
	<path d={dots} fill="var(--semi-electron)" />
	{#each L.atoms as a (a.i)}
		{@const s = sites[a.i]}
		{@const dop = s !== 'Si'}
		<g
			class="atom"
			role="button"
			tabindex="0"
			aria-label={dop
				? `${elementName(s)} atom, row ${a.r + 1}, column ${a.c + 1}: put silicon back`
				: `Silicon atom, row ${a.r + 1}, column ${a.c + 1}: replace with ${elementName(pick).toLowerCase()}`}
			onclick={() => toggle(a.i)}
			onkeydown={(e) => onKey(e, () => toggle(a.i))}
		>
			<circle
				cx={a.x}
				cy={a.y}
				r={ATOM_R}
				fill={COLOR[s]}
				stroke={dop ? 'var(--stage-ink)' : 'var(--semi-si-edge)'}
				stroke-width={dop ? 1.8 : 1.2}
			/>
			<text
				x={a.x}
				y={a.y + 4.5}
				text-anchor="middle"
				font-weight="700"
				style:font-size="12px"
				style:fill={dop ? '#fff' : 'var(--stage-ink)'}>{s}</text
			>
		</g>
		{#if dop && ionised(a.i)}
			{@const donor = role(s) === 'donor'}
			{@render txt(a.x + 18, a.y - 12, donor ? '+' : '−', 16, {
				weight: 800,
				color: donor ? 'var(--semi-field)' : 'var(--semi-electron)'
			})}
		{/if}
	{/each}
	{#each transfers as tr (tr.k)}
		{#if tr.u < 1}
			<circle
				cx={tr.x}
				cy={tr.y}
				r="5"
				fill="var(--semi-electron)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/if}
	{/each}
	{#each holes as h (h.acc)}
		<circle
			cx={h.x}
			cy={h.y}
			r="6"
			fill="var(--stage-bg)"
			stroke="var(--semi-hole)"
			stroke-width="2.2"
		/>
		{#if h.hopper}
			<circle cx={h.hopper.x} cy={h.hopper.y} r="3.4" fill="var(--semi-electron)" />
		{/if}
	{/each}
	{#each electrons as e (e.d)}
		<circle
			cx={e.x}
			cy={e.y}
			r="5.5"
			fill="var(--semi-electron)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={e.opacity}
		/>
	{/each}

	<!-- readout -->
	{@render txt(275, 470, `Free electrons: ${counts.electrons}  ·  Holes: ${counts.holes}`, 15, {
		weight: 700
	})}
	{@render txt(275, 492, verdict, 13, { weight: 600 })}
	{@render txt(275, 522, 'Click an atom to swap it (or Tab to it and press Enter).', 12, {
		muted: true
	})}
	{@render txt(275, 540, 'Not to scale: real doping is one atom in thousands to billions.', 11, {
		muted: true
	})}

	<!-- bands -->
	{@render txt((BX0 + BX1) / 2, 104, 'Energy bands of the doped silicon', 14, { weight: 700 })}
	<rect
		x={BX0}
		y={EC - 100}
		width={BX1 - BX0}
		height="100"
		rx="4"
		fill="var(--semi-band)"
		stroke="var(--semi-band-edge)"
	/>
	<rect
		x={BX0}
		y={EV}
		width={BX1 - BX0}
		height="100"
		rx="4"
		fill="var(--semi-filled)"
		stroke="var(--semi-band-edge)"
	/>
	{@render txt((BX0 + BX1) / 2, EC - 76, 'conduction band', 13, { weight: 600 })}
	{@render txt((BX0 + BX1) / 2, EV + 84, 'valence band', 13, { weight: 600 })}
	<line
		x1={BX1 + 18}
		x2={BX1 + 18}
		y1={EC + 3}
		y2={EV - 3}
		stroke="var(--stage-ink-muted)"
		marker-start="url(#arrowhead)"
		marker-end="url(#arrowhead)"
	/>
	{@render txt(BX1 + 26, (EC + EV) / 2 - 4, '1.12', 12, { anchor: 'start', weight: 600 })}
	{@render txt(BX1 + 26, (EC + EV) / 2 + 12, 'eV', 11, { anchor: 'start', muted: true })}

	{#each [...donors, ...acceptors] as d (d)}
		{@const x = toBand(L.atoms[d].x)}
		{@const y = level(sites[d])}
		{@const donor = role(sites[d]) === 'donor'}
		<line x1={x - 12} x2={x + 12} y1={y} y2={y} stroke={COLOR[sites[d]]} stroke-width="3" />
		{#if ionised(d)}
			{@render txt(x + 18, y + (donor ? 9 : 2), donor ? '+' : '−', 14, {
				weight: 800,
				color: donor ? 'var(--semi-field)' : 'var(--semi-electron)'
			})}
			{#if !donor}
				<circle cx={x} cy={y - 6} r="4.5" fill="var(--semi-electron)" />
			{/if}
		{/if}
	{/each}
	<!-- compensating electrons fall from the donor level to the acceptor level -->
	{#each transfers as tr (tr.k)}
		{#if tr.u < 1}
			<circle
				cx={lerp(toBand(L.atoms[tr.d].x), toBand(L.atoms[tr.acc].x), tr.u)}
				cy={lerp(level(sites[tr.d]) - 6, level(sites[tr.acc]) - 6, tr.u)}
				r="4.5"
				fill="var(--semi-electron)"
			/>
		{/if}
	{/each}
	{#each electrons as e (e.d)}
		<circle
			cx={toBand(e.free < 1 ? L.atoms[e.d].x : e.x)}
			cy={lerp(level(sites[e.d]) - 6, EC - 14 - 26 * hash(e.d, 8), e.free)}
			r="5"
			fill="var(--semi-electron)"
			opacity={e.free < 1 ? 1 : e.opacity}
		/>
	{/each}
	{#each holes as h (h.acc)}
		{#if age(h.acc) >= HOP}
			<circle
				cx={toBand(h.x)}
				cy={EV + 14 + 26 * hash(h.acc, 8)}
				r="5"
				fill="var(--stage-bg)"
				stroke="var(--semi-hole)"
				stroke-width="2.2"
			/>
		{/if}
	{/each}

	{#if firstDonor !== undefined}
		{@const s = sites[firstDonor] as Dopant}
		{@render txt(
			BX0 + 4,
			EC + 34,
			`donor level (${s}): ${(IONISATION[s] * 1000).toFixed(0)} meV below the band`,
			12,
			{ anchor: 'start', muted: true }
		)}
	{/if}
	{#if acceptors.length}
		{@render txt(
			BX0 + 4,
			EV - 24,
			`acceptor level (B): ${(IONISATION.B * 1000).toFixed(0)} meV above the band`,
			12,
			{ anchor: 'start', muted: true }
		)}
	{/if}
	{@render txt((BX0 + BX1) / 2, 572, 'Gap and levels to scale.', 11, { muted: true })}
</g>

<style>
	.chip,
	.atom {
		cursor: pointer;
		outline: none;
	}
	.chip:focus-visible,
	.atom:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
	.atom:hover {
		opacity: 0.8;
	}
</style>
