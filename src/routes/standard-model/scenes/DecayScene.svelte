<script lang="ts">
	/**
	 * The decay checker. Top: parent → up to four products (tap a product to take it out).
	 * Middle: the ledger of conservation laws, before and after, each ticked or crossed by the
	 * model's `checkDecay()`. Right: the verdict, and what the PDG says about this exact decay
	 * (its measured share of decays, or the upper limit from searches). Bottom: a palette of
	 * fourteen particles to add.
	 *
	 * The parent is `step.hints.parent`, or the `parent` control when the hint is "param".
	 * State: `params['sm:decay']` = "parent|p,e-,nubar_e". When the parent changes, or the
	 * `resetDecay` button is pressed (count kept in `sm:resetSeen`), the products go back to the
	 * parent's most common real decay.
	 */
	import { untrack } from 'svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		MAX_PRODUCTS,
		PRODUCTS,
		checkDecay,
		decayParticle,
		mainMode,
		massText,
		protonToPositronPion,
		sci,
		type DecayParticle
	} from '../particles';
	import T from './T.svelte';
	import Card from './Card.svelte';
	import Pad from './Pad.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const parentKey = $derived(
		step.hints?.parent === 'param'
			? String(params.parent ?? 'n')
			: String(step.hints?.parent ?? 'n')
	);
	const parent = $derived(decayParticle(parentKey));

	// ---- state -----------------------------------------------------------------------
	const stored = $derived(String(params['sm:decay'] ?? ''));
	const products = $derived.by((): string[] => {
		const [p, list] = stored.split('|');
		if (p !== parentKey) return [...mainMode(parentKey)];
		return (list ?? '')
			.split(',')
			.filter((k) => (PRODUCTS as readonly string[]).includes(k))
			.slice(0, MAX_PRODUCTS);
	});
	const save = (list: readonly string[]) => setParam('sm:decay', `${parentKey}|${list.join(',')}`);
	$effect(() => {
		const p = parentKey;
		untrack(() => {
			if (stored.split('|')[0] !== p) save(mainMode(p));
		});
	});
	const resets = $derived(Number(params.resetDecay ?? 0));
	$effect(() => {
		const n = resets;
		untrack(() => {
			const seen = Number(params['sm:resetSeen'] ?? 0);
			if (n === seen) return;
			setParam('sm:resetSeen', n);
			if (n > seen) save(mainMode(parentKey));
		});
	});
	const add = (k: string) => products.length < MAX_PRODUCTS && save([...products, k]);
	const remove = (i: number) => save(products.filter((_, j) => j !== i));

	const check = $derived(checkDecay(parentKey, products));

	// ---- text ------------------------------------------------------------------------------
	const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
	const mev = (v: number) => (v === 0 ? '0' : v < 1 ? `${v.toFixed(3)} MeV` : massText(v));
	const lawRows = $derived(
		check.laws.map((l) => {
			if (l.id === 'energy')
				return {
					...l,
					b: mev(l.before),
					a: mev(l.after),
					why: l.ok ? 'products lighter' : products.length ? 'products too heavy' : ''
				};
			if (l.id === 'spin')
				return {
					...l,
					b: `${l.before} × ½`,
					a: `${l.after} × ½`,
					why: l.ok ? 'odd/even matches' : 'odd/even differs'
				};
			return { ...l, b: sign(l.before), a: sign(l.after), why: '' };
		})
	);
	const broken = $derived(check.laws.filter((l) => !l.ok).map((l) => l.label.toLowerCase()));
	const verdict = $derived(
		products.length === 0
			? 'Add products from the palette'
			: check.allowed
				? 'Not forbidden by these laws'
				: 'Forbidden'
	);
	const reasons = $derived.by((): string[] => {
		if (products.length === 0) return [];
		const out: string[] = [];
		if (!check.enoughProducts) out.push('a particle at rest can’t turn into just one');
		if (broken.length) out.push(`breaks: ${broken.join(', ')}`);
		return out;
	});
	const name = (k: string) => decayParticle(k).label;
	const pctText = (f: number) =>
		f > 0.999
			? `${(f * 100).toFixed(2)}%`
			: f >= 0.01
				? `${Number((f * 100).toPrecision(3))}%`
				: sci(f, 2);
	const equation = $derived(`${parent.label} → ${products.map(name).join(' ') || '?'}`);
	const pdgLines = $derived.by((): string[] => {
		const m = check.mode;
		if (
			parentKey === 'p' &&
			products.length === 2 &&
			products.includes('e+') &&
			products.includes('pi0')
		)
			return [
				'Searched for: if the proton decays',
				`this way, it lives more than`,
				`${sci(protonToPositronPion.years, 2)} years.`
			];
		if (m && m.limit)
			return ['Searched for, never seen:', `below ${sci(m.fraction, 2)} of decays.`];
		if (m)
			return [
				'Observed (PDG):',
				m.approx ? 'essentially every decay' : `${pctText(m.fraction)} of decays`
			];
		if (!products.length) return [];
		if (check.allowed)
			return [
				'Not in the PDG’s list of this',
				'particle’s decays: rare, if it happens,',
				'or blocked by a rule not checked here.'
			];
		return ['Never seen.'];
	});
	const strangeNote = $derived(
		check.allowed && check.strangeness.before !== check.strangeness.after
			? [
					`Strangeness changes (${sign(check.strangeness.before)} → ${sign(check.strangeness.after)}):`,
					'only the weak force can do that,',
					'so this decay is slow.'
				]
			: []
	);

	// ---- drawing -------------------------------------------------------------------------
	const kindColour = (p: DecayParticle) =>
		p.B !== 0 || p.key.startsWith('pi') || p.key === 'K+'
			? 'var(--sm-quark)'
			: p.key === 'gamma'
				? 'var(--sm-boson)'
				: 'var(--sm-lepton)';
	const PX = 84;
	const PY = 98;
	const SLOT = (i: number) => 262 + i * 90;
	const bob = (i: number) => (reduced || !check.allowed ? 0 : 3 * Math.sin(t * 2.2 + i * 1.4));
	const dash = $derived(reduced ? 0 : -t * 24);
	const VX = 640;
	const KX = (i: number) => 40 + i * 84;
</script>

<g>
	<!-- the decay -->
	<Readout id="equation" order={1} label="Decay" value={equation} />
	<circle cx={PX} cy={PY} r="38" fill={kindColour(parent)} />
	<text
		x={PX}
		y={PY + 9}
		text-anchor="middle"
		font-weight="700"
		style:font-size="26px"
		style:fill="var(--sm-ball-ink)">{parent.label}</text
	>
	<line
		x1={138}
		x2={206}
		y1={PY}
		y2={PY}
		stroke={products.length && !check.allowed ? 'var(--sm-bad)' : 'var(--stage-ink-muted)'}
		stroke-width="3"
		stroke-dasharray={check.allowed ? '9 6' : undefined}
		stroke-dashoffset={dash}
		marker-end="url(#arrowhead)"
	/>
	{#if products.length && !check.allowed}
		<path
			d="M164 {PY - 12} l16 24 M180 {PY - 12} l-16 24"
			stroke="var(--sm-bad)"
			stroke-width="3.5"
			stroke-linecap="round"
		/>
	{/if}
	{#each Array.from({ length: MAX_PRODUCTS }, (_, i) => i) as i (i)}
		{#if i < products.length}
			{@const p = decayParticle(products[i])}
			<g
				class="prod"
				role="button"
				tabindex="0"
				aria-label="{p.label}: take it out"
				onclick={() => remove(i)}
				onkeydown={(e) => {
					if (e.key !== 'Enter' && e.key !== ' ') return;
					e.preventDefault();
					e.stopPropagation();
					remove(i);
				}}
				transform="translate({SLOT(i)} {PY + bob(i)})"
			>
				<circle class="ring" r="38" />
				<circle r="33" fill={kindColour(p)} />
				<text
					y="8"
					text-anchor="middle"
					font-weight="700"
					style:font-size="22px"
					style:fill="var(--sm-ball-ink)">{p.label}</text
				>
			</g>
		{:else}
			<circle
				cx={SLOT(i)}
				cy={PY}
				r="33"
				fill="none"
				stroke="var(--border)"
				stroke-width="1.5"
				stroke-dasharray="5 5"
			/>
		{/if}
	{/each}
	<Readout id="tap-hint">
		<T
			x={SLOT(0) - 33}
			y={PY + 60}
			text="tap a product to take it out · four at most"
			size={12}
			muted
		/>
	</Readout>

	<!-- the ledger -->
	<Readout id="card-1"><Card x={20} y={180} w={588} h={232} /></Readout>
	<T x={40} y={206} text="Conserved?" size={12} muted />
	<T x={250} y={206} text="before" size={12} muted anchor="middle" />
	<T x={380} y={206} text="after" size={12} muted anchor="middle" />
	{#each lawRows as l, r (l.id)}
		{@const y = 236 + r * 28}
		<Readout id="law-{l.id}">
			<T x={40} {y} text={l.label} size={13.5} weight={600} />
			<T x={250} {y} text={l.b} size={13.5} anchor="middle" />
			<T x={380} {y} text={products.length ? l.a : '—'} size={13.5} anchor="middle" />
			{#if products.length}
				<T
					x={470}
					{y}
					text={l.ok ? '✓' : '✗'}
					size={17}
					weight={700}
					color={l.ok ? 'var(--sm-ok)' : 'var(--sm-bad)'}
				/>
				<T x={494} {y} text={l.why} size={11} muted />
			{/if}
		</Readout>
	{/each}
	<Readout
		id="laws"
		order={2}
		label="Laws"
		value={products.length
			? check.laws.map((l) => `${l.label} ${l.ok ? '✓' : '✗'}`).join(' · ')
			: '—'}
	/>
	<Readout id="ledger-foot">
		<T
			x={40}
			y={402}
			text="Energy: masses, with neutrinos taken as 0 (below 0.45 eV). Spin: how many have spin ½."
			size={11}
			muted
		/>
	</Readout>

	<!-- verdict -->
	<Readout id="card-2"><Card x={VX - 16} y={24} w={336} h={388} /></Readout>
	<Readout
		id="verdict"
		order={0}
		label="Verdict"
		value={verdict}
		note={reasons.join('; ')}
		color={products.length ? (check.allowed ? 'var(--sm-ok)' : 'var(--sm-bad)') : undefined}
	>
		<T
			x={VX}
			y={60}
			text={verdict}
			size={verdict.length > 20 ? 17 : 22}
			weight={700}
			color={products.length ? (check.allowed ? 'var(--sm-ok)' : 'var(--sm-bad)') : undefined}
		/>
		{#each reasons as line, i (i)}
			<T x={VX} y={84 + i * 18} text={line} size={12.5} />
		{/each}
		{#if check.allowed}
			<T x={VX} y={84} text="Energy released: {mev(check.q)}" size={12.5} />
			<T x={VX} y={102} text="(carried off as motion)" size={12} muted />
		{/if}
	</Readout>
	<Readout id="pdg" order={3} label="PDG" value={pdgLines.join(' ')}>
		{#each pdgLines as line, i (i)}
			<T x={VX} y={150 + i * 19} text={line} size={13} weight={i === 0 ? 600 : 500} />
		{/each}
	</Readout>
	<Readout
		id="strange"
		order={4}
		label="Strangeness"
		value={strangeNote.join(' ')}
		opacity={strangeNote.length ? 1 : 0}
	>
		{#each strangeNote as line, i (i)}
			<T x={VX} y={250 + i * 18} text={line} size={12.5} color="var(--sm-weak)" />
		{/each}
	</Readout>
	<Readout id="pdg-cite">
		<T x={VX} y={394} text="Decay data: PDG 2026" size={11} muted />
	</Readout>

	<!-- palette -->
	{#each PRODUCTS as k, i (k)}
		{@const p = decayParticle(k)}
		<Pad
			x={KX(i % 7)}
			y={i < 7 ? 438 : 512}
			w={76}
			h={62}
			label={p.label}
			sub={p.charge > 0 ? '+1' : p.charge < 0 ? '−1' : '0'}
			ink={kindColour(p)}
			edge={kindColour(p)}
			size={21}
			disabled={products.length >= MAX_PRODUCTS}
			ariaLabel="Add {p.label}"
			onpress={() => add(k)}
		/>
	{/each}
	<Readout id="palette-note">
		<T x={KX(7) + 8} y={470} text="hadrons" size={12} color="var(--sm-quark)" weight={600} />
		<T x={KX(7) + 8} y={490} text="leptons" size={12} color="var(--sm-lepton)" weight={600} />
		<T x={KX(7) + 8} y={510} text="photon" size={12} color="var(--sm-boson)" weight={600} />
		<T x={KX(7) + 8} y={540} text="numbers: charge" size={11} muted />
	</Readout>
</g>

<style>
	.prod {
		cursor: pointer;
		outline: none;
	}
	.prod .ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 3;
		opacity: 0;
	}
	.prod:focus-visible .ring {
		opacity: 1;
	}
</style>
