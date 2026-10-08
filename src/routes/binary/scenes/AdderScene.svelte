<script lang="ts">
	/**
	 * Binary addition of two bytes, done as on paper: a carry row, the two
	 * numbers, a rule and the result, worked column by column from the right.
	 *
	 * Phases (`step.hints.phase`):
	 *   add      — controls `a`, `b`; unsigned readouts; a legend of the four
	 *              column cases with the active one highlighted
	 *   overflow — controls `oa`, `ob`, `view` (unsigned | signed); the carry out
	 *              of the leftmost column flies out and is lost; the readout
	 *              explains the wrap-round; a small odometer rolls 999 → 000
	 *
	 * The ripple is a pure function of the time since the two numbers last
	 * changed (a frame-to-frame memo inside a $derived, the guide's sanctioned
	 * exception, as in TrackScene): ~0.7 s per column, then the finished sum is
	 * held for a few seconds and the whole thing loops. Under reduced motion the
	 * finished sum is shown with every carry in place.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, norm, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { add, placeValue, signed, toBits, unsigned } from '../binary';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------------
	const TILE = 52;
	const SLOT = 30;
	const X0 = 240; // centre of the leftmost column
	const colX = (i: number) => X0 + i * 60 + (i >= 4 ? 16 : 0);
	const OUT_X = colX(0) - 60; // the carry-out slot (a ninth column that isn't there)
	const GRID_L = colX(0) - TILE / 2;
	const GRID_R = colX(7) + TILE / 2;
	const MID = (GRID_L + GRID_R) / 2;
	const Y_CARRY = 140;
	const Y_A = 210;
	const Y_B = 274;
	const Y_RULE = 312;
	const Y_SUM = 352;
	const Y_PLACE = 398;
	const Y_PILL = 436;
	const RX = 736; // readouts
	const LOST = { x: 98, y: 330 };
	const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
	const minus = (v: number) => String(v).replace('-', '−');
	const COLS = [0, 1, 2, 3, 4, 5, 6, 7];

	// ---- phase and inputs ------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'add') === 'overflow' ? 'overflow' : 'add');
	const over = $derived(phase === 'overflow');
	const num = (v: unknown, d: number) => Math.round(clamp(Number(v ?? d), 0, 255));
	const A = $derived(over ? num(params.oa, 200) : num(params.a, 45));
	const B = $derived(over ? num(params.ob, 100) : num(params.b, 27));
	const isSigned = $derived(over && params.view === 'signed');
	const aBits = $derived(toBits(A, 8));
	const bBits = $derived(toBits(B, 8));
	const sum = $derived(add(aBits, bBits));
	const read = (bits: number[]) => (isSigned ? signed(bits) : unsigned(bits));
	const ra = $derived(read(aBits));
	const rb = $derived(read(bBits));
	const rs = $derived(read(sum.bits));
	const trueSum = $derived(ra + rb);

	const wOver = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const target = over ? 1 : 0;
		untrack(() => wOver.set(target, { duration: reduced ? 0 : 700 }));
	});

	// ---- timeline ---------------------------------------------------------------------
	const LEAD = 0.8;
	const COL = 0.7;
	const HOLD = 4;
	const FADE = 0.5;
	const RIPPLE = LEAD + 8 * COL;
	const END = $derived(RIPPLE + (sum.carryOut ? 1.2 : 0.2));
	const PERIOD = $derived(END + HOLD);

	// Time since the numbers last changed: the ripple restarts then (TrackScene's memo).
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${A}|${B}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	// Reduced motion: the finished sum, held (no fade-out).
	const tau = $derived(reduced ? END + 1 : since % PERIOD);
	const fade = $derived(1 - smoothstep(PERIOD - FADE, PERIOD, tau));
	/** Progress (0–1, unclamped) through ripple step k (k = 0 is the rightmost column). */
	const u = (k: number) => (tau - LEAD - k * COL) / COL;
	const activeK = $derived(tau >= LEAD && tau < RIPPLE ? Math.floor((tau - LEAD) / COL) : -1);
	const activeCol = $derived(activeK >= 0 ? 7 - activeK : -1);
	const columnSum = (i: number) => aBits[i] + bBits[i] + sum.carries[i];

	// Quadratic arc from the top of column c to the slot above column c − 1.
	function arc(c: number, f: number) {
		const x0 = colX(c);
		const y0 = Y_CARRY - 40;
		const x1 = c === 0 ? OUT_X : colX(c - 1);
		const y1 = Y_CARRY;
		const cx = (x0 + x1) / 2;
		const cy = Y_CARRY - 90;
		const m = 1 - f;
		return {
			x: m * m * x0 + 2 * m * f * cx + f * f * x1,
			y: m * m * y0 + 2 * m * f * cy + f * f * y1
		};
	}

	const tiles = $derived(
		COLS.map((i) => {
			const k = 7 - i;
			const w = reduced ? 1 : smoothstep(0.3, 0.6, u(k)) * fade;
			// The carry INTO column i comes from column i + 1 (ripple step k − 1).
			const fc = i === 7 || !sum.carries[i] ? 0 : reduced ? 1 : norm(u(k - 1), 0.4, 0.95);
			const hl = smoothstep(0, 0.12, u(k)) * (1 - smoothstep(0.88, 1, u(k)));
			return {
				i,
				x: colX(i),
				a: aBits[i],
				b: bBits[i],
				s: sum.bits[i],
				w,
				hl: reduced ? 0 : hl,
				carry: sum.carries[i],
				fc,
				fcOpacity: fc >= 1 ? (reduced ? 1 : fade) : 0
			};
		})
	);
	// Carries in flight (at most one at a time).
	const flying = $derived.by(() => {
		if (reduced || activeK < 0) return null;
		const c = activeCol;
		const carry = c === 0 ? sum.carryOut : sum.carries[c - 1];
		if (!carry) return null;
		const f = norm(u(activeK), 0.4, 0.95);
		if (f <= 0 || f >= 1) return null;
		return { ...arc(c, f), o: smoothstep(0, 0.15, f) };
	});
	// The carry out of the leftmost column: lands in a slot that isn't there, then drops off.
	const out = $derived.by(() => {
		if (!sum.carryOut) return null;
		const landed = reduced ? 1 : norm(u(7), 0.4, 0.95) >= 1 ? 1 : 0;
		if (!landed) return null;
		const d = reduced ? 1 : norm(tau, RIPPLE + 0.05, RIPPLE + 0.95);
		const e = d * d;
		const m = 1 - e;
		// Straight down first, then off to the left (clear of the "no 9th bit" label).
		const cx = OUT_X - 6;
		const cy = Y_CARRY + 90;
		return {
			x: m * m * OUT_X + 2 * m * e * cx + e * e * LOST.x,
			y: m * m * Y_CARRY + 2 * m * e * cy + e * e * LOST.y,
			o: (1 - 0.3 * d) * (reduced ? 1 : fade),
			tag: (reduced ? 1 : smoothstep(0.6, 1, d)) * (reduced ? 1 : fade)
		};
	});

	// Read as signed, a carry out of the leftmost column is harmless unless the
	// signed result is wrong (−1 + 1): it is shown as dropped, not as an error.
	const harmless = $derived(isSigned && sum.carryOut === 1 && !sum.signedOverflow);
	const lostColor = $derived(harmless ? 'var(--stage-ink-muted)' : 'var(--bit-overflow)');

	// ---- words --------------------------------------------------------------------------
	const pill = $derived.by(() => {
		if (activeCol >= 0) {
			const i = activeCol;
			const c = sum.carries[i];
			const s = columnSum(i);
			const terms = `${aBits[i]} + ${bBits[i]}${c ? ' + carried 1' : ''}`;
			return `${terms} = ${s.toString(2)} → write ${s % 2}${s >= 2 ? ', carry 1' : ''}`;
		}
		if (tau < LEAD) return 'Start with the rightmost column';
		if (sum.carryOut)
			return harmless
				? 'The last carry is dropped, and the signed answer is still right'
				: 'The last carry has no column to go to: it is lost';
		if (over) return `${minus(ra)} + ${minus(rb)} → stored as ${minus(rs)}`;
		return `${minus(ra)} + ${minus(rb)} = ${minus(rs)}`;
	});
	const pillW = $derived(pill.length * 7.1 + 28);
	const activeCase = $derived(activeCol >= 0 ? columnSum(activeCol) : -1);
	// The four cases, by the column's total: its two bits plus any carry.
	const CASES = [
		{ sum: '0 = 0', note: 'write 0', ways: '0 + 0' },
		{ sum: '1 = 1', note: 'write 1', ways: '0 + 1, 1 + 0, or a carry' },
		{ sum: '2 = 10', note: 'write 0, carry 1', ways: '1 + 1, or one 1 and a carry' },
		{ sum: '3 = 11', note: 'write 1, carry 1', ways: '1 + 1 and a carry' }
	];

	const lines = $derived.by(() => {
		const sumLine = `${minus(ra)} + ${minus(rb)} = ${minus(trueSum)}`;
		if (!isSigned) {
			if (sum.unsignedOverflow)
				return {
					head: sumLine,
					l2: `${trueSum} doesn't fit in 8 bits → ${trueSum} − 256 = ${rs}`,
					l2bad: true,
					l3: 'The carry out of the leftmost column is lost: the count wraps round.',
					l3bad: false
				};
			return {
				head: sumLine,
				l2: `${trueSum} fits in 8 bits (0…255) → stored as ${rs}`,
				l2bad: false,
				l3: 'No carry out of the leftmost column: no overflow.',
				l3bad: false
			};
		}
		if (sum.signedOverflow)
			return {
				head: sumLine,
				l2: `${minus(trueSum)} doesn't fit in −128…127 → ${minus(rs)}`,
				l2bad: true,
				l3: `signed overflow: two ${ra >= 0 ? 'positives gave a negative' : 'negatives gave a positive'}`,
				l3bad: true
			};
		if (sum.carryOut)
			return {
				head: sumLine,
				l2: `${minus(trueSum)} fits in −128…127 → stored as ${minus(rs)}`,
				l2bad: false,
				l3: 'carry lost, but the signed answer is right',
				l3bad: false
			};
		return {
			head: sumLine,
			l2: `${minus(trueSum)} fits in −128…127 → stored as ${minus(rs)}`,
			l2bad: false,
			l3: 'No overflow.',
			l3bad: false
		};
	});

	// ---- odometer (overflow): 997 → 998 → 999 → 000, one step a second ---------------
	const ODO = { x: 712, y: 506, dw: 30, dh: 40 };
	const odo = $derived.by(() => {
		const tt = reduced ? 2.5 : t;
		const n = Math.floor(tt) % 4;
		// 999 rolls over to 000, which is held before the loop starts again.
		const roll = reduced || n === 3 ? 0 : smoothstep(0.65, 0.95, tt % 1);
		const v = (997 + n) % 1000;
		const next = (v + 1) % 1000;
		const pad = (x: number) => String(x).padStart(3, '0');
		const now = pad(v);
		const nxt = pad(next);
		return [0, 1, 2].map((d) => ({
			d,
			now: now[d],
			next: nxt[d],
			r: now[d] === nxt[d] ? 0 : roll
		}));
	});

	const tileFill = (bit: number) => (bit ? 'var(--bit-on)' : 'var(--bit-off)');
	const tileInk = (bit: number) => (bit ? 'var(--stage-bg)' : 'var(--stage-ink-muted)');
</script>

<g class="adder">
	<!-- header, as in the byte scene -->
	{@render txt(480, 32, over ? 'When the answer does not fit' : 'Adding two bytes', 17, {
		anchor: 'middle',
		weight: 650
	})}
	{@render txt(
		480,
		54,
		over
			? isSigned
				? 'The same bytes read as signed numbers: −128 to 127'
				: 'A byte holds 0 to 255: there is no 9th column for a carry'
			: 'Column by column from the right, as on paper',
		13,
		{ anchor: 'middle', muted: true }
	)}
	<defs>
		<clipPath id="adder-odo">
			<rect x={ODO.x} y={ODO.y} width={ODO.dw * 3 + 8} height={ODO.dh} rx="6" />
		</clipPath>
	</defs>

	<!-- active column -->
	{#each tiles as c (c.i)}
		{#if c.hl > 0.01}
			<rect
				x={c.x - TILE / 2 - 6}
				y={Y_CARRY - SLOT / 2 - 8}
				width={TILE + 12}
				height={Y_SUM + TILE / 2 + 8 - (Y_CARRY - SLOT / 2 - 8)}
				rx="12"
				fill="var(--bit-on)"
				fill-opacity={0.1 * c.hl}
				stroke="var(--bit-on)"
				stroke-opacity={0.55 * c.hl}
				stroke-width="1.5"
			/>
		{/if}
	{/each}

	<!-- carry slots -->
	{#each tiles as c (c.i)}
		{#if c.i < 7}
			<rect
				x={c.x - SLOT / 2}
				y={Y_CARRY - SLOT / 2}
				width={SLOT}
				height={SLOT}
				rx="7"
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="3 3"
				opacity="0.7"
			/>
			{#if c.fcOpacity > 0.01}
				<g opacity={c.fcOpacity}>
					<rect
						x={c.x - SLOT / 2}
						y={Y_CARRY - SLOT / 2}
						width={SLOT}
						height={SLOT}
						rx="7"
						fill="var(--bit-carry)"
					/>
					{@render txt(c.x, Y_CARRY + 6, '1', 17, {
						anchor: 'middle',
						color: 'var(--stage-bg)',
						mono: true,
						weight: 700,
						halo: false
					})}
				</g>
			{/if}
		{/if}
	{/each}
	{#if over || sum.carryOut}
		<rect
			x={OUT_X - SLOT / 2}
			y={Y_CARRY - SLOT / 2}
			width={SLOT}
			height={SLOT}
			rx="7"
			fill="none"
			stroke={sum.carryOut ? lostColor : 'var(--stage-line)'}
			stroke-dasharray="2 4"
			opacity="0.6"
		/>
		{@render txt(OUT_X - 22, Y_CARRY + 4, 'no 9th bit', 11, { anchor: 'end', muted: true })}
	{/if}

	<!-- the two numbers -->
	{#each tiles as c (c.i)}
		{#each [{ y: Y_A, bit: c.a, row: 'a' }, { y: Y_B, bit: c.b, row: 'b' }] as r (r.row)}
			<rect
				x={c.x - TILE / 2}
				y={r.y - TILE / 2}
				width={TILE}
				height={TILE}
				rx="9"
				fill={tileFill(r.bit)}
				stroke={r.bit ? 'none' : 'var(--stage-line)'}
				stroke-width="1.25"
			/>
			{@render txt(c.x, r.y + 9, String(r.bit), 24, {
				anchor: 'middle',
				color: tileInk(r.bit),
				mono: true,
				weight: 700,
				halo: false
			})}
		{/each}
	{/each}
	{@render txt(GRID_L - 30, Y_B + 10, '+', 28, { anchor: 'middle', weight: 500 })}
	<line
		x1={GRID_L - 46}
		x2={GRID_R}
		y1={Y_RULE}
		y2={Y_RULE}
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-linecap="round"
	/>

	<!-- the result -->
	{#each tiles as c (c.i)}
		<rect
			x={c.x - TILE / 2}
			y={Y_SUM - TILE / 2}
			width={TILE}
			height={TILE}
			rx="9"
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="4 4"
			opacity={0.8 * (1 - c.w)}
		/>
		{#if c.w > 0.01}
			<g opacity={c.w} transform="translate(0 {-22 * (1 - c.w)})">
				<rect
					x={c.x - TILE / 2}
					y={Y_SUM - TILE / 2}
					width={TILE}
					height={TILE}
					rx="9"
					fill={tileFill(c.s)}
					stroke={c.s ? 'none' : 'var(--stage-line)'}
					stroke-width="1.25"
				/>
				{@render txt(c.x, Y_SUM + 9, String(c.s), 24, {
					anchor: 'middle',
					color: tileInk(c.s),
					mono: true,
					weight: 700,
					halo: false
				})}
			</g>
		{/if}
		{@render txt(c.x, Y_PLACE, isSigned && c.i === 0 ? '−128' : String(placeValue(c.i, 8)), 12, {
			anchor: 'middle',
			muted: !(isSigned && c.i === 0),
			color: isSigned && c.i === 0 ? 'var(--bit-sign)' : undefined,
			tabular: true
		})}
	{/each}

	<!-- carries in flight and the lost one -->
	{#if flying}
		<g opacity={flying.o}>
			<rect
				x={flying.x - SLOT / 2}
				y={flying.y - SLOT / 2}
				width={SLOT}
				height={SLOT}
				rx="7"
				fill="var(--bit-carry)"
			/>
			{@render txt(flying.x, flying.y + 6, '1', 17, {
				anchor: 'middle',
				color: 'var(--stage-bg)',
				mono: true,
				weight: 700,
				halo: false
			})}
		</g>
	{/if}
	{#if out}
		<g opacity={out.o}>
			<rect
				x={out.x - SLOT / 2}
				y={out.y - SLOT / 2}
				width={SLOT}
				height={SLOT}
				rx="7"
				fill="var(--bit-carry)"
			/>
			{@render txt(out.x, out.y + 6, '1', 17, {
				anchor: 'middle',
				color: 'var(--stage-bg)',
				mono: true,
				weight: 700,
				halo: false
			})}
		</g>
		{#if out.tag > 0.01}
			<g opacity={out.tag}>
				{@render txt(LOST.x, LOST.y + 36, harmless ? 'dropped' : 'lost', 14, {
					anchor: 'middle',
					color: lostColor,
					weight: 700
				})}
			</g>
		{/if}
	{/if}

	<!-- the column's little sum -->
	<g opacity={reduced ? 1 : fade}>
		<rect
			x={MID - pillW / 2}
			y={Y_PILL - 15}
			width={pillW}
			height="30"
			rx="15"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(MID, Y_PILL + 5, pill, 13, { anchor: 'middle', weight: 500, halo: false })}
	</g>

	<!-- readouts -->
	{@render txt(
		RX,
		Y_CARRY - 26,
		isSigned ? 'read as signed' : over ? 'read as unsigned' : 'in decimal',
		11,
		{ muted: true }
	)}
	{@render txt(RX, Y_CARRY + 5, 'carries', 13, { color: 'var(--bit-carry)', weight: 600 })}
	{@render txt(RX, Y_A + 8, minus(ra), 22, { weight: 600, tabular: true })}
	{@render txt(RX, Y_B + 8, minus(rb), 22, { weight: 600, tabular: true })}
	<g opacity={reduced ? 1 : smoothstep(END - 0.4, END + 0.2, tau) * fade}>
		{@render txt(RX, Y_SUM + 8, minus(rs), 22, {
			weight: 700,
			tabular: true,
			color: over && lines.l2bad ? 'var(--bit-overflow)' : undefined
		})}
		{#if over}
			{@render txt(RX, Y_SUM + 30, `true sum ${minus(trueSum)}`, 12, {
				muted: true,
				tabular: true
			})}
		{:else if sum.carryOut}
			{@render txt(RX, Y_SUM + 30, `not ${A + B}: see next step`, 12, {
				muted: true,
				tabular: true
			})}
		{/if}
	</g>

	<!-- add: the four cases -->
	{#if wOver.current < 0.99}
		<g opacity={1 - wOver.current}>
			<rect
				x="24"
				y="470"
				width="912"
				height="112"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(44, 494, 'Two bits plus any carry make 0, 1, 2 or 3: four cases', 13, {
				weight: 600,
				halo: false
			})}
			{#each CASES as c, k (c.sum)}
				{@const x = 44 + k * 222}
				{@const on = activeCase === k}
				<rect
					{x}
					y="504"
					width="206"
					height="68"
					rx="9"
					fill={on ? 'var(--bit-on)' : 'none'}
					fill-opacity={on ? 0.14 : 0}
					stroke={on ? 'var(--bit-on)' : 'var(--border)'}
					stroke-width={on ? 2 : 1}
				/>
				{@render txt(x + 103, 527, c.sum, 17, {
					anchor: 'middle',
					mono: true,
					weight: 600,
					halo: false
				})}
				{@render txt(x + 103, 546, c.note, 12, {
					anchor: 'middle',
					color: on ? 'var(--bit-on)' : undefined,
					halo: false,
					weight: 600
				})}
				{@render txt(x + 103, 563, c.ways, 11, { anchor: 'middle', muted: true, halo: false })}
			{/each}
		</g>
	{/if}

	<!-- overflow: the verdict and the odometer -->
	{#if wOver.current > 0.01}
		<g opacity={wOver.current}>
			<rect
				x="24"
				y="470"
				width="652"
				height="112"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(44, 500, lines.head, 17, { weight: 700, tabular: true, halo: false })}
			{@render txt(44, 527, lines.l2, 14, {
				weight: 600,
				tabular: true,
				halo: false,
				color: lines.l2bad ? 'var(--bit-overflow)' : undefined
			})}
			{@render txt(44, 554, lines.l3, 13, {
				halo: false,
				weight: lines.l3bad ? 600 : 500,
				muted: !lines.l3bad,
				color: lines.l3bad ? 'var(--bit-overflow)' : undefined
			})}

			<rect
				x="692"
				y="470"
				width="244"
				height="112"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(814, 492, 'like a 3-digit odometer', 12, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
			<rect
				x={ODO.x - 4}
				y={ODO.y - 4}
				width={ODO.dw * 3 + 16}
				height={ODO.dh + 8}
				rx="9"
				fill="var(--stage-ink)"
			/>
			<g clip-path="url(#adder-odo)">
				{#each odo as d (d.d)}
					{@const cx = ODO.x + 4 + d.d * ODO.dw + ODO.dw / 2}
					<rect
						x={cx - ODO.dw / 2 + 1}
						y={ODO.y}
						width={ODO.dw - 2}
						height={ODO.dh}
						fill="var(--stage-bg)"
					/>
					{@render txt(cx, ODO.y + 29 - d.r * ODO.dh, d.now, 24, {
						anchor: 'middle',
						mono: true,
						weight: 700,
						halo: false
					})}
					{#if d.r > 0}
						{@render txt(cx, ODO.y + 29 + (1 - d.r) * ODO.dh, d.next, 24, {
							anchor: 'middle',
							mono: true,
							weight: 700,
							halo: false
						})}
					{/if}
				{/each}
			</g>
			{@render txt(ODO.x + ODO.dw * 3 + 26, ODO.y + 18, '999 + 1', 13, {
				tabular: true,
				halo: false
			})}
			{@render txt(ODO.x + ODO.dw * 3 + 26, ODO.y + 36, '→ 000', 13, {
				tabular: true,
				halo: false,
				weight: 700
			})}
			{@render txt(814, 572, 'no wheel for the 1000s', 11, {
				anchor: 'middle',
				muted: true,
				halo: false
			})}
		</g>
	{/if}
</g>

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
		tabular?: boolean;
		mono?: boolean;
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
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-family={opts.mono ? MONO : undefined}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
