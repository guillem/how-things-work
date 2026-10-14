<script lang="ts">
	/**
	 * The HP lattice model on a square grid.
	 *
	 * `step.hints.mode`:
	 *   rules   — chain A folds from straight into one of its shapes at −3 (picked at random
	 *             from the full enumeration), then its three H–H contacts light up one by one
	 *   fold    — the reader folds the chain (`params.chain`) by clicking beads; the fold is
	 *             kept in `params['fold-<chain>']` (a string of turns), so the next steps can
	 *             show it; the energy and the best possible energy are read out
	 *   compare — the single best folds of chains A and B side by side
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import Label from './Text.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { clashes, contacts, energy, fromTurns, landscape } from '../hp';
	import { CHAINS, chainById } from '../folding';
	import Beads from './Beads.svelte';
	import { anglesOf, middleOf, pointsOf, straight } from './lattice';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'rules'));
	const chain = $derived(mode === 'rules' ? CHAINS[0] : chainById(String(params.chain ?? 'a')));
	const seq = $derived(chain.seq);
	const N = 14;

	// the full landscape of each chain (110,188 shapes; ~0.1 s each), computed when first needed
	const lands = new Map<string, ReturnType<typeof landscape>>();
	const land = (s: string) => {
		let l = lands.get(s);
		if (!l) lands.set(s, (l = landscape(s)));
		return l;
	};

	// ---- rules -------------------------------------------------------------------------------
	const EXAMPLE = $derived(mode === 'rules' ? (land(CHAINS[0].seq).examples.get(-3) ?? '') : '');
	const exampleShapes = $derived(
		mode === 'rules' ? (land(CHAINS[0].seq).byEnergy.find((e) => e.energy === -3)?.shapes ?? 0) : 0
	);

	// ---- fold (the reader's) ------------------------------------------------------------------
	const foldKey = $derived(`fold-${chain.id}`);
	const turns = $derived.by(() => {
		const v = params[foldKey];
		return typeof v === 'string' && v.length === N - 2 ? v : straight(N);
	});
	function bend(i: number) {
		const next = { S: 'L', L: 'R', R: 'S' } as const;
		const k = i - 1;
		const c = turns[k] as 'S' | 'L' | 'R';
		setParam(foldKey, turns.slice(0, k) + next[c] + turns.slice(k + 1));
	}
	// "Straighten the chain": a press of the action control resets the current chain
	let presses = untrack(() => Number(params.straighten ?? 0));
	$effect(() => {
		const n = Number(params.straighten ?? 0);
		untrack(() => {
			if (n !== presses) {
				presses = n;
				setParam(foldKey, straight(N));
			}
		});
	});

	// what is drawn: the target turns of the current mode
	const target = $derived(mode === 'rules' ? EXAMPLE : turns);
	const targetFold = $derived(fromTurns(target));
	const clashPairs = $derived(clashes(targetFold));
	const clash = $derived(new Set(clashPairs.flat()));
	const valid = $derived(clashPairs.length === 0);
	const E = $derived(energy(seq, targetFold));
	const touching = $derived(contacts(seq, targetFold));

	// smooth bending: the bond angles and the view's centre are tweened
	const angles = new Tween(anglesOf(straight(N)), { duration: 500, easing: cubicInOut });
	const middle = new Tween({ x: (N - 1) / 2, y: 0 }, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const a = anglesOf(target);
		const m = middleOf(target);
		untrack(() => {
			const d = reduced || mode === 'rules' ? 0 : 500;
			angles.set(a, { duration: d });
			middle.set(m, { duration: d });
		});
	});

	// rules: fold from straight to the example during the first 3 s, then count the contacts
	const foldU = $derived(mode === 'rules' ? smoothstep(0.3, 3, t) : 1);
	const shownAngles = $derived(
		mode === 'rules' ? anglesOf(EXAMPLE).map((a) => a * foldU) : angles.current
	);
	const CELL = 40;
	const CX = 360;
	const CY = 310;
	const origin = $derived(mode === 'rules' ? middleOf(EXAMPLE) : middle.current);
	const pts = $derived(pointsOf(shownAngles, CELL, CX, CY, origin));
	/** In the rules frame, contacts appear one by one after the fold. */
	const contactsShown = $derived(
		mode === 'rules'
			? touching.slice(0, reduced ? touching.length : clamp(Math.floor((t - 3.4) / 0.8) + 1, 0, touching.length))
			: valid
				? touching
				: []
	);

	// grid lines through the bead positions (they move with the centre)
	const grid = $derived.by(() => {
		const ox = (CX - origin.x * CELL) % CELL;
		const oy = (CY + origin.y * CELL) % CELL;
		const xs: number[] = [];
		const ys: number[] = [];
		for (let x = ox; x < 700; x += CELL) if (x > 24) xs.push(x);
		for (let y = oy; y < 584; y += CELL) if (y > 24) ys.push(y);
		return { xs, ys };
	});

	const best = $derived(mode === 'fold' ? land(seq) : null);
	const bestCount = $derived(best?.byEnergy.find((e) => e.energy === E)?.shapes ?? 0);
	const solved = $derived(mode === 'fold' && valid && best !== null && E === best.best);

	const describe = (i: number) => {
		const c = turns[i - 1];
		const now = c === 'L' ? 'turns left' : c === 'R' ? 'turns right' : 'straight';
		return `Bead ${i + 1} (${seq[i]}), ${now}: press to bend the chain here`;
	};

	// ---- compare -----------------------------------------------------------------------------
	const pair = $derived(
		mode === 'compare'
			? CHAINS.map((c, k) => {
					const l = land(c.seq);
					const tt = l.bestFolds[0];
					const cx = 240 + k * 480;
					const p = pointsOf(anglesOf(tt), 34, cx, 330, middleOf(tt));
					return { c, pts: p, contacts: contacts(c.seq, fromTurns(tt)), best: l.best, cx };
				})
			: []
	);
	const appear = $derived(reduced ? 1 : smoothstep(0.2, 1.2, t));
</script>

<g>
	{#if mode !== 'compare'}
		<!-- the water around the chain, and the grid -->
		<rect x="24" y="24" width="676" height="552" rx="16" fill="var(--pf-water)" opacity="0.6" />
		<g stroke="var(--pf-grid)" stroke-width="1">
			{#each grid.xs as x (x)}
				<line x1={x} x2={x} y1="28" y2="572" />
			{/each}
			{#each grid.ys as y (y)}
				<line x1="28" x2="696" y1={y} y2={y} />
			{/each}
		</g>

		<Beads
			{seq}
			{pts}
			contacts={contactsShown}
			clash={mode === 'fold' ? clash : new Set()}
			onbead={mode === 'fold' ? bend : undefined}
			{describe}
		/>
		{#if mode === 'fold'}
			<Readout id="start" order={20}>
				<Label x={pts[0].x} y={pts[0].y - 20} text="start" size={11} muted />
			</Readout>
		{/if}

		<!-- the panel on the right -->
		<g style:font-variant-numeric="tabular-nums">
			<Readout id="key-h" order={1} label="H: water-repelling" color="var(--pf-h)">
				<circle cx="738" cy="58" r="11" fill="var(--pf-h)" stroke="var(--pf-h-edge)" stroke-width="1.5" />
				<text x="738" y="62" text-anchor="middle" style:font-size="11px" font-weight="700" style:fill="#fff">H</text>
				<Label x={758} y={62} text="water-repelling" anchor="start" />
			</Readout>
			<Readout id="key-p" order={2} label="P: water-loving" color="var(--pf-p)">
				<circle cx="738" cy="90" r="11" fill="var(--pf-p)" stroke="var(--pf-p-edge)" stroke-width="1.5" />
				<text x="738" y="94" text-anchor="middle" style:font-size="11px" font-weight="700" style:fill="#fff">P</text>
				<Label x={758} y={94} text="water-loving" anchor="start" />
			</Readout>
			<Readout id="key-c" order={3} label="Dotted: H–H contact" value="−1 each" color="var(--pf-contact)">
				<line x1="727" x2="749" y1="120" y2="120" stroke="var(--pf-contact)" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round" />
				<Label x={758} y={124} text="H–H contact: −1" anchor="start" />
			</Readout>

			{#if mode === 'rules'}
				<Readout
					id="energy"
					order={4}
					label="Energy"
					value="{contactsShown.length === 0 ? '0' : `−${contactsShown.length}`}"
					note={foldU > 0.99 ? `one of ${exampleShapes.toLocaleString('en-US')} shapes at −3` : ''}
				>
					<Label x={728} y={190} text="Energy" size={13} anchor="start" muted />
					<Label
						x={728}
						y={222}
						text={contactsShown.length === 0 ? '0' : `−${contactsShown.length}`}
						size={30}
						weight={700}
						anchor="start"
					/>
					{#if foldU > 0.99}
						<Label x={728} y={252} text="one of {exampleShapes.toLocaleString('en-US')}" size={12} anchor="start" muted />
						<Label x={728} y={268} text="shapes at −3" size={12} anchor="start" muted />
					{/if}
				</Readout>
				<Readout id="rule" order={5}>
					<Label x={728} y={330} text="chain neighbours" size={12} anchor="start" muted />
					<Label x={728} y={346} text="don’t count" size={12} anchor="start" muted />
				</Readout>
			{:else}
				<Readout
					id="energy"
					order={4}
					label="Energy"
					value={valid ? (E === 0 ? '0' : `−${-E}`) : 'not allowed'}
					note={valid ? `best possible −${-(best?.best ?? 0)}` : 'two beads on one grid point'}
				>
					<Label x={728} y={190} text="Energy" size={13} anchor="start" muted />
					<Label
						x={728}
						y={224}
						text={valid ? (E === 0 ? '0' : `−${-E}`) : '—'}
						size={32}
						weight={700}
						anchor="start"
						color={solved ? 'var(--pf-contact)' : undefined}
					/>
					<Label x={728} y={254} text="best possible: −{-(best?.best ?? 0)}" size={13} anchor="start" />
				</Readout>
				<Readout
					id="status"
					order={5}
					label={!valid ? 'Not allowed' : solved ? 'Best fold!' : 'Shapes like yours'}
					value={!valid
						? 'beads overlap'
						: solved
							? 'the only one of 110,188 at −6'
							: `${bestCount.toLocaleString('en-US')} at ${E === 0 ? '0' : `−${-E}`}`}
				>
					{#if !valid}
						<Label x={728} y={300} text="Two beads on one" size={13} anchor="start" color="var(--pf-clash)" />
						<Label x={728} y={318} text="grid point: not a" size={13} anchor="start" color="var(--pf-clash)" />
						<Label x={728} y={336} text="real shape" size={13} anchor="start" color="var(--pf-clash)" />
					{:else if solved}
						<Label x={728} y={300} text="You found the best fold:" size={13} weight={600} anchor="start" />
						<Label x={728} y={318} text="the only one of 110,188" size={13} anchor="start" />
						<Label x={728} y={336} text="shapes at −6" size={13} anchor="start" />
					{:else}
						<Label x={728} y={300} text="{bestCount.toLocaleString('en-US')} of the 110,188" size={13} anchor="start" />
						<Label x={728} y={318} text="shapes score {E === 0 ? '0' : `−${-E}`}" size={13} anchor="start" />
					{/if}
				</Readout>
				<Readout id="howto" order={21}>
					<Label x={728} y={520} text="click a bead to bend" size={12} anchor="start" muted />
					<Label x={728} y={536} text="the chain there" size={12} anchor="start" muted />
				</Readout>
			{/if}
		</g>
	{:else}
		<g opacity={appear}>
			{#each pair as p (p.c.id)}
				<Readout id="seq-{p.c.id}" order={p.c.id === 'a' ? 1 : 2} label={p.c.label} value="{p.c.seq} · best −6, one shape">
					<Label x={p.cx} y={72} text={p.c.label} size={16} weight={600} />
					<g>
						{#each p.c.seq.split('') as letter, i (i)}
							<circle
								cx={p.cx - 13 * 11.5 + i * 23}
								cy={102}
								r="9"
								fill={letter === 'H' ? 'var(--pf-h)' : 'var(--pf-p)'}
							/>
							<text x={p.cx - 13 * 11.5 + i * 23} y={106} text-anchor="middle" style:font-size="10px" font-weight="700" style:fill="#fff">
								{letter}
							</text>
						{/each}
					</g>
					<Label x={p.cx} y={556} text="best fold: energy −6, the only one" size={13} />
				</Readout>
				<Beads seq={p.c.seq} pts={p.pts} contacts={p.contacts} r={12} />
			{/each}
			<line x1="480" x2="480" y1="60" y2="560" stroke="var(--stage-line)" stroke-width="1" />
		</g>
	{/if}
</g>
