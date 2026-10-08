<script lang="ts">
	/**
	 * One block of a code, as the receiver sees it.
	 *
	 * Left: the bits drawn in their parity circles. Phase `parity` has one
	 * circle (4 data bits + one parity bit); the other phases have the three
	 * overlapping circles of the (7, 4) Hamming code, check k drawn around the
	 * positions it covers, each bit in the region of the circles it belongs to.
	 * Right: the message (4 clickable data bits), the block sent, the block
	 * received (clickable: flip a bit), each check's count, the verdict and the
	 * decoded message.
	 *
	 * State: the message is `params['ec:data']` (4 chars of 0/1, shared by all
	 * steps); the bits flipped by "noise" are `params['ec:flips:<step id>']`
	 * (one 0/1 char per position), defaulting to the step's `hints.flips`, so
	 * each step opens on its own example. The `flipRandom` and `clearFlips`
	 * action buttons change the current step's flips.
	 *
	 * Timeline (pure function of the time since the last change of message or
	 * flips, the restart pattern of logic-gates' RippleScene): the receiver
	 * evaluates the checks one by one, then gives its verdict. Reduced motion,
	 * or a paused stage, shows the finished verdict.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { rng, wave } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		checkPasses,
		covered,
		decode,
		encode,
		parityOk,
		withParity,
		xor,
		type Bits
	} from '../hamming';

	let { step, t, params, reduced, playing, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'hamming'));
	const isParity = $derived(phase === 'parity');
	const n = $derived(isParity ? 5 : 7);

	// ---- state ----------------------------------------------------------------------
	const parseBits = (v: unknown, len: number, fallback: string): Bits => {
		const s = typeof v === 'string' && /^[01]+$/.test(v) && v.length === len ? v : fallback;
		return [...s].map(Number);
	};
	const data = $derived(parseBits(params['ec:data'], 4, '1011'));
	const flipKey = $derived(`ec:flips:${step.id}`);
	const flips = $derived(
		parseBits(params[flipKey], n, String(step.hints?.flips ?? '0'.repeat(n)).padEnd(n, '0'))
	);

	const sent = $derived(isParity ? withParity(data) : encode(data));
	const received = $derived(xor(sent, flips));
	const nFlips = $derived(flips.filter(Boolean).length);
	const dec = $derived(decode(isParity ? [0, 0, 0, 0, 0, 0, 0] : received));
	/** Number of wrong data bits after decoding. */
	const wrongBits = $derived(dec.data.filter((b, i) => b !== data[i]).length);

	function setData(i: number) {
		const next = data.slice();
		next[i] ^= 1;
		setParam('ec:data', next.join(''));
	}
	function toggleFlip(pos: number) {
		const next = flips.slice();
		next[pos - 1] ^= 1;
		setParam(flipKey, next.join(''));
	}
	function onKey(e: KeyboardEvent, fn: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fn();
		}
	}

	// ---- action buttons ---------------------------------------------------------------
	let lastRandom = untrack(() => Number(params.flipRandom ?? 0));
	let lastClear = untrack(() => Number(params.clearFlips ?? 0));
	$effect(() => {
		const c = Number(params.flipRandom ?? 0);
		if (c === lastRandom) return;
		lastRandom = c;
		untrack(() => {
			const free = flips.flatMap((f, i) => (f ? [] : [i + 1]));
			const pool = free.length ? free : flips.map((_, i) => i + 1);
			const pick = pool[Math.floor(rng(c * 977 + step.id.length * 31)() * pool.length)];
			toggleFlip(pick);
		});
	});
	$effect(() => {
		const c = Number(params.clearFlips ?? 0);
		if (c === lastClear) return;
		lastClear = c;
		untrack(() => setParam(flipKey, '0'.repeat(n)));
	});

	// ---- timeline ---------------------------------------------------------------------
	const CHECK_AT = [0.5, 1.0, 1.5];
	const VERDICT_AT = 2.1;
	let lastKey = '';
	let t0 = 0;
	let lastT = 0;
	const tr = $derived.by(() => {
		const key = `${step.id}|${data.join('')}|${flips.join('')}`;
		if (key !== lastKey) {
			t0 = lastKey === '' || lastKey.split('|')[0] !== step.id ? 0 : t;
			lastKey = key;
		}
		if (t < lastT || t < t0) t0 = Math.min(t0, t, 0);
		lastT = t;
		return reduced || !playing ? Infinity : t - t0;
	});

	/** Checks, in the order the receiver evaluates them. */
	const CHECKS = [1, 2, 4];
	const checksShown = $derived(
		isParity ? (tr >= CHECK_AT[0] ? 1 : 0) : CHECK_AT.filter((a) => tr >= a).length
	);
	const verdict = $derived(tr >= VERDICT_AT);
	const activeCheck = $derived(checksShown < (isParity ? 1 : 3) ? checksShown : -1);
	const passes = (k: number) => checkPasses(received, k);
	const ones = (k: number) => covered(k).filter((p) => received[p - 1] === 1).length;
	const parityPass = $derived(parityOk(received));
	const parityOnes = $derived(received.filter(Boolean).length);

	// ---- layout -----------------------------------------------------------------------
	/** The circles of the Venn diagram (check k), and the big one of the parity phase. */
	const CIRCLE: Record<number, { x: number; y: number }> = {
		1: { x: 250, y: 250 },
		2: { x: 370, y: 250 },
		4: { x: 310, y: 354 }
	};
	const R = 112;
	const BIG = { x: 310, y: 296, r: 166 };
	/**
	 * Parity phase: the five bits evenly round the circle (keyed by the Venn
	 * position each one moves to when the three circles appear), leaving the
	 * centre for the count of 1s.
	 */
	const PENT: Record<number, { x: number; y: number }> = Object.fromEntries(
		[3, 5, 6, 7, 4].map((p, i) => {
			const a = ((-72 + i * 72) * Math.PI) / 180;
			return [p, { x: BIG.x + 104 * Math.sin(a), y: BIG.y - 6 - 104 * Math.cos(a) }];
		})
	);
	/** Where bit `pos` (Venn numbering) sits at phase blend m (0 parity, 1 Hamming). */
	const place = (pos: number, m: number) => {
		const a = PENT[pos] ?? SPOT[pos];
		const b = SPOT[pos];
		return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m };
	};
	/** Where each position sits: in the regions of the circles that cover it. */
	const SPOT: Record<number, { x: number; y: number }> = {
		1: { x: 198, y: 220 },
		2: { x: 422, y: 220 },
		3: { x: 310, y: 205 },
		4: { x: 310, y: 419 },
		5: { x: 250, y: 320 },
		6: { x: 370, y: 320 },
		7: { x: 310, y: 285 }
	};
	/** Parity phase: bit i (0–3 data, 4 the parity bit) → position of the same bit in the Venn. */
	const PARITY_POS = [3, 5, 6, 7, 4];
	const DATA_POS = [3, 5, 6, 7];
	/** Where the decoder's "fix" label goes, beside the bit and away from its neighbours. */
	const FIX_LABEL: Record<number, { dx: number; dy: number; anchor: string }> = {
		4: { dx: 32, dy: 5, anchor: 'start' },
		5: { dx: -32, dy: 5, anchor: 'end' },
		6: { dx: 32, dy: 5, anchor: 'start' },
		7: { dx: 0, dy: -30, anchor: 'middle' }
	};

	// Phase blend: 0 = one parity circle, 1 = three Hamming circles.
	const mix = new Tween(0, { duration: 800, easing: cubicInOut });
	const addr = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const m = isParity ? 0 : 1;
		const a = phase === 'address' ? 1 : 0;
		untrack(() => {
			mix.set(m, { duration: reduced ? 0 : 800 });
			addr.set(a, { duration: reduced ? 0 : 700 });
		});
	});

	const isCheckPos = (pos: number) => pos === 1 || pos === 2 || pos === 4;
	const bitColor = (pos: number) =>
		isParity
			? pos === 5
				? 'var(--ec-check)'
				: 'var(--ec-data)'
			: isCheckPos(pos)
				? 'var(--ec-check)'
				: 'var(--ec-data)';

	/** Bits drawn in the diagram: { key, pos (1-based index into received), x, y }. */
	const venn = $derived(
		isParity
			? PARITY_POS.map((vp, i) => ({
					key: `b${i}`,
					pos: i + 1,
					...place(vp, mix.current),
					name: i < 4 ? `d${i + 1}` : 'P'
				}))
			: [1, 2, 3, 4, 5, 6, 7].map((p) => ({
					key: `b${p}`,
					pos: p,
					...place(p, mix.current),
					name: isCheckPos(p) ? `check ${p}` : `d${DATA_POS.indexOf(p) + 1}`
				}))
	);

	const statusColor = (ok: boolean) => (ok ? 'var(--ec-ok)' : 'var(--ec-bad)');
	const word = (k: number) =>
		['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][k] ?? String(k);

	/** Right panel: cell x for index i of a row of `count`. */
	const PX = 580;
	const cellX = (i: number) => PX + 18 + i * 48;
	const CELL = 36;
	const ROW_MSG = 82;
	const ROW_SENT = 172;
	const ROW_RECV = 262;

	const failing = $derived(CHECKS.filter((k) => !passes(k)));
	const pulse = $derived(reduced ? 1 : wave(t, 1.6));
	const suspect = $derived(!isParity && verdict ? dec.position : 0);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

{#snippet cell(
	x: number,
	y: number,
	bit: number,
	color: string,
	opts: { flipped?: boolean; fixed?: boolean; wrong?: boolean; opacity?: number } = {}
)}
	<g opacity={opts.opacity ?? 1}>
		<rect
			x={x - CELL / 2}
			y={y - CELL / 2}
			width={CELL}
			height={CELL}
			rx="7"
			fill={bit ? color : 'var(--surface)'}
			stroke={opts.wrong || opts.flipped ? 'var(--ec-bad)' : opts.fixed ? 'var(--ec-fix)' : color}
			stroke-width={opts.wrong || opts.flipped || opts.fixed ? 3 : 1.5}
			stroke-dasharray={opts.flipped ? '5 3' : undefined}
		/>
		{@render txt(x, y + 6, String(bit), 17, {
			anchor: 'middle',
			weight: 700,
			color: bit ? 'var(--stage-bg)' : color,
			halo: false
		})}
	</g>
{/snippet}

<g>
	<!-- ============================== the diagram ============================== -->
	{@render txt(24, 40, 'What the receiver got', 16, { weight: 700 })}
	{@render txt(
		24,
		62,
		isParity
			? 'one circle: its 1s must be even'
			: 'three circles: each must hold an even number of 1s',
		12,
		{ muted: true }
	)}

	<!-- the single parity circle -->
	{#if mix.current < 0.99}
		{@const shown = checksShown > 0}
		<g opacity={1 - mix.current}>
			<circle
				cx={BIG.x}
				cy={BIG.y}
				r={BIG.r}
				fill={shown ? statusColor(parityPass) : 'var(--stage-grid)'}
				fill-opacity={shown ? 0.12 : 0.25}
				stroke={shown ? statusColor(parityPass) : 'var(--stage-line)'}
				stroke-width={activeCheck === 0 ? 3 : 2}
			/>
			{@render txt(BIG.x + BIG.r * 0.74, BIG.y - BIG.r * 0.8, 'parity check', 14, {
				weight: 700,
				color: 'var(--ec-check)'
			})}
			<!-- the count, in the middle of the circle -->
			{#if shown}
				{@render txt(BIG.x, BIG.y + 4, String(parityOnes), 30, {
					anchor: 'middle',
					weight: 700,
					color: statusColor(parityPass)
				})}
				{@render txt(BIG.x, BIG.y + 24, parityPass ? '1s: even ✓' : '1s: odd ✗', 12, {
					anchor: 'middle',
					weight: 700,
					color: statusColor(parityPass)
				})}
			{:else}
				{@render txt(BIG.x, BIG.y + 4, '?', 30, { anchor: 'middle', weight: 700, muted: true })}
				{@render txt(BIG.x, BIG.y + 24, 'counting 1s', 12, { anchor: 'middle', muted: true })}
			{/if}
		</g>
	{/if}

	<!-- the three Hamming circles -->
	{#if mix.current > 0.01}
		<g opacity={mix.current}>
			{#each CHECKS as k, j (k)}
				{@const c = CIRCLE[k]}
				{@const shown = checksShown > j}
				{@const ok = passes(k)}
				<circle
					cx={c.x}
					cy={c.y}
					r={R}
					fill={shown ? statusColor(ok) : 'var(--stage-grid)'}
					fill-opacity={shown ? (ok ? 0.08 : 0.16) : 0.2}
					stroke={shown ? statusColor(ok) : 'var(--stage-line)'}
					stroke-width={activeCheck === j ? 3.5 : shown && !ok ? 2.5 : 1.5}
				/>
			{/each}
			{#each CHECKS as k, j (k)}
				{@const shown = checksShown > j}
				{@const ok = passes(k)}
				{@const lx = k === 1 ? 176 : k === 2 ? 444 : 310}
				{@const ly = k === 4 ? 486 : 110}
				{@const anchor = k === 1 ? 'end' : k === 2 ? 'start' : 'middle'}
				{@render txt(lx, ly, `check ${k}`, 14, { anchor, weight: 700, color: 'var(--ec-check)' })}
				{@render txt(
					lx,
					ly + 18,
					shown ? (ok ? `${word(ones(k))} 1s: even ✓` : `${word(ones(k))} 1s: odd ✗`) : 'checking…',
					12,
					{
						anchor,
						weight: 600,
						color: shown ? statusColor(ok) : undefined,
						muted: !shown,
						opacity: shown || activeCheck === j ? 1 : 0.5
					}
				)}
			{/each}
		</g>
	{/if}

	<!-- the bits -->
	{#each venn as b (b.key)}
		{@const bit = received[b.pos - 1]}
		{@const col = bitColor(b.pos)}
		{@const flipped = flips[b.pos - 1] === 1}
		{@const isSuspect = suspect === b.pos}
		{@const hidden = !isParity && (b.pos === 1 || b.pos === 2) ? mix.current : 1}
		{@const pos = isParity ? b.pos : b.pos}
		<g
			class="focusable"
			role="switch"
			tabindex="0"
			aria-checked={flipped}
			aria-label="Received bit {b.name}: {bit}. {flipped ? 'Flipped by noise' : 'Not flipped'}"
			style:cursor="pointer"
			opacity={hidden}
			onclick={() => toggleFlip(pos)}
			onkeydown={(e) => onKey(e, () => toggleFlip(pos))}
		>
			<circle cx={b.x} cy={b.y} r="27" fill="transparent" />
			<circle
				class="ring"
				cx={b.x}
				cy={b.y}
				r="27"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2.5"
			/>
			{#if isSuspect}
				<circle
					cx={b.x}
					cy={b.y}
					r={26 + 3 * pulse}
					fill="none"
					stroke="var(--ec-fix)"
					stroke-width="3"
					opacity={0.55 + 0.45 * pulse}
				/>
			{/if}
			<circle
				cx={b.x}
				cy={b.y}
				r="20"
				fill={bit ? col : 'var(--surface)'}
				stroke={flipped ? 'var(--ec-bad)' : col}
				stroke-width={flipped ? 3 : 2}
				stroke-dasharray={flipped ? '5 3' : undefined}
			/>
			{@render txt(b.x, b.y + 6, String(bit), 17, {
				anchor: 'middle',
				weight: 700,
				color: bit ? 'var(--stage-bg)' : col,
				halo: false
			})}
		</g>
		<!-- position number (Hamming) or name (parity), under the bit -->
		{@render txt(
			b.x,
			b.y + 37,
			isParity
				? b.name
				: addr.current > 0.5
					? (b.pos >>> 0).toString(2).padStart(3, '0')
					: String(b.pos),
			11,
			{ anchor: 'middle', muted: true, weight: 600, opacity: hidden }
		)}
		{#if isSuspect}
			{@const off = FIX_LABEL[b.pos] ?? { dx: 0, dy: -32, anchor: 'middle' }}
			{@render txt(b.x + off.dx, b.y + off.dy, `fix: ${bit} → ${bit ^ 1}`, 12, {
				anchor: off.anchor,
				weight: 700,
				color: 'var(--ec-fix)'
			})}
		{/if}
	{/each}

	<!-- legend -->
	<g transform="translate(24 548)">
		<circle cx="8" cy="0" r="7" fill="var(--ec-data)" />
		{@render txt(22, 4, 'data bit', 12)}
		<circle cx="100" cy="0" r="7" fill="var(--ec-check)" />
		{@render txt(114, 4, isParity ? 'parity bit' : 'check bit', 12)}
		<circle
			cx="208"
			cy="0"
			r="7"
			fill="var(--surface)"
			stroke="var(--ec-bad)"
			stroke-width="2"
			stroke-dasharray="3 2"
		/>
		{@render txt(222, 4, 'flipped by noise', 12)}
		{@render txt(0, 28, 'Click a bit in the diagram or in the received row to flip it.', 12, {
			muted: true
		})}
	</g>

	<!-- ============================== the panel ============================== -->
	{@render txt(PX, 44, 'Message (data bits) — click to change', 12, { muted: true, weight: 600 })}
	{#each data as bit, i (i)}
		<g
			class="focusable"
			role="switch"
			tabindex="0"
			aria-checked={bit === 1}
			aria-label="Message bit d{i + 1}"
			style:cursor="pointer"
			onclick={() => setData(i)}
			onkeydown={(e) => onKey(e, () => setData(i))}
		>
			<rect
				class="ring"
				x={cellX(i) - CELL / 2 - 4}
				y={ROW_MSG - CELL / 2 - 4}
				width={CELL + 8}
				height={CELL + 8}
				rx="10"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2.5"
			/>
			{@render cell(cellX(i), ROW_MSG, bit, 'var(--ec-data)')}
		</g>
		{@render txt(cellX(i), ROW_MSG + 34, `d${i + 1}`, 11, { anchor: 'middle', muted: true })}
	{/each}

	{@render txt(PX, ROW_SENT - 34, isParity ? 'Sent: data + parity bit' : 'Sent: 7-bit block', 12, {
		muted: true,
		weight: 600
	})}
	{#each sent as bit, i (i)}
		{@const pos = i + 1}
		{@render cell(cellX(i), ROW_SENT, bit, bitColor(pos))}
	{/each}

	{@render txt(PX, ROW_RECV - 34, 'Received — click to flip', 12, { muted: true, weight: 600 })}
	{#each received as bit, i (i)}
		{@const pos = i + 1}
		{@const flipped = flips[i] === 1}
		<g
			class="focusable"
			role="switch"
			tabindex="0"
			aria-checked={flipped}
			aria-label="Flip received bit {isParity ? (i < 4 ? `d${i + 1}` : 'P') : pos}"
			style:cursor="pointer"
			onclick={() => toggleFlip(pos)}
			onkeydown={(e) => onKey(e, () => toggleFlip(pos))}
		>
			<rect
				class="ring"
				x={cellX(i) - CELL / 2 - 4}
				y={ROW_RECV - CELL / 2 - 4}
				width={CELL + 8}
				height={CELL + 8}
				rx="10"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2.5"
			/>
			{@render cell(cellX(i), ROW_RECV, bit, bitColor(pos), {
				flipped,
				fixed: suspect === pos
			})}
		</g>
		{@render txt(
			cellX(i),
			ROW_RECV + 34,
			isParity
				? i < 4
					? `d${i + 1}`
					: 'P'
				: addr.current > 0.5
					? pos.toString(2).padStart(3, '0')
					: String(pos),
			11,
			{ anchor: 'middle', muted: true, weight: 600 }
		)}
	{/each}

	<!-- verdict -->
	{#if isParity}
		{#if verdict}
			{@render txt(PX, 350, parityPass ? 'Even: the receiver accepts it.' : 'Odd: an error!', 15, {
				weight: 700,
				color: statusColor(parityPass)
			})}
			{@render txt(
				PX,
				376,
				parityPass
					? nFlips > 0
						? `But ${word(nFlips)} bits are wrong: the damage slipped through.`
						: 'Nothing was flipped. All good.'
					: 'But which bit? Every one of them would give this count.',
				13
			)}
			{@render txt(
				PX,
				400,
				parityPass
					? nFlips > 0
						? 'An even number of flips can’t be seen.'
						: ''
					: 'All it can do is ask for the data again.',
				13,
				{ muted: true }
			)}
		{:else}
			{@render txt(PX, 350, 'Counting the 1s…', 15, { weight: 700, muted: true })}
		{/if}
	{:else}
		{@const ax = addr.current}
		{#each CHECKS as k, j (k)}
			{@const shown = checksShown > j}
			{@const ok = passes(k)}
			{@const y = 336 + j * 24}
			{@render txt(PX, y, `check ${k}`, 13, { weight: 700, color: 'var(--ec-check)' })}
			{@render txt(PX + 66, y, `covers ${covered(k).join(' ')}`, 13, { muted: true })}
			{#if shown}
				{@render txt(PX + 196, y, ok ? 'even ✓' : 'odd ✗', 13, {
					weight: 700,
					color: statusColor(ok)
				})}
				{#if ax > 0.01}
					{@render txt(PX + 264, y, ok ? '→ 0' : '→ 1', 13, { weight: 700, opacity: ax })}
				{/if}
			{/if}
		{/each}
		{#if verdict}
			{@const pos = dec.position}
			{@render txt(
				PX,
				428,
				pos === 0
					? 'All checks even: no error.'
					: ax > 0.5
						? `Checks 4 2 1 → ${pos.toString(2).padStart(3, '0')} in binary = ${pos}`
						: `Failing: ${failing.map((k) => `check ${k}`).join(' + ')} → position ${pos}`,
				15,
				{ weight: 700, color: pos === 0 ? 'var(--ec-ok)' : undefined }
			)}
			{@render txt(
				PX,
				452,
				pos === 0
					? nFlips > 0
						? 'But bits were flipped: too many for this code.'
						: 'The message is read straight from the data bits.'
					: `The receiver flips bit ${pos} back.`,
				13,
				{ color: pos > 0 ? 'var(--ec-fix)' : undefined, weight: 600 }
			)}
			<!-- decoded message -->
			{@render txt(PX, 492, 'Decoded message', 12, { muted: true, weight: 600 })}
			{#each dec.data as bit, i (i)}
				{@render cell(PX + 140 + i * 44, 488, bit, 'var(--ec-data)', { wrong: bit !== data[i] })}
			{/each}
			{@render txt(
				PX,
				534,
				wrongBits === 0
					? nFlips > 0
						? '✓ same as the message: repaired'
						: '✓ same as the message'
					: `✗ ${word(wrongBits)} bit${wrongBits > 1 ? 's' : ''} wrong — and the receiver can’t tell`,
				13,
				{ weight: 700, color: statusColor(wrongBits === 0) }
			)}
			{#if wrongBits > 0 && nFlips === 2}
				{@render txt(
					PX,
					556,
					`Two flips (${flips.flatMap((f, i) => (f ? [i + 1] : [])).join(' and ')}) look like one at ${pos}.`,
					12,
					{
						muted: true
					}
				)}
			{/if}
		{:else}
			{@render txt(PX, 428, 'Checking the circles…', 15, { weight: 700, muted: true })}
		{/if}
	{/if}
</g>

<style>
	.focusable {
		outline: none;
	}
	.focusable .ring {
		opacity: 0;
	}
	.focusable:focus-visible .ring {
		opacity: 1;
	}
</style>
