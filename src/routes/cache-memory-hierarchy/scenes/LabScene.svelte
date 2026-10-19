<script lang="ts">
	/**
	 * The lab: a small cache and the memory it serves, one access at a time (../model.ts
	 * `labRun`). Left, the program's data, one cell per number (or list node), 3 units per byte,
	 * with ticks at the line boundaries; a cell is tinted while its line is in the cache, and the
	 * cell being loaded flashes green (hit) or red (miss). Right, the cache: one row per set, one
	 * slot per way, each slot naming the line it holds. Below, the running average memory access
	 * time and the counts, the misses sorted into the three Cs.
	 *
	 * Hints (`step.hints`): `pattern`, `size`, `line`, `ways` (an index into LAB.ways) and
	 * `policy`, each a fixed value or `@param` for a control of the step; `focus: 'address'`
	 * shows how the current address splits into tag, set and offset. Accesses play out faster
	 * and faster over about RUN seconds, then the last frame holds; reduced motion shows the
	 * finished run.
	 */
	import { Axes, Label, clamp, linePath, scale, thin } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		LAB,
		LATENCY,
		PATTERNS,
		amat,
		bytes,
		labRun,
		type CacheConfig,
		type Pattern,
		type Policy,
		type Region
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	/** A hint's value: literal, or `@id` for the control `id`. */
	function hint(key: string): string | number | boolean | undefined {
		const h = step.hints?.[key];
		if (typeof h === 'string' && h.startsWith('@')) return params[h.slice(1)];
		return h;
	}
	/** The lab step names a program and whether to run its cache-friendly version. */
	function labPattern(): Pattern {
		const good = params.friendly === true;
		switch (params.program) {
			case 'sum':
				return good ? 'row' : 'col';
			case 'list':
				return good ? 'list' : 'scattered';
			case 'dot':
				return 'dot';
			case 'loop':
				return 'loop';
			default:
				return good ? 'blocked' : 'matmul';
		}
	}
	const pattern = $derived(
		hint('pattern') === 'lab' ? labPattern() : ((hint('pattern') ?? 'row') as Pattern)
	);
	const config = $derived<CacheConfig>({
		size: Number(hint('size') ?? 512),
		line: Number(hint('line') ?? 64),
		ways: LAB.ways[clamp(Math.round(Number(hint('ways') ?? 0)), 0, LAB.ways.length - 1)],
		policy: (hint('policy') ?? 'lru') as Policy
	});
	const focus = $derived(step.hints?.focus === 'address' ? 'address' : 'plain');
	const lab = $derived(labRun(pattern, config));
	const rp = $derived(lab.replay);
	const N = $derived(rp.events.length);
	const S = $derived(rp.sets * rp.ways);

	// ---- time -------------------------------------------------------------------------------
	/** Seconds the run takes: longer runs play faster, a short one no faster than ~2 a second. */
	const RUN = $derived(clamp(N / 11, 8, 24));
	const shown = $derived.by(() => {
		if (reduced) return N;
		const u = clamp((t - 0.6) / RUN);
		return Math.min(N, Math.floor(N * (0.25 * u + 0.75 * u * u) + (t > 0.6 ? 1 : 0)));
	});
	const cur = $derived(shown - 1);
	const ev = $derived(cur >= 0 ? rp.events[cur] : null);
	const tally = $derived(cur >= 0 ? rp.totals[cur] : null);
	/** The line in each slot now. */
	const frame = $derived(cur >= 0 ? rp.slots.subarray(cur * S, (cur + 1) * S) : null);
	const resident = $derived(new Set(frame ? Array.from(frame).filter((l) => l >= 0) : []));

	// ---- memory layout ------------------------------------------------------------------------
	const PX = 3; // units per byte
	/** Cell height: the three matrices of the product need a little less. */
	const CH = $derived(pattern === 'matmul' || pattern === 'blocked' ? 15 : 18);
	const MX = 36;
	const MY = 96;
	interface Placed extends Region {
		x: number;
		y: number;
		colour: string;
	}
	const COLOURS = ['var(--cm-a)', 'var(--cm-b)', 'var(--cm-c)'];
	const placed = $derived.by((): Placed[] => {
		const out: Placed[] = [];
		let x = MX;
		let y = MY;
		let rowH = 0;
		lab.trace.regions.forEach((r, i) => {
			const w = r.cols * r.elem * PX;
			if (x > MX && x + w > MX + 420) {
				x = MX;
				y += rowH + 34;
				rowH = 0;
			}
			out.push({ ...r, x, y, colour: COLOURS[i % COLOURS.length] });
			rowH = Math.max(rowH, r.rows * CH);
			if (w <= 200) x += w + 24;
			else {
				x = MX;
				y += r.rows * CH + (pattern === 'dot' ? 58 : 34);
				rowH = 0;
			}
		});
		return out;
	});
	/** Where an address is drawn, and its region. */
	function cellOf(address: number) {
		for (const r of placed) {
			const k = Math.floor((address - r.base) / r.elem);
			if (address >= r.base && k < r.rows * r.cols) {
				const w = r.elem * PX;
				return { r, x: r.x + (k % r.cols) * w, y: r.y + Math.floor(k / r.cols) * CH, w };
			}
		}
		return null;
	}
	/** Every cell, with its line. */
	const cells = $derived(
		placed.flatMap((r, ri) =>
			Array.from({ length: r.rows * r.cols }, (_, k) => {
				const address = r.base + k * r.elem;
				const w = r.elem * PX;
				return {
					key: `${ri}:${k}`,
					address,
					line: Math.floor(address / config.line),
					x: r.x + (k % r.cols) * w,
					y: r.y + Math.floor(k / r.cols) * CH,
					w,
					colour: r.colour
				};
			})
		)
	);
	/** Line boundaries inside each row of each region. */
	const ticks = $derived(
		placed
			.map((r) => {
				let d = '';
				const rowBytes = r.cols * r.elem;
				for (let row = 0; row < r.rows; row++)
					for (let b = config.line; b < rowBytes; b += config.line) {
						if ((r.base + row * rowBytes + b) % config.line) continue;
						const x = r.x + b * PX;
						d += `M${x} ${r.y + row * CH - 1}v${CH} `;
					}
				return d;
			})
			.join('')
	);

	/** A short name for a line: its region and the first element's position. */
	function lineName(ln: number) {
		const c = cellOf(ln * config.line);
		if (!c) return `line ${ln}`;
		const k = Math.floor((ln * config.line - c.r.base) / c.r.elem);
		if (c.r.name === 'list') return `slots ${k}–${k + config.line / c.r.elem - 1}`;
		if (c.r.rows === 1 || c.r.name === 'table' || c.r.name === 'a' || c.r.name === 'b')
			return `${c.r.name}[${k}…]`;
		return `${c.r.name} ${Math.floor(k / c.r.cols)},${k % c.r.cols}…`;
	}
	function lineColour(ln: number) {
		return cellOf(ln * config.line)?.r.colour ?? 'var(--stage-ink-muted)';
	}

	// ---- cache layout -------------------------------------------------------------------------
	const CX0 = 520;
	const CX1 = 936;
	const CY0 = 96;
	const CY1 = 372;
	/** Fully associative sets wrap their ways four to a row. */
	const perRow = $derived(Math.min(rp.ways, 4));
	const rowsPerSet = $derived(Math.ceil(rp.ways / perRow));
	const totalRows = $derived(rp.sets * rowsPerSet);
	const groups = $derived(totalRows > 16 ? totalRows / 16 : 1);
	const rowsPerGroup = $derived(totalRows / groups);
	const groupW = $derived((CX1 - CX0 - 34 * groups) / groups);
	const slotW = $derived(Math.min(150, (groupW - 4 * (perRow - 1)) / perRow));
	const slotH = $derived(Math.min(30, (CY1 - CY0 - 3 * (rowsPerGroup - 1)) / rowsPerGroup));
	function slotXY(slot: number) {
		const set = Math.floor(slot / rp.ways);
		const way = slot % rp.ways;
		const r = set * rowsPerSet + Math.floor(way / perRow);
		const g = Math.floor(r / rowsPerGroup);
		const row = r % rowsPerGroup;
		return {
			x: CX0 + 34 + g * (groupW + 34) + (way % perRow) * (slotW + 4),
			y: CY0 + row * (slotH + 3)
		};
	}
	const slots = $derived(
		Array.from({ length: S }, (_, s) => ({ s, ...slotXY(s), ln: frame ? frame[s] : -1 }))
	);
	const setLabels = $derived(
		Array.from({ length: rp.sets }, (_, set) => ({ set, ...slotXY(set * rp.ways) }))
	);

	// ---- the current access ---------------------------------------------------------------------
	const hitColour = (k: string) => (k === 'hit' ? 'var(--cm-hit)' : 'var(--cm-miss)');
	const curCell = $derived(ev ? cellOf(ev.address) : null);
	const curSlot = $derived(ev ? slotXY(ev.slot) : null);
	const flash = 1;

	// ---- plot of the running AMAT --------------------------------------------------------------
	const PX0 = 92;
	const PX1 = 560;
	const PY0 = 430;
	const PY1 = 560;
	const sx = $derived(scale([0, Math.max(1, N)], [PX0, PX1]));
	const sy = scale([0, 260], [PY1, PY0]);
	const series = $derived(rp.totals.map((tt, i) => ({ i: i + 1, a: amat(tt) })));
	const path = $derived(
		linePath(
			thin(series.slice(0, Math.max(0, shown))),
			(d) => d.i,
			(d) => d.a,
			sx,
			sy
		)
	);

	// ---- readouts -------------------------------------------------------------------------------
	const name = $derived(PATTERNS.find((p) => p.value === pattern)?.label ?? pattern);
	const waysText = $derived(
		rp.sets === 1 ? 'fully associative' : rp.ways === 1 ? 'direct-mapped' : `${rp.ways}-way`
	);
	const cfgText = $derived(
		`${bytes(config.size)} · ${config.line}-byte lines · ${rp.sets} set${rp.sets > 1 ? 's' : ''} × ${rp.ways} way${rp.ways > 1 ? 's' : ''} (${waysText})${rp.ways > 1 ? ` · ${config.policy.toUpperCase()}` : ''}`
	);
	const misses = $derived(tally?.misses ?? 0);
	const A = $derived(tally ? amat(tally) : 0);
	const fmt = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 });

	// the three Cs bar
	const BX0 = 610;
	const BX1 = 930;
	const bw = $derived(tally && tally.accesses ? (BX1 - BX0) / tally.accesses : 0);
	const bars = $derived(
		tally
			? [
					{ k: 'hits', n: tally.hits, c: 'var(--cm-hit)' },
					{ k: 'compulsory', n: tally.compulsory, c: 'var(--cm-compulsory)' },
					{ k: 'capacity', n: tally.capacity, c: 'var(--cm-capacity)' },
					{ k: 'conflict', n: tally.conflict, c: 'var(--cm-conflict)' }
				]
			: []
	);
	const barX = $derived(
		bars.map((_, i) => BX0 + bars.slice(0, i).reduce((s, b) => s + b.n * bw, 0))
	);

	// address split
	const offBits = $derived(Math.log2(config.line));
	const setBits = $derived(Math.log2(rp.sets));
	const ADDR_BITS = 12;
	const bits = $derived(
		ev
			? Array.from({ length: ADDR_BITS }, (_, i) => {
					const b = ADDR_BITS - 1 - i;
					const field = b < offBits ? 'offset' : b < offBits + setBits ? 'set' : 'tag';
					return { i, bit: (ev.address >> b) & 1, field };
				})
			: []
	);
	const fieldColour = (f: string) =>
		f === 'offset' ? 'var(--stage-ink-muted)' : f === 'set' ? 'var(--cm-c)' : 'var(--cm-a)';
	const tagOf = $derived(ev ? Math.floor(ev.line / rp.sets) : 0);
</script>

<g>
	<Readout id="title" order={1} label="Program" value={name}>
		<Label x={24} y={30} text={name} size={15} weight={600} anchor="start" />
	</Readout>
	<Readout id="cfg" order={2} label="Cache" value={cfgText}>
		<Label x={24} y={52} text="cache: {cfgText}" size={12} anchor="start" muted />
	</Readout>

	<!-- memory -->
	<Label x={MX} y={76} text="memory" size={12} weight={600} anchor="start" muted />
	{#each placed as r (r.name)}
		<Label
			x={r.x + r.cols * r.elem * PX}
			y={r.y - 6}
			text={r.name === 'list' ? 'list nodes, 16 bytes each, in memory order' : r.name}
			size={12}
			weight={600}
			anchor="end"
			color={r.colour}
		/>
	{/each}
	{#if pattern === 'dot' && placed.length === 2}
		<Label
			x={MX}
			y={placed[1].y - 22}
			text="⋮ b starts {bytes(config.size)} after a ({bytes(
				config.size - 256
			)} of other data between)"
			size={11}
			anchor="start"
			muted
		/>
	{/if}
	{#each cells as c (c.key)}
		<rect
			x={c.x + 0.5}
			y={c.y}
			width={c.w - 1}
			height={CH - 2}
			rx="2"
			fill={resident.has(c.line) ? c.colour : 'var(--surface)'}
			fill-opacity={resident.has(c.line) ? 0.32 : 1}
			stroke="var(--border)"
			stroke-width="0.6"
		/>
	{/each}
	<path d={ticks} stroke="var(--stage-ink)" stroke-width="2" opacity="0.55" />

	<!-- cache -->
	<Label x={CX0} y={76} text="cache" size={12} weight={600} anchor="start" muted />
	{#if slotH >= 12 && rp.sets > 1}
		{#each setLabels as s (s.set)}
			<text
				x={s.x - 6}
				y={s.y + slotH / 2 + 4}
				text-anchor="end"
				font-size="10"
				fill="var(--stage-ink-muted)">set {s.set}</text
			>
		{/each}
	{/if}
	{#each slots as s (s.s)}
		<rect
			x={s.x}
			y={s.y}
			width={slotW}
			height={slotH}
			rx="3"
			fill={s.ln >= 0 ? lineColour(s.ln) : 'var(--surface)'}
			fill-opacity={s.ln >= 0 ? 0.32 : 1}
			stroke="var(--border)"
		/>
		{#if s.ln >= 0 && slotH >= 13 && slotW >= 44}
			<text
				x={s.x + slotW / 2}
				y={s.y + slotH / 2 + 4}
				text-anchor="middle"
				font-size={slotW >= 90 ? 11 : 9}
				fill="var(--stage-ink)">{lineName(s.ln)}</text
			>
		{/if}
	{/each}

	<!-- the current access -->
	{#if ev && curCell && curSlot}
		<line
			x1={curCell.x + curCell.w}
			y1={curCell.y + CH / 2}
			x2={curSlot.x}
			y2={curSlot.y + slotH / 2}
			stroke={hitColour(ev.kind)}
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity={0.7 * flash}
		/>
		<rect
			x={curCell.x - 1}
			y={curCell.y - 1}
			width={curCell.w + 1}
			height={CH}
			rx="3"
			fill={hitColour(ev.kind)}
			opacity={flash}
		/>
		<rect
			x={curSlot.x - 1.5}
			y={curSlot.y - 1.5}
			width={slotW + 3}
			height={slotH + 3}
			rx="4"
			fill="none"
			stroke={hitColour(ev.kind)}
			stroke-width="3"
		/>
	{/if}

	<!-- running AMAT -->
	<Axes {sx} {sy} xLabel="loads" yTicks={[0, 50, 100, 150, 200, 250]} />
	<line
		x1={PX0}
		x2={PX1}
		y1={sy(LATENCY.mem)}
		y2={sy(LATENCY.mem)}
		stroke="var(--cm-miss)"
		stroke-dasharray="3 4"
		opacity="0.6"
	/>
	<Label
		x={PX1}
		y={sy(LATENCY.mem) - 6}
		text="every load from memory"
		size={10}
		anchor="end"
		muted
	/>
	<path d={path} fill="none" stroke="var(--cm-a)" stroke-width="2.2" />
	<Label
		x={PX0}
		y={PY0 - 12}
		text="average memory access time so far, cycles"
		size={11}
		anchor="start"
		muted
	/>

	<!-- counts -->
	<Readout
		id="loads"
		order={3}
		label="Loads"
		value="{fmt(shown)} of {fmt(N)}: {fmt(misses)} {misses === 1 ? 'miss' : 'misses'}"
	>
		<Label
			x={BX0}
			y={426}
			text="{fmt(shown)} of {fmt(N)} loads · {fmt(misses)} {misses === 1 ? 'miss' : 'misses'} ({fmt(
				tally ? (100 * misses) / tally.accesses : 0
			)} %)"
			size={13}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="amat"
		order={4}
		label="Average access time"
		value="{A.toFixed(1)} cycles"
		color="var(--cm-a)"
	>
		<Label
			x={BX0}
			y={448}
			text="average access: {A.toFixed(1)} cycles"
			size={13}
			weight={600}
			anchor="start"
			color="var(--cm-a)"
			tabular
		/>
	</Readout>

	{#if focus === 'address'}
		{#if ev}
			<Readout
				id="addr"
				order={5}
				label="Address"
				value="{ev.address} = tag {tagOf}, set {ev.set}, byte {ev.address % config.line}"
			>
				<Label
					x={BX0}
					y={480}
					text="address {ev.address} in binary:"
					size={11}
					anchor="start"
					muted
					tabular
				/>
				{#each bits as b (b.i)}
					<rect
						x={BX0 + b.i * 26}
						y={490}
						width={23}
						height={24}
						rx="3"
						fill={fieldColour(b.field)}
						fill-opacity="0.22"
						stroke={fieldColour(b.field)}
					/>
					<text
						x={BX0 + b.i * 26 + 11.5}
						y={507}
						text-anchor="middle"
						font-size="13"
						font-family="ui-monospace, monospace">{b.bit}</text
					>
				{/each}
				<Label
					x={BX0}
					y={534}
					text="tag {tagOf}"
					size={12}
					weight={600}
					anchor="start"
					color="var(--cm-a)"
					tabular
				/>
				<Label
					x={BX0 + 110}
					y={534}
					text={setBits > 0 ? `set ${ev.set}` : 'no set bits'}
					size={12}
					weight={600}
					anchor="start"
					color="var(--cm-c)"
					tabular
				/>
				<Label
					x={BX0 + 220}
					y={534}
					text="byte {ev.address % config.line} of the line"
					size={12}
					anchor="start"
					muted
					tabular
				/>
				<Label
					x={BX0}
					y={556}
					text="{ADDR_BITS -
						offBits -
						setBits} tag bits · {setBits} set bits · {offBits} offset bits"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}
	{:else if tally}
		<Readout
			id="3c"
			order={5}
			label="Hits · compulsory · capacity · conflict"
			value="{fmt(tally.hits)} · {fmt(tally.compulsory)} · {fmt(tally.capacity)} · {fmt(
				tally.conflict
			)}"
		>
			{#each bars as b, i (b.k)}
				{#if b.n > 0}
					<rect x={barX[i]} y={466} width={b.n * bw} height={18} fill={b.c} opacity="0.85" />
				{/if}
			{/each}
			{#each bars as b, i (b.k)}
				<rect
					x={BX0 + (i % 2) * 160}
					y={496 + Math.floor(i / 2) * 22}
					width="11"
					height="11"
					rx="2"
					fill={b.c}
				/>
				<Label
					x={BX0 + (i % 2) * 160 + 17}
					y={506 + Math.floor(i / 2) * 22}
					text="{b.k} {fmt(b.n)}"
					size={12}
					anchor="start"
					tabular
				/>
			{/each}
			<Label
				x={BX0}
				y={556}
				text="a hit costs {LATENCY.l1} cycles, a miss {LATENCY.mem}"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
