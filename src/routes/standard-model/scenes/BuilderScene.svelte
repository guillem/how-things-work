<script lang="ts">
	/**
	 * The hadron builder. Left: a "bag" holding up to three quarks or antiquarks, each a ball in
	 * its colour charge (antiquarks in the anticolour, with a bar), tied by gluon coils; under it
	 * a palette of the six quarks and six antiquarks. Tapping a palette key adds one, tapping a
	 * ball takes it out. Right: what the combination is (the lightest PDG hadron with those
	 * quarks), its charge as a sum of the quarks' charges, the colour check, the baryon number,
	 * the quarks' share of its mass and its lifetime. `step.hints.focus` (charge, colour, mass,
	 * zoo) brings one section forward.
	 *
	 * State: `params['sm:build']` ("u,u,d"; antiquarks "~d"), set from the `preset` control
	 * when it changes (`sm:applied` remembers the preset last applied, so a remount neither
	 * re-applies it nor loses the reader's own build) or by the palette, which sets the preset
	 * to "custom".
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		FLAVOURS,
		MAX_TOKENS,
		PRESETS,
		combine,
		flavourOf,
		isAnti,
		lifeText,
		massText,
		parseTokens,
		quarkMass,
		symbolOf,
		charge3Of,
		type Token
	} from '../particles';
	import { chargeColour, coil, colourName } from './shared';
	import T from './T.svelte';
	import Card from './Card.svelte';
	import Pad from './Pad.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'charge'));

	// ---- state -----------------------------------------------------------------------
	const tokens = $derived(
		parseTokens(
			typeof params['sm:build'] === 'string'
				? params['sm:build']
				: (PRESETS[String(params.preset ?? 'proton')] ?? PRESETS.proton).join(',')
		).slice(0, MAX_TOKENS)
	);
	const build = $derived(combine(tokens));

	const pop = new Tween(1, { duration: 450, easing: cubicOut });
	function bump() {
		pop.set(0, { duration: 0 });
		pop.set(1, { duration: reduced ? 0 : 450 });
	}
	function save(next: Token[]) {
		setParam('sm:build', next.join(','));
		setParam('preset', 'custom');
		setParam('sm:applied', 'custom');
		bump();
	}
	const presetName = $derived(String(params.preset ?? 'proton'));
	$effect(() => {
		const p = presetName;
		untrack(() => {
			if (p === 'custom' || params['sm:applied'] === p || !PRESETS[p]) return;
			setParam('sm:applied', p);
			setParam('sm:build', PRESETS[p].join(','));
			bump();
		});
	});

	const add = (tok: Token) => tokens.length < MAX_TOKENS && save([...tokens, tok]);
	const remove = (i: number) => save(tokens.filter((_, j) => j !== i));

	// ---- text helpers ------------------------------------------------------------------
	const FRAC: Record<number, string> = { 1: '⅓', 2: '⅔' };
	function frac(n3: number, sign = true): string {
		const s = n3 > 0 ? (sign ? '+' : '') : n3 < 0 ? '−' : '';
		const a = Math.abs(n3);
		if (a === 0) return '0';
		if (a % 3 === 0) return `${s}${a / 3}`;
		return `${s}${FRAC[a] ?? `${a}/3`}`;
	}
	const chargeSum = $derived(
		tokens.length
			? `${tokens.map((tk) => frac(charge3Of(tk))).join(' ')} = ${frac(build.charge3)}`
			: '—'
	);
	const baryonSum = $derived(
		tokens.length
			? `${tokens.map((tk) => (isAnti(tk) ? '−⅓' : '+⅓')).join(' ')} = ${frac(build.baryon3)}`
			: '—'
	);
	const kindText = $derived(
		{
			empty: 'Add quarks from the palette',
			coloured: 'Not colourless: cannot exist alone',
			baryon: 'A baryon: three quarks',
			antibaryon: 'An antibaryon: three antiquarks',
			meson: 'A meson: a quark and an antiquark'
		}[build.kind]
	);
	const nameText = $derived(
		build.status === 'known' && build.hadron
			? build.hadron.name
			: build.status === 'unobserved'
				? 'Not yet observed'
				: build.status === 'top'
					? 'No hadron (top quark)'
					: build.kind === 'empty'
						? 'An empty bag'
						: 'Not a particle'
	);
	const statusLines = $derived.by((): string[] => {
		if (build.status === 'unobserved')
			return ['Allowed by the rules, but no hadron', 'with these quarks is firmly established.'];
		if (build.status === 'top')
			return ['The top quark decays in about', '5 × 10⁻²⁵ s, before it can be bound.'];
		if (build.kind === 'coloured')
			return [
				'The strong force lets only colourless',
				'combinations out: qqq, q̄q̄q̄ or qq̄.'
			];
		const h = build.hadron;
		if (!h) return [];
		const out: string[] = [];
		if (h.note) out.push(`${h.name}: ${h.note}`);
		if (h.sibling) out.push(`Same quarks, heavier: ${h.sibling}`);
		return out;
	});
	const colourCheck = $derived(
		build.kind === 'empty'
			? '—'
			: build.neutral
				? build.kind === 'meson'
					? 'colour + anticolour ✓'
					: build.kind === 'antibaryon'
						? 'one of each anticolour ✓'
						: 'one of each colour ✓'
				: 'not colourless ✗'
	);
	const spinText = $derived.by(() => {
		const s = build.hadron?.data.spin;
		if (!s) return '';
		if (s === '?') return 'spin not yet measured';
		return `spin ${s.replace('1/2', '½').replace('3/2', '3⁄2')}`;
	});
	const lifeLine = $derived.by(() => {
		const h = build.hadron;
		if (!h) return '';
		if (h.data.name === 'K⁰') return 'mixes into K_S and K_L';
		if (h.data.name === 'proton') return 'stable (more than 9 × 10²⁹ years)';
		const l = h.data.life;
		const e = l?.estimate ? ' (PDG estimate)' : '';
		return `lives ${lifeText(l)}${e}`;
	});
	const share = $derived(
		build.hadron ? Math.min(1, build.quarkMass / build.hadron.data.mass.v) : 0
	);
	const pct = (x: number) =>
		x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`;
	const quarkMassText = $derived(
		tokens.length ? tokens.map((tk) => massText(quarkMass(flavourOf(tk)))).join(' + ') : ''
	);

	// ---- the bag -------------------------------------------------------------------------
	const BX = 250;
	const BY = 210;
	const BR = 160;
	const BALL = 40;
	const SLOTS: Record<number, [number, number][]> = {
		0: [],
		1: [[BX, BY]],
		2: [
			[BX - 70, BY],
			[BX + 70, BY]
		],
		3: [
			[BX, BY - 74],
			[BX - 76, BY + 50],
			[BX + 76, BY + 50]
		]
	};
	const jig = (i: number, s: number) =>
		reduced ? 0 : 4 * Math.sin(t * 2.3 + i * 2.1 + s) + 2 * Math.sin(t * 3.7 + i * 1.3 + s * 2);
	const balls = $derived(
		tokens.map((tk, i) => {
			const [x, y] = SLOTS[tokens.length][i];
			return {
				i,
				tk,
				x: x + jig(i, 0),
				y: y + jig(i, 1.7),
				anti: isAnti(tk),
				colour: build.colours[i]
			};
		})
	);
	const springs = $derived.by(() => {
		const out: { key: string; d: string }[] = [];
		for (let a = 0; a < balls.length; a++)
			for (let b = a + 1; b < balls.length; b++) {
				const p = balls[a];
				const q = balls[b];
				const len = Math.hypot(q.x - p.x, q.y - p.y);
				const ux = (q.x - p.x) / len;
				const uy = (q.y - p.y) / len;
				out.push({
					key: `${a}-${b}`,
					d: coil(
						p.x + ux * BALL,
						p.y + uy * BALL,
						q.x - ux * BALL,
						q.y - uy * BALL,
						Math.max(2, Math.round((len - 2 * BALL) / 14)),
						6
					)
				});
			}
		return out;
	});
	const scale = $derived(0.6 + 0.4 * pop.current);

	// ---- palette -----------------------------------------------------------------------
	const KW = 66;
	const KH = 60;
	const KX = (i: number) => 96 + i * 78;
	const full = $derived(tokens.length >= MAX_TOKENS);

	// ---- right-hand card -------------------------------------------------------------------
	const CX = 640;
	const sectionOpacity = (s: string) =>
		focus === 'zoo' || focus === s ? 1 : 0.5;
</script>

<g>
	<!-- the bag -->
	<circle
		cx={BX}
		cy={BY}
		r={BR}
		fill={build.neutral ? 'var(--sm-field)' : 'none'}
		opacity={build.neutral ? 0.75 : 1}
		stroke={build.kind === 'coloured' ? 'var(--sm-bad)' : 'var(--border)'}
		stroke-width={build.kind === 'coloured' ? 2.5 : 1.5}
		stroke-dasharray={build.kind === 'coloured' ? '8 6' : undefined}
	/>
	{#each springs as s (s.key)}
		<path
			d={s.d}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			opacity={build.neutral ? 0.8 : 0.35}
		/>
	{/each}
	{#each balls as b (b.i + b.tk)}
		{@const fill = chargeColour(b.colour, b.anti)}
		<g
			class="ball"
			role="button"
			tabindex="0"
			aria-label="{symbolOf(b.tk)} ({colourName(b.colour, b.anti)}): take it out"
			onclick={() => remove(b.i)}
			onkeydown={(e) => {
				if (e.key !== 'Enter' && e.key !== ' ') return;
				e.preventDefault();
				e.stopPropagation();
				remove(b.i);
			}}
			transform="translate({b.x} {b.y}) scale({b.i === tokens.length - 1 ? scale : 1})"
		>
			<circle class="ring" r={BALL + 5} />
			<circle r={BALL} {fill} stroke="var(--stage-bg)" stroke-width="3" />
			{#if b.anti}
				<circle r={BALL - 7} fill="none" stroke="var(--sm-ball-ink)" stroke-width="2" stroke-dasharray="4 4" />
			{/if}
			<text y="4" text-anchor="middle" font-weight="700" style:font-size="30px" style:fill="var(--sm-ball-ink)"
				>{symbolOf(b.tk)}</text
			>
			<text y="24" text-anchor="middle" style:font-size="13px" style:fill="var(--sm-ball-ink)"
				>{frac(charge3Of(b.tk))}</text
			>
		</g>
	{/each}
	{#if build.kind === 'empty'}
		<T x={BX} y={BY + 5} text="Tap a quark below to add it" anchor="middle" muted />
	{/if}
	<Readout id="bag-hint">
		<T
			x={BX}
			y={BY + BR + 26}
			text={full ? 'Full: tap a quark in the bag to take it out' : 'Tap a quark in the bag to take it out'}
			anchor="middle"
			size={12}
			muted
			opacity={tokens.length ? 1 : 0}
		/>
	</Readout>

	<!-- palette -->
	<Readout id="palette-titles">
		<T x={24} y={428 + KH / 2} text="quarks" size={12} muted />
		<T x={24} y={506 + KH / 2} text="anti-" size={12} muted />
		<T x={24} y={506 + KH / 2 + 15} text="quarks" size={12} muted />
	</Readout>
	{#each FLAVOURS as f, i (f)}
		<Pad
			x={KX(i)}
			y={420}
			w={KW}
			h={KH}
			label={f}
			sub={frac(charge3Of(f))}
			fill="var(--sm-quark)"
			ink="#fff"
			edge="var(--sm-quark)"
			size={24}
			disabled={full}
			ariaLabel="Add an {f} quark"
			onpress={() => add(f)}
		/>
		<Pad
			x={KX(i)}
			y={498}
			w={KW}
			h={KH}
			label={symbolOf(`~${f}`)}
			sub={frac(-charge3Of(f))}
			ink="var(--sm-quark)"
			edge="var(--sm-quark)"
			size={24}
			disabled={full}
			ariaLabel="Add an anti-{f} quark"
			onpress={() => add(`~${f}`)}
		/>
	{/each}
	<Pad
		x={430}
		y={24}
		w={86}
		h={36}
		label="Clear"
		size={14}
		disabled={tokens.length === 0}
		ariaLabel="Empty the bag"
		onpress={() => save([])}
	/>

	<!-- what it is -->
	<Card x={CX - 16} y={24} w={336} h={560} />
	<Readout id="name" order={1} label="Makes" value={nameText} note={kindText}>
		<T x={CX} y={66} text={nameText} size={nameText.length > 18 ? 19 : 26} weight={700} />
		<T
			x={CX}
			y={90}
			text={kindText}
			size={13}
			color={build.kind === 'coloured' ? 'var(--sm-bad)' : undefined}
			muted={build.kind !== 'coloured'}
		/>
	</Readout>
	<Readout id="status">
		{#each statusLines as line, i (i)}
			<T x={CX} y={114 + i * 17} text={line} size={12} muted />
		{/each}
	</Readout>

	<g opacity={sectionOpacity('charge')}>
		{#if focus === 'charge'}<rect x={CX - 12} y={158} width="4" height="56" rx="2" fill="var(--explainer-accent)" />{/if}
		<T x={CX} y={172} text="Charge (in units of e)" size={12} muted />
		<Readout id="charge" order={2} label="Charge" value={chargeSum}>
			<T x={CX} y={200} text={chargeSum} size={tokens.length === 3 ? 20 : 22} weight={600} />
		</Readout>
	</g>

	<g opacity={sectionOpacity('colour')}>
		{#if focus === 'colour'}<rect x={CX - 12} y={230} width="4" height="62" rx="2" fill="var(--explainer-accent)" />{/if}
		<T x={CX} y={244} text="Colour: the total must be colourless" size={12} muted />
		{#each balls as b, i (b.i + b.tk)}
			<circle cx={CX + 10 + i * 26} cy={270} r="10" fill={chargeColour(b.colour, b.anti)} />
		{/each}
		<Readout id="colour" order={3} label="Colour" value={colourCheck}>
			<T
				x={CX + 8 + Math.max(1, balls.length) * 26}
				y={275}
				text={colourCheck}
				size={13}
				weight={600}
				color={build.kind === 'empty' ? undefined : build.neutral ? 'var(--sm-ok)' : 'var(--sm-bad)'}
			/>
		</Readout>
	</g>

	<g opacity={sectionOpacity('charge')}>
		<T x={CX} y={318} text="Baryon number" size={12} muted />
		<Readout id="baryon" order={4} label="Baryon number" value={baryonSum}>
			<T x={CX} y={342} text={baryonSum} size={16} weight={600} />
		</Readout>
	</g>

	<g opacity={sectionOpacity('mass')}>
		{#if focus === 'mass'}<rect x={CX - 12} y={366} width="4" height="110" rx="2" fill="var(--explainer-accent)" />{/if}
		<T x={CX} y={380} text="Mass" size={12} muted />
		{#if build.hadron}
			<rect x={CX} y={392} width={296} height={18} rx="4" fill="var(--sm-field)" stroke="var(--border)" />
			<rect
				x={CX}
				y={392}
				width={Math.max(2, 296 * share)}
				height={18}
				rx="4"
				fill="var(--sm-quark)"
			/>
			<Readout
				id="mass"
				order={5}
				label="Mass"
				value="{massText(build.hadron.data.mass.v)}; quarks {pct(share)}"
				note="The rest is the energy of the gluon field and the quarks' motion."
				opacity={focus === 'mass' || focus === 'zoo' ? 1 : 0}
			>
				<T x={CX} y={428} text="quarks: {quarkMassText}" size={12} />
				<T
					x={CX}
					y={446}
					text="{build.hadron.name}: {massText(build.hadron.data.mass.v)} · quarks {pct(share)}"
					size={13}
					weight={600}
				/>
				<T x={CX} y={464} text="the rest: gluon-field and motion energy" size={12} muted />
			</Readout>
		{:else}
			<T x={CX} y={406} text="—" size={14} muted />
		{/if}
	</g>

	<g opacity={sectionOpacity('zoo')}>
		{#if focus === 'zoo'}<rect x={CX - 12} y={490} width="4" height="62" rx="2" fill="var(--explainer-accent)" />{/if}
		<T x={CX} y={504} text="Spin and lifetime" size={12} muted />
		{#if build.hadron}
			<Readout
				id="life"
				order={6}
				label="Lifetime"
				value={lifeLine.replace(/^lives /, '')}
				note={spinText}
				opacity={focus === 'zoo' ? 1 : 0}
			>
				<T x={CX} y={526} text={spinText} size={13} />
				<T x={CX} y={546} text={lifeLine} size={13} weight={600} />
			</Readout>
		{:else}
			<T x={CX} y={530} text="—" size={14} muted />
		{/if}
	</g>
	<Readout id="pdg">
		<T x={CX + 296} y={574} text="data: PDG 2026" size={11} anchor="end" muted />
	</Readout>
</g>

<style>
	.ball {
		cursor: pointer;
		outline: none;
	}
	.ball .ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 3;
		opacity: 0;
	}
	.ball:focus-visible .ring {
		opacity: 1;
	}
</style>
