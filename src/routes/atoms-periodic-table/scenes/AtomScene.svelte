<script lang="ts">
	/**
	 * The atom you build, and where its electrons go.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   build  — a nucleus of packed proton/neutron balls in a soft electron
	 *            cloud (the dots are the electrons: a fuzzy swarm, never orbits),
	 *            a readout (element, isotope, charge, stable or radioactive) and
	 *            a mini periodic table with the element lit. The six action
	 *            buttons change the atom, stored in `params['atom:build']` as
	 *            "p,n,e" (default carbon-12: "6,6,6").
	 *   shells — an energy-level diagram of the subshells 1s…4p in filling
	 *            order (boxes = orbitals, ↑↓ = electrons, Hund's rule), filled
	 *            with the element's MEASURED configuration for `params.fillTo`
	 *            electrons, the Madelung order as a dashed arrow, exceptions
	 *            (Cr, Cu) marked; shells as soft bands with dot counts; the mini
	 *            table lights the element in its block colour. The electrons
	 *            that are new since the last value drop into place (Tween).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut } from 'svelte/easing';
	import { clamp, hash, TAU } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		ELEMENTS,
		ORDER,
		cell,
		element,
		identify,
		isException,
		madelung,
		parseConfig,
		shellCounts
	} from '../atom';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
	const sup = (n: number) =>
		String(n)
			.split('')
			.map((d) => SUP[+d])
			.join('');
	const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	// ---- phases ---------------------------------------------------------------------
	const phase = $derived(step.hints?.phase === 'shells' ? 'shells' : 'build');
	const ease = { duration: 700, easing: cubicInOut };
	const wBuildT = new Tween(1, ease);
	const wShellsT = new Tween(0, ease);
	$effect(() => {
		const p = phase;
		untrack(() => {
			const d = reduced ? 0 : 700;
			wBuildT.set(p === 'build' ? 1 : 0, { duration: d });
			wShellsT.set(p === 'shells' ? 1 : 0, { duration: d });
		});
	});
	const wBuild = $derived(wBuildT.current);
	const wShells = $derived(wShellsT.current);

	// ---- the built atom -------------------------------------------------------------
	const MAX = { p: 118, n: 180, e: 120 };
	const build = $derived.by(() => {
		const raw = typeof params['atom:build'] === 'string' ? params['atom:build'] : '6,6,6';
		const [p, n, e] = raw.split(',').map(Number);
		return {
			protons: clamp(Number.isFinite(p) ? p : 6, 0, MAX.p),
			neutrons: clamp(Number.isFinite(n) ? n : 6, 0, MAX.n),
			electrons: clamp(Number.isFinite(e) ? e : 6, 0, MAX.e)
		};
	});
	const id = $derived(identify(build));

	// Action buttons arrive as press counts; apply the change in each count since
	// the scene mounted (counts seen at mount are not replayed).
	const ACTIONS = [
		['addProton', 'p', 1],
		['removeProton', 'p', -1],
		['addNeutron', 'n', 1],
		['removeNeutron', 'n', -1],
		['addElectron', 'e', 1],
		['removeElectron', 'e', -1]
	] as const;
	let seen: number[] | null = null;
	const bump = new Tween(1, { duration: 500, easing: cubicOut });
	$effect(() => {
		const counts = ACTIONS.map(([key]) => Number(params[key] ?? 0));
		untrack(() => {
			if (!seen) {
				seen = counts;
				return;
			}
			const b = { p: build.protons, n: build.neutrons, e: build.electrons };
			let changed = false;
			counts.forEach((c, i) => {
				const d = c - (seen as number[])[i];
				if (d <= 0) return;
				const [, k, sign] = ACTIONS[i];
				const next = clamp(b[k] + sign * d, 0, MAX[k]);
				if (next !== b[k]) changed = true;
				b[k] = next;
			});
			seen = counts;
			if (!changed) return;
			setParam('atom:build', `${b.p},${b.n},${b.e}`);
			bump.set(0, { duration: 0 });
			bump.set(1, { duration: reduced ? 0 : 500 });
		});
	});

	// ---- nucleus: sunflower packing, at most 40 balls ---------------------------------
	const AX = 270;
	const AY = 296;
	const CLOUD_R = 205;
	const NUC_MAX = 40;
	const BALL = 8.5;
	const nucleus = $derived.by(() => {
		const total = build.protons + build.neutrons;
		const shown = Math.min(total, NUC_MAX);
		const pShown = total > NUC_MAX ? Math.round((build.protons / total) * NUC_MAX) : build.protons;
		// Proton places: the pShown slots with the lowest hash, so adding one
		// particle changes the colour of at most one other ball.
		const order = Array.from({ length: shown }, (_, i) => i).sort(
			(a, b) => hash(a, 3) - hash(b, 3)
		);
		const isP = new Set(order.slice(0, pShown));
		const balls = Array.from({ length: shown }, (_, i) => {
			const r = 8.2 * Math.sqrt(i + 0.5);
			const a = i * 2.39996;
			return { i, x: r * Math.cos(a), y: r * Math.sin(a), p: isP.has(i) };
		});
		// Outer balls first, so the inner ones sit on top: a packed cluster.
		return { balls: balls.reverse(), total, capped: total > NUC_MAX };
	});
	const nucR = $derived(nucleus.balls.length ? 8.2 * Math.sqrt(nucleus.balls.length) + BALL : 0);

	// ---- electron cloud: a fuzzy swarm, one dot per electron ----------------------------
	const electronPath = $derived.by(() => {
		let d = '';
		const n = build.electrons;
		const r0 = Math.max(nucR + 14, 40);
		for (let i = 0; i < n; i++) {
			const a = hash(i, 1) * TAU;
			const r = r0 + (CLOUD_R - 30 - r0) * hash(i, 2) ** 0.8;
			const w1 = 0.35 + 0.5 * hash(i, 4);
			const w2 = 0.5 + 0.6 * hash(i, 5);
			const x =
				AX +
				r * Math.cos(a) +
				16 * Math.sin(t * w1 + 6 * hash(i, 6)) +
				9 * Math.sin(t * w2 * 1.7 + 6 * hash(i, 7));
			const y =
				AY +
				r * Math.sin(a) +
				16 * Math.cos(t * w2 + 6 * hash(i, 8)) +
				9 * Math.sin(t * w1 * 1.3 + 6 * hash(i, 9));
			d += `M${(x - 4).toFixed(1)} ${y.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`;
		}
		return d;
	});
	const jig = (i: number, s: number) => (reduced ? 0 : 0.7 * Math.sin(t * 9 + i * 1.7 + s));

	// ---- readout text ---------------------------------------------------------------
	const el = $derived(id.element);
	const isotope = $derived(
		el
			? `${el.name.toLowerCase()}-${id.massNumber}`
			: build.neutrons
				? `${plural(build.neutrons, 'neutron')}, no protons`
				: 'no protons, no neutrons'
	);
	const chargeText = $derived(
		id.charge === 0
			? el
				? 'neutral atom (charge 0)'
				: 'charge 0'
			: el
				? `ion: ${signed(id.charge)} (${plural(Math.abs(id.charge), 'electron')} ${id.charge > 0 ? 'short' : 'extra'})`
				: `charge ${signed(id.charge)}`
	);
	const stableText = $derived(
		!el ? '' : id.stable ? 'stable nucleus' : 'radioactive nucleus (it will decay)'
	);
	const hintText = $derived.by(() => {
		if (!el) return 'Add a proton to make an element.';
		if (id.stable) return '';
		if (id.nearestStable === null) return `${el.name} has no stable isotope at all.`;
		const d = id.nearestStable - id.massNumber;
		return `Nearest stable: ${el.name.toLowerCase()}-${id.nearestStable} (${d > 0 ? 'add' : 'remove'} ${plural(Math.abs(d), 'neutron')})`;
	});

	// ---- shells: energy-level diagram ---------------------------------------------------
	const z = $derived(clamp(Math.round(Number(params.fillTo ?? 11)), 1, 118));
	const ez = $derived(element(z));
	const occNow = $derived(parseConfig(ez.config));
	const SUBS = ORDER.slice(0, 8); // 1s 2s 2p 3s 3p 4s 3d 4p: enough for 36 electrons
	const BOX = 25;
	const COL_LEFT = [70, 160, 290, 460];
	const rowY = (i: number) => 548 - i * 57;
	const rows = SUBS.map((s, i) => ({
		...s,
		i,
		x: COL_LEFT[s.n - 1],
		y: rowY(i),
		boxes: s.capacity / 2
	}));
	const blockColor = (l: number | string) => `var(--atom-${typeof l === 'number' ? 'spdf'[l] : l})`;

	type Arrow = { key: string; x: number; y: number; up: boolean };
	function arrowsFor(count: number): Arrow[] {
		const occ = count > 0 ? parseConfig(element(count).config) : new Map<string, number>();
		const out: Arrow[] = [];
		for (const r of rows) {
			const k = occ.get(r.label) ?? 0;
			const m = r.boxes;
			for (let j = 0; j < m; j++) {
				const cx = r.x + j * BOX + 11;
				// Hund's rule: one ↑ in every box before any ↓.
				if (j < k) out.push({ key: `${r.label}-${j}-u`, x: cx - 4.5, y: r.y, up: true });
				if (j < k - m) out.push({ key: `${r.label}-${j}-d`, x: cx + 4.5, y: r.y, up: false });
			}
		}
		return out;
	}
	const arrows = $derived(arrowsFor(z));
	let prevKeys: Set<string> | null = null;
	let fresh = $state(new Set<string>());
	const drop = new Tween(1, { duration: 800, easing: cubicOut });
	$effect(() => {
		const keys = arrows.map((a) => a.key);
		untrack(() => {
			if (!prevKeys) prevKeys = new Set(arrowsFor(z - 1).map((a) => a.key));
			const before = prevKeys;
			fresh = new Set(keys.filter((k) => !before.has(k)));
			prevKeys = new Set(keys);
			drop.set(0, { duration: 0 });
			drop.set(1, { duration: reduced ? 0 : 800 });
		});
	});
	const arrowD = (a: Arrow, dy = 0) => {
		const y = a.y + dy;
		return a.up
			? `M${a.x} ${y + 8}V${y - 8}M${a.x - 3.5} ${y - 4}L${a.x} ${y - 8}L${a.x + 3.5} ${y - 4}`
			: `M${a.x} ${y - 8}V${y + 8}M${a.x - 3.5} ${y + 4}L${a.x} ${y + 8}L${a.x + 3.5} ${y + 4}`;
	};
	const settledD = $derived(
		arrows
			.filter((a) => !fresh.has(a.key))
			.map((a) => arrowD(a))
			.join('')
	);
	const fallD = $derived(
		arrows
			.filter((a) => fresh.has(a.key))
			.map((a) => arrowD(a, -(1 - drop.current) * 60))
			.join('')
	);

	// The filling order as a dashed staircase past the subshell labels.
	const route = (() => {
		const pts = rows.map((r) => ({ x: r.x - 34, y: r.y }));
		let d = `M${pts[0].x} ${pts[0].y + 14}`;
		for (let i = 0; i < pts.length; i++) {
			const p = pts[i];
			if (i === 0) d += `V${p.y}`;
			else {
				const mid = (pts[i - 1].y + p.y) / 2;
				d += `V${mid}H${p.x}V${p.y}`;
			}
		}
		const last = pts[pts.length - 1];
		return { d: d + `V${last.y - 16}`, tip: { x: last.x, y: last.y - 16 } };
	})();

	const configText = $derived(
		ORDER.filter((s) => (occNow.get(s.label) ?? 0) > 0)
			.map((s) => `${s.label}${sup(occNow.get(s.label) ?? 0)}`)
			.join(' ')
	);
	const shortConfig = $derived(
		ez.config.replace(/(\d[spdf])(\d*)/g, (_, s: string, k: string) => s + sup(k ? +k : 1))
	);
	const exception = $derived.by(() => {
		if (!isException(z)) return null;
		const rule = madelung(z);
		const labels = ORDER.filter(
			(s) => (rule.get(s.label) ?? 0) !== (occNow.get(s.label) ?? 0)
		).sort((a, b) => a.n - b.n || a.l - b.l);
		const fmt = (m: Map<string, number>) =>
			labels.map((s) => `${s.label}${sup(m.get(s.label) ?? 0)}`).join(' ');
		return { measured: fmt(occNow), rule: fmt(rule), labels: new Set(labels.map((s) => s.label)) };
	});

	// ---- shells: soft bands with dot counts ---------------------------------------------
	const SX = 764;
	const SY = 196;
	const bandMid = (n: number) => 32 + (n - 1) * 32;
	const BAND_R = 150; // radius of the gradient circles that draw the bands
	const counts = $derived(shellCounts(z));
	const shellDots = $derived.by(() => {
		const out: { key: string; x: number; y: number }[] = [];
		counts.forEach((c, s) => {
			const mid = bandMid(s + 1);
			for (let i = 0; i < c; i++) {
				const seed = s * 40 + i;
				// Keep a gap at the top of each band for its count.
				const a = -Math.PI / 2 + 0.4 + (TAU - 0.8) * ((i + 0.1 + hash(seed, 1) * 0.8) / c);
				const r = mid - 8 + 16 * hash(seed, 2) + 4 * Math.sin(t * 0.9 + 6 * hash(seed, 3));
				const da = (reduced ? 0 : 0.05) * Math.sin(t * 0.6 + 6 * hash(seed, 4));
				out.push({ key: `${s}-${i}`, x: SX + r * Math.cos(a + da), y: SY + r * Math.sin(a + da) });
			}
		});
		return out;
	});

	// ---- mini periodic table -----------------------------------------------------------
	const TX = 584;
	const TY = 422;
	const CW = 20;
	const CH = 16;
	const cellXY = (zz: number) => {
		const c = cell(zz);
		const y = c.row <= 7 ? TY + (c.row - 1) * CH : TY + 7 * CH + 6 + (c.row - 9) * CH;
		return { x: TX + (c.col - 1) * CW, y };
	};
	const blockPaths = (['s', 'p', 'd', 'f'] as const).map((b) => ({
		b,
		d: ELEMENTS.filter((e) => e.block === b)
			.map((e) => {
				const { x, y } = cellXY(e.z);
				return `M${x} ${y}h18v14h-18z`;
			})
			.join('')
	}));
	const litZ = $derived(phase === 'shells' ? z : build.protons >= 1 ? build.protons : null);
	const litPos = new Tween(cellXY(6), { duration: 600, easing: cubicInOut });
	const litOn = new Tween(1, { duration: 400 });
	$effect(() => {
		const zz = litZ;
		untrack(() => {
			if (zz) litPos.set(cellXY(zz), { duration: reduced ? 0 : 600 });
			litOn.set(zz ? 1 : 0, { duration: reduced ? 0 : 400 });
		});
	});
	const litEl = $derived(litZ ? element(litZ) : null);
	const tableCaption = $derived(
		litEl
			? `${litEl.name} in the table: period ${litEl.period}, ${litEl.group ? `group ${litEl.group}, ` : ''}${litEl.block}-block`
			: 'No element to light up: there are no protons'
	);
	const nucleonRows = $derived([
		{
			k: 'p',
			n: build.protons,
			c: 'var(--atom-proton)',
			what: 'proton',
			role: 'decide the element'
		},
		{
			k: 'n',
			n: build.neutrons,
			c: 'var(--atom-neutron)',
			what: 'neutron',
			role: 'change only the mass'
		},
		{
			k: 'e',
			n: build.electrons,
			c: 'var(--atom-electron)',
			what: 'electron',
			role: 'set the charge'
		}
	]);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<defs>
		<radialGradient id="atom-cloud-grad">
			<stop offset="0" style:stop-color="var(--atom-electron)" stop-opacity="0.26" />
			<stop offset="0.55" style:stop-color="var(--atom-electron)" stop-opacity="0.14" />
			<stop offset="1" style:stop-color="var(--atom-electron)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- ================= build ================= -->
	{#if wBuild > 0.01}
		<g opacity={wBuild}>
			<circle
				cx={AX}
				cy={AY}
				r={CLOUD_R}
				fill="url(#atom-cloud-grad)"
				opacity={build.electrons ? 1 : 0}
			/>
			<g transform="translate({AX} {AY}) scale({1 + 0.12 * (1 - bump.current)})">
				{#each nucleus.balls as b (b.i)}
					<circle
						cx={b.x + jig(b.i, 0)}
						cy={b.y + jig(b.i, 2)}
						r={BALL}
						fill={b.p ? 'var(--atom-proton)' : 'var(--atom-neutron)'}
						stroke="var(--stage-bg)"
						stroke-width="1.2"
					/>
				{/each}
			</g>
			<path
				d={electronPath}
				fill="var(--atom-electron)"
				stroke="var(--stage-bg)"
				stroke-width="0.8"
			/>
			{#if nucleus.capped}
				{@render txt(AX, AY + nucR + 22, `×${nucleus.total} (40 drawn)`, 12, {
					anchor: 'middle',
					weight: 600
				})}
			{/if}
			{#if build.electrons}
				{@render txt(
					AX,
					AY - CLOUD_R + 6,
					`electron cloud: ${plural(build.electrons, 'electron')}`,
					12,
					{ anchor: 'middle', muted: true }
				)}
			{/if}
			{@render txt(
				AX,
				578,
				'Not to scale: the real nucleus is about 100,000 times smaller than the atom.',
				11,
				{ anchor: 'middle', muted: true }
			)}

			<!-- readout -->
			<rect
				x={TX}
				y="34"
				width="96"
				height="104"
				rx="10"
				fill={el ? blockColor(el.block) : 'var(--surface)'}
				fill-opacity={el ? 0.2 : 1}
				stroke={el ? blockColor(el.block) : 'var(--border)'}
				stroke-width={1.5 + 2 * (1 - bump.current)}
			/>
			{#if el}
				{@render txt(TX + 10, 54, String(el.z), 13, { weight: 600 })}
				{@render txt(TX + 48, 106, el.symbol, 46, { anchor: 'middle', weight: 700 })}
				{@render txt(TX + 48, 129, el.mass ? el.mass.toFixed(2) : '', 11, {
					anchor: 'middle',
					muted: true
				})}
			{:else}
				{@render txt(TX + 48, 100, '—', 40, { anchor: 'middle', muted: true })}
			{/if}
			{@render txt(TX + 112, 64, el ? el.name : 'No element', 24, { weight: 700 })}
			{@render txt(TX + 112, 90, isotope, 15, { weight: 600 })}
			{@render txt(TX + 112, 113, chargeText, 13, {
				color: id.charge === 0 ? undefined : 'var(--atom-electron)'
			})}
			{#if el}
				{@render txt(TX + 112, 135, stableText, 13, {
					color: id.stable ? 'var(--atom-p)' : 'var(--atom-proton)',
					weight: 600
				})}
			{/if}
			{#if hintText}
				{@render txt(TX, 166, hintText, 12, { muted: true })}
			{/if}
			{#each nucleonRows as row, i (row.k)}
				<circle cx={TX + 8} cy={206 + i * 30} r={row.k === 'e' ? 4 : 7} fill={row.c} />
				{@render txt(TX + 24, 211 + i * 30, plural(row.n, row.what), 14, { weight: 600 })}
				{@render txt(TX + 140, 211 + i * 30, row.role, 12, { muted: true })}
			{/each}
			{@render txt(TX, 316, `Mass number ${id.massNumber} = protons + neutrons`, 12, {
				muted: true
			})}
		</g>
	{/if}

	<!-- ================= shells ================= -->
	{#if wShells > 0.01}
		<g opacity={wShells}>
			{@render txt(30, 36, `${ez.name} (${ez.symbol}): ${plural(z, 'electron')}`, 17, {
				weight: 700
			})}
			{@render txt(30, 60, configText, 15, { weight: 600 })}
			{@render txt(30, 80, `written short: ${shortConfig}`, 12, { muted: true })}
			{#if exception}
				{@render txt(
					30,
					100,
					`⚠ Measured configuration differs from the rule: ${exception.measured}, not ${exception.rule}`,
					12,
					{ color: 'var(--atom-proton)', weight: 600 }
				)}
			{/if}

			<!-- energy axis -->
			<line
				x1="14"
				x2="14"
				y1="566"
				y2="140"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				marker-end="url(#arrowhead)"
			/>
			<text
				x="0"
				y="0"
				class="muted"
				text-anchor="middle"
				transform="translate(9 350) rotate(-90)"
				style:font-size="11px">energy</text
			>

			<!-- filling order -->
			<path
				d={route.d}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.3"
				stroke-dasharray="4 4"
				stroke-linejoin="round"
				opacity="0.8"
			/>
			<path
				d="M{route.tip.x - 4} {route.tip.y + 4}L{route.tip.x} {route.tip.y - 3}L{route.tip.x +
					4} {route.tip.y + 4}"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.3"
			/>
			{@render txt(route.tip.x, route.tip.y - 10, 'filling order', 11, {
				muted: true,
				anchor: 'middle'
			})}

			{#each rows as r (r.label)}
				{@const occ = occNow.get(r.label) ?? 0}
				{@const odd = exception?.labels.has(r.label) ?? false}
				{@render txt(r.x - 8, r.y + 5, r.label, 14, {
					anchor: 'end',
					weight: 700,
					color: blockColor(r.l),
					opacity: occ ? 1 : 0.6
				})}
				{#each Array.from({ length: r.boxes }, (_, j) => j) as j (j)}
					<rect
						x={r.x + j * BOX}
						y={r.y - 12}
						width="22"
						height="24"
						rx="4"
						fill={blockColor(r.l)}
						fill-opacity={occ ? 0.2 : 0.06}
						stroke={odd ? 'var(--atom-proton)' : blockColor(r.l)}
						stroke-width={odd ? 2 : 1.2}
						stroke-opacity={occ || odd ? 1 : 0.5}
					/>
				{/each}
			{/each}
			<path
				d={settledD}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			<path
				d={fallD}
				fill="none"
				stroke="var(--atom-electron)"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={0.3 + 0.7 * drop.current}
			/>
			{#each [1, 2, 3, 4] as n (n)}
				{@render txt(COL_LEFT[n - 1] + (n === 1 ? 11 : n === 3 ? 62 : 37), 590, `shell ${n}`, 11, {
					anchor: 'middle',
					muted: true
				})}
			{/each}

			<!-- shells as soft bands -->
			{@render txt(SX, 30, 'Shells: fuzzy regions, not orbits', 12, {
				anchor: 'middle',
				muted: true
			})}
			{#each counts as c, s (s)}
				{@const m = bandMid(s + 1)}
				{@const a = s === counts.length - 1 ? 0.3 : 0.2}
				<radialGradient
					id="atom-band-{s}"
					gradientUnits="userSpaceOnUse"
					cx={SX}
					cy={SY}
					r={BAND_R}
				>
					<stop
						offset={(m - 16) / BAND_R}
						style:stop-color="var(--atom-electron)"
						stop-opacity="0"
					/>
					<stop offset={m / BAND_R} style:stop-color="var(--atom-electron)" stop-opacity={a} />
					<stop
						offset={(m + 16) / BAND_R}
						style:stop-color="var(--atom-electron)"
						stop-opacity="0"
					/>
				</radialGradient>
				<circle cx={SX} cy={SY} r={BAND_R} fill="url(#atom-band-{s})" />
				{@render txt(SX, SY - m + 5, String(c), 13, { anchor: 'middle', weight: 700 })}
			{/each}
			<circle cx={SX} cy={SY} r="7" fill="var(--atom-proton)" />
			{#each shellDots as d (d.key)}
				<circle cx={d.x} cy={d.y} r="3.4" fill="var(--atom-electron)" />
			{/each}
			{@render txt(SX, 370, `Electrons per shell: ${counts.join(' · ')}`, 12, {
				anchor: 'middle',
				muted: true
			})}
		</g>
	{/if}

	<!-- ================= mini periodic table (both phases) ================= -->
	{@render txt(TX, TY - 10, tableCaption, 12, { weight: 600 })}
	{#each blockPaths as bp (bp.b)}
		<path
			d={bp.d}
			fill={blockColor(bp.b)}
			fill-opacity={0.12 + 0.18 * wShells}
			stroke={blockColor(bp.b)}
			stroke-opacity="0.35"
			stroke-width="0.6"
		/>
	{/each}
	{#if litEl}
		<g opacity={litOn.current}>
			<rect
				x={litPos.current.x - 4}
				y={litPos.current.y - 4}
				width="26"
				height="22"
				rx="4"
				fill={blockColor(litEl.block)}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			<text
				x={litPos.current.x + 9}
				y={litPos.current.y + 11}
				text-anchor="middle"
				font-weight="700"
				style:font-size="11px"
				style:fill="var(--stage-bg)">{litEl.symbol}</text
			>
		</g>
	{/if}
</g>
