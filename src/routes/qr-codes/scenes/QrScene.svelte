<script lang="ts">
	/**
	 * A QR code for the reader's message, printed on paper, and a phone whose camera reads it.
	 * Depending on the step: the plain code, the corner squares picked out (and the phone turned),
	 * the message pieces laid down in placement order, the spare pieces (and every one of them
	 * changing when one letter does), paint the reader brushes on, preset specks or a blot, a
	 * patch over a corner square, and a choice of level. Everything is computed: the code by the
	 * encoder, the phone's verdict by the camera reader working on the picture it takes.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { startDrag } from '#lib/draw/pointer.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PX, QUIET } from '../camera';
	import {
		blot,
		brush,
		changedPieces,
		coverCorner,
		damage,
		encode,
		Kind,
		scan,
		specks,
		type Level,
		type QrCode
	} from '../model';
	import MessageBox from './MessageBox.svelte';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const DEFAULT = 'Hello from a QR code';
	const phase = $derived(String(step.hints?.phase ?? 'square'));
	const text = $derived(typeof params.msg === 'string' ? params.msg : DEFAULT);
	const level = $derived<Level>(phase === 'levels' ? ((params.level as Level) ?? 'M') : 'M');
	const code = $derived(encode(text, level) ?? (encode(DEFAULT, level) as QrCode));
	const n = $derived(code.size);
	const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

	// ---- paint: kept in params.paint as "<level>:<message>|cell,cell,…" -------------------------
	const key = $derived(`${level}:${text}`);
	const userPaint = $derived.by(() => {
		const raw = typeof params.paint === 'string' ? params.paint : '';
		const bar = raw.indexOf('|');
		if (bar < 0 || raw.slice(0, bar) !== key) return new Set<number>();
		return new Set(
			raw
				.slice(bar + 1)
				.split(',')
				.filter(Boolean)
				.map(Number)
		);
	});
	const brushes = $derived(phase === 'paint' || phase === 'levels');
	const speckSet = $derived(specks(code));
	const paint = $derived.by(() => {
		if (brushes) return userPaint;
		if (phase === 'specks')
			return params.spread === 'specks' ? speckSet : blot(code, speckSet.size);
		if (phase === 'corner' && params.cover === true) return coverCorner(code);
		return new Set<number>();
	});
	function addPaint(cells: number[]) {
		const extra = cells.filter((c) => !userPaint.has(c));
		if (extra.length) setParam('paint', `${key}|${[...userPaint, ...extra].join(',')}`);
	}
	// "Wipe the paint off": a press clears the paint (not the first run of the effect).
	const wipes = $derived(Number(params.wipe ?? 0));
	let wipesSeen = -1;
	$effect(() => {
		const w = wipes;
		untrack(() => {
			if (wipesSeen >= 0 && w !== wipesSeen) setParam('paint', '');
			wipesSeen = w;
		});
	});

	// ---- the phone's reading ------------------------------------------------------------------
	const turn = $derived(phase === 'corners' ? Number(params.turn ?? 0) : 0);
	const reading = $derived(scan(code, paint, turn));
	const dmg = $derived(damage(code, paint));

	// ---- the code on paper ----------------------------------------------------------------------
	const X0 = 36;
	const Y0 = 84;
	const S = 440;
	const cs = $derived(S / (n + 2 * QUIET));
	const ox = $derived(X0 + QUIET * cs);
	const oy = $derived(Y0 + QUIET * cs);

	const sq = (i: number) => `M${i % n} ${Math.floor(i / n)}h1v1h-1z`;
	const pathOf = (cells: Iterable<number>) => {
		let d = '';
		for (const i of cells) d += sq(i);
		return d;
	};
	/** Outlines of the given pieces: cell edges where the neighbour is another piece. */
	function outline(c: QrCode, pieces: ReadonlySet<number>): string {
		let d = '';
		const at = (r: number, k: number) =>
			r < 0 || k < 0 || r >= c.size || k >= c.size ? -1 : c.piece[r * c.size + k];
		for (let i = 0; i < c.size * c.size; i++) {
			const p = c.piece[i];
			if (p < 0 || !pieces.has(p)) continue;
			const r = Math.floor(i / c.size);
			const k = i % c.size;
			if (at(r - 1, k) !== p) d += `M${k} ${r}h1`;
			if (at(r + 1, k) !== p) d += `M${k} ${r + 1}h1`;
			if (at(r, k - 1) !== p) d += `M${k} ${r}v1`;
			if (at(r, k + 1) !== p) d += `M${k + 1} ${r}v1`;
		}
		return d;
	}

	// The spare step's "change the first letter": the same message with its first letter's case
	// flipped, drawn with the same mask so that only the pieces' contents differ.
	const swapped = $derived.by(() => {
		if (phase !== 'spare' || params.swap !== true || !text) return null;
		const first = [...text][0];
		const flipped = first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase();
		const other = (flipped === first ? 'X' : flipped) + [...text].slice(1).join('');
		const c = encode(other, level, { mask: code.mask, version: code.version });
		return c
			? { code: c, changed: new Set(changedPieces(code, c)), letter: [first, other[0]] }
			: null;
	});
	const shown = $derived(swapped?.code ?? code);

	// Build animation (message and spare steps): how many pieces are laid down so far.
	const dataPieces = $derived(code.pieceBlock.filter(([, , s]) => !s).length);
	const sparePieces = $derived(code.codewords.length - dataPieces);
	const laidData = $derived(
		phase === 'message'
			? reduced
				? dataPieces
				: Math.floor(clamp01((t - 0.8) / 10) * dataPieces + 0.0001)
			: dataPieces
	);
	const laidSpare = $derived(
		phase === 'spare'
			? reduced
				? sparePieces
				: Math.floor(clamp01((t - 0.6) / 5) * sparePieces + 0.0001)
			: phase === 'message'
				? 0
				: sparePieces
	);
	const colourMode = $derived(phase === 'message' || phase === 'spare' || phase === 'snapshot');

	interface Layer {
		id: string;
		d: string;
		fill: string;
		opacity?: number;
	}
	const layers = $derived.by((): Layer[] => {
		const c = shown;
		const plainInk: number[] = [];
		const fixedInk: number[] = [];
		const dataDark: number[] = [];
		const dataLight: number[] = [];
		const spareDark: number[] = [];
		const spareLight: number[] = [];
		const finderInk: number[] = [];
		for (let i = 0; i < c.size * c.size; i++) {
			const k = c.kinds[i];
			const dark = c.modules[i];
			if (!colourMode) {
				if (!dark) continue;
				if (phase === 'corners' && k === Kind.Finder) finderInk.push(i);
				else plainInk.push(i);
				continue;
			}
			const p = c.piece[i];
			if (p >= 0) {
				const spare = c.pieceBlock[p][2];
				// Index of this piece among its kind, in placement order (single block: data first).
				const visible = spare ? p - dataPieces < laidSpare : p < laidData;
				if (!visible) continue;
				if (spare) (dark ? spareDark : spareLight).push(i);
				else (dark ? dataDark : dataLight).push(i);
			} else if (k === Kind.Remainder) {
				if (dark && laidSpare === sparePieces) fixedInk.push(i);
			} else if (dark) fixedInk.push(i);
		}
		const dimSpare = phase === 'message';
		return [
			{
				id: 'ink',
				d: pathOf(plainInk),
				fill: 'var(--qr-ink)',
				opacity: phase === 'corners' ? 0.3 : 1
			},
			{ id: 'finder', d: pathOf(finderInk), fill: 'var(--qr-ink)' },
			{ id: 'fixed', d: pathOf(fixedInk), fill: 'var(--qr-ink)' },
			{ id: 'data-light', d: pathOf(dataLight), fill: 'var(--qr-data-light)' },
			{ id: 'data-dark', d: pathOf(dataDark), fill: 'var(--qr-data)' },
			{
				id: 'spare-light',
				d: pathOf(spareLight),
				fill: 'var(--qr-spare-light)',
				opacity: dimSpare ? 0.5 : 1
			},
			{
				id: 'spare-dark',
				d: pathOf(spareDark),
				fill: 'var(--qr-spare)',
				opacity: dimSpare ? 0.5 : 1
			}
		];
	});
	/** Message cells not laid down yet, shown as faint dots so the reader sees where they will go. */
	const pending = $derived.by(() => {
		if (!colourMode) return '';
		let d = '';
		for (let i = 0; i < n * n; i++) {
			const p = code.piece[i];
			if (p < 0) continue;
			const spare = code.pieceBlock[p][2];
			if (spare ? p - dataPieces >= laidSpare : p >= laidData)
				d += `M${(i % n) + 0.5} ${Math.floor(i / n) + 0.5}h0`;
		}
		return d;
	});

	const allPieces = $derived(new Set(code.codewords.map((_, i) => i)));
	const pieceLines = $derived(colourMode && phase !== 'snapshot' ? outline(code, allPieces) : '');
	const changedLines = $derived(swapped ? outline(code, swapped.changed) : '');
	const spoiledSet = $derived(
		new Set(
			[...paint].filter((i) => !code.modules[i] && code.piece[i] >= 0).map((i) => code.piece[i])
		)
	);
	const spoiledLines = $derived(outline(code, spoiledSet));
	const paintPath = $derived(pathOf(paint));

	// The piece being written (message step): which letter, as a caption.
	const letters = $derived.by(() => {
		const out: string[] = [];
		for (const ch of text)
			for (let k = 0; k < new TextEncoder().encode(ch).length; k++) out.push(ch);
		return out;
	});
	const writing = $derived.by(() => {
		if (phase !== 'message') return '';
		if (laidData >= dataPieces)
			return `${letters.length} letters, ${dataPieces} pieces with the filler`;
		const bits = 8 * (laidData + 1);
		if (bits <= 12) return `“this is text, ${letters.length} letters long”`;
		const k = Math.floor((bits - 12 - 1) / 8);
		if (k < letters.length)
			return `writing letter ${k + 1}: ${letters[k] === ' ' ? 'a space' : `“${letters[k]}”`}`;
		return 'an end mark, then filler';
	});

	// ---- brush: pointer and keyboard ------------------------------------------------------------
	let cursor = $state<{ r: number; c: number } | null>(null);
	let stop: (() => void) | null = null;
	$effect(() => () => stop?.());
	function paintAtPoint(p: { x: number; y: number }) {
		const col = (p.x - ox) / cs;
		const row = (p.y - oy) / cs;
		addPaint(brush(code, row, col));
	}
	function onpointerdown(e: PointerEvent) {
		if (!brushes) return;
		stop = startDrag(e, paintAtPoint, () => (stop = null));
	}
	function onkeydown(e: KeyboardEvent) {
		if (!brushes) return;
		const c = cursor ?? { r: Math.floor(n / 2), c: Math.floor(n / 2) };
		const moves: Record<string, [number, number]> = {
			ArrowUp: [-1, 0],
			ArrowDown: [1, 0],
			ArrowLeft: [0, -1],
			ArrowRight: [0, 1]
		};
		if (e.key in moves) {
			const [dr, dc] = moves[e.key];
			cursor = {
				r: Math.min(n - 1, Math.max(0, c.r + dr)),
				c: Math.min(n - 1, Math.max(0, c.c + dc))
			};
		} else if (e.key === 'Enter' || e.key === ' ') {
			cursor = c;
			addPaint(brush(code, c.r + 0.5, c.c + 0.5));
		} else return;
		e.preventDefault();
		e.stopPropagation();
	}
	let focused = $state(false);

	// ---- the phone --------------------------------------------------------------------------------
	const PHX = 636;
	const PHY = 36;
	const PHW = 288;
	const PHH = 528;
	const VF = 248;
	const VX = PHX + (PHW - VF) / 2;
	const VY = PHY + 52;
	const VC = { x: VX + VF / 2, y: VY + VF / 2 };
	/** The paper in the viewfinder is small enough to stay whole at any turn. */
	const kv = $derived(VF / 1.45 / (n + 2 * QUIET));
	const finderMarks = $derived.by(() => {
		const half = ((n + 2 * QUIET) * PX) / 2;
		const a = (turn * Math.PI) / 180;
		const reach = Math.ceil(half * (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))));
		return reading.finders.map((f, i) => ({
			i,
			x: VC.x + ((f.x + 0.5 - reach) / PX) * kv,
			y: VC.y + ((f.y + 0.5 - reach) / PX) * kv
		}));
	});
	const ok = $derived(reading.ok);
	const repaired = $derived(reading.fixed.reduce((a, b) => a + b, 0));
	/**
	 * Splits text into lines of at most `width` characters, at spaces where possible; a line that
	 * ended at a space keeps it, so the lines' text joined is the text.
	 */
	function wrap(s: string, width: number): string[] {
		const lines: string[] = [];
		let rest = [...s];
		while (rest.length > width) {
			const head = rest.slice(0, width + 1);
			const space = head.lastIndexOf(' ');
			const cut = space > 0 ? space + 1 : width;
			lines.push(rest.slice(0, cut).join(''));
			rest = rest.slice(cut);
		}
		lines.push(rest.join(''));
		return lines;
	}
	const readLines = $derived(
		reading.text === '' ? ['(an empty message)'] : wrap(reading.text ?? '', 20)
	);
	const problemLines = $derived(wrap(reading.problem ?? '', 26));
	const readValue = $derived(ok ? `reads “${reading.text}”` : `can’t read it: ${reading.problem}`);

	// ---- counters ---------------------------------------------------------------------------------
	const showCounters = $derived(
		phase === 'paint' || phase === 'specks' || phase === 'corner' || phase === 'levels'
	);
	const groups = $derived(code.blocks.length);
	const worst = $derived(Math.max(...dmg.spoiled));
	const fixable = $derived(dmg.fixable[0]);
	const piecesText = $derived(
		groups === 1
			? `${dmg.spoiled[0]} spoiled ${dmg.spoiled[0] === 1 ? 'piece' : 'pieces'} · it can repair ${fixable}`
			: `worst group: ${worst} spoiled · each group can repair ${fixable}`
	);
	const levelText = $derived(`${n} × ${n} cells, ${sparePieces} spare pieces`);

	// ---- corner labels --------------------------------------------------------------------------
	const finderBoxes = $derived([
		{ id: 'tl', r: 0, c: 0 },
		{ id: 'tr', r: 0, c: n - 7 },
		{ id: 'bl', r: n - 7, c: 0 }
	]);
	const hidden = (id: string) => phase === 'corner' && params.cover === true && id === 'tl';
	const cornerFocus = $derived(phase === 'corners' || phase === 'snapshot' || phase === 'corner');
</script>

<g class="qr">
	<!-- the message -->
	{#if phase === 'square' || phase === 'message'}
		<MessageBox x={X0} y={16} w={S} value={text} {setParam} />
	{:else}
		<Readout id="msg" order={0} label="Message" value="“{text}”">
			<Label x={X0} y={46} anchor="start" size={16} weight={600} text="Message: “{text}”" />
		</Readout>
	{/if}

	<!-- the paper and the code -->
	<rect x={X0} y={Y0} width={S} height={S} rx="10" fill="var(--qr-paper)" stroke="var(--border)" />
	<g transform="translate({ox} {oy}) scale({cs})">
		{#each layers as l (l.id)}
			{#if l.d}
				<path d={l.d} fill={l.fill} opacity={l.opacity ?? 1} />
			{/if}
		{/each}
		{#if pending}
			<path
				d={pending}
				stroke="var(--qr-ink)"
				stroke-opacity="0.25"
				stroke-width="0.22"
				stroke-linecap="round"
			/>
		{/if}
		{#if pieceLines}
			<path
				d={pieceLines}
				fill="none"
				stroke="var(--qr-ink)"
				stroke-opacity="0.4"
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
		{#if changedLines}
			<path
				d={changedLines}
				fill="none"
				stroke="var(--qr-changed)"
				stroke-width="3"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
		{#if paintPath}
			<path d={paintPath} fill="var(--qr-paint)" opacity="0.9" />
		{/if}
		{#if spoiledLines && showCounters}
			<path
				d={spoiledLines}
				fill="none"
				stroke="var(--qr-bad)"
				stroke-width="2.5"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
		{#if cornerFocus}
			{#each finderBoxes as f (f.id)}
				<rect
					x={f.c - 0.4}
					y={f.r - 0.4}
					width="7.8"
					height="7.8"
					rx="0.6"
					fill="none"
					stroke={hidden(f.id) ? 'var(--qr-bad)' : 'var(--qr-found)'}
					stroke-dasharray={hidden(f.id) ? '6 4' : undefined}
					stroke-width="3"
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		{/if}
		{#if cursor && focused && brushes}
			<circle
				cx={cursor.c + 0.5}
				cy={cursor.r + 0.5}
				r="1.1"
				fill="none"
				stroke="var(--focus)"
				stroke-width="2"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</g>
	{#if brushes}
		<rect
			class="qr-canvas"
			x={X0}
			y={Y0}
			width={S}
			height={S}
			rx="10"
			fill="transparent"
			role="button"
			aria-label="The code. Drag to paint over cells; with the keyboard, arrows move the brush and Enter paints."
			tabindex="0"
			{onpointerdown}
			{onkeydown}
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
		/>
	{/if}

	<!-- labels on the paper's margin -->
	{#if phase === 'corners'}
		<Label
			x={ox + 3.5 * cs}
			y={Y0 + 2.2 * cs}
			size={14}
			weight={700}
			color="var(--qr-on-paper-found)"
			halo={false}
			text="corner square"
		/>
		<Label
			x={ox + (n - 3.5) * cs}
			y={Y0 + 2.2 * cs}
			size={14}
			weight={700}
			color="var(--qr-on-paper-found)"
			halo={false}
			text="corner square"
		/>
		<Label
			x={ox + 3.5 * cs}
			y={oy + (n + 2.4) * cs}
			size={14}
			weight={700}
			color="var(--qr-on-paper-found)"
			halo={false}
			text="corner square"
		/>
		<Label
			x={ox + (n - 3.5) * cs}
			y={oy + (n + 2.4) * cs}
			size={14}
			weight={600}
			color="var(--qr-on-paper-muted)"
			halo={false}
			text="no square here"
		/>
	{:else if phase === 'message'}
		<Readout id="writing" order={2} label="Laying down" value={writing}>
			<Label
				x={X0 + S / 2}
				y={Y0 + S + 26}
				size={15}
				weight={600}
				color="var(--qr-data-ink)"
				text={writing}
			/>
		</Readout>
	{:else if phase === 'spare'}
		<Readout
			id="spare-note"
			order={2}
			label="Spare pieces"
			value={swapped
				? `“${swapped.letter[0]}” → “${swapped.letter[1]}”: ${[...swapped.changed].filter((w) => code.pieceBlock[w][2]).length} of ${sparePieces} spare pieces changed`
				: `${sparePieces} spare pieces, worked out from the ${dataPieces} message pieces`}
		>
			<Label
				x={X0 + S / 2}
				y={Y0 + S + 26}
				size={15}
				weight={600}
				color="var(--qr-spare-ink)"
				text={swapped
					? `“${swapped.letter[0]}” → “${swapped.letter[1]}”: ${[...swapped.changed].filter((w) => code.pieceBlock[w][2]).length} of ${sparePieces} spare pieces changed`
					: `${sparePieces} spare pieces, worked out from the ${dataPieces} message pieces`}
			/>
		</Readout>
	{:else if phase === 'snapshot'}
		<Readout
			id="key"
			order={2}
			label="Key"
			value="green: corner squares · blue: message · orange: spare"
		>
			<Label
				x={X0 + 60}
				y={Y0 + S + 26}
				size={14}
				weight={700}
				color="var(--qr-found-ink)"
				text="corner squares"
			/>
			<Label
				x={X0 + 200}
				y={Y0 + S + 26}
				size={14}
				weight={700}
				color="var(--qr-data-ink)"
				text="message"
			/>
			<Label
				x={X0 + 330}
				y={Y0 + S + 26}
				size={14}
				weight={700}
				color="var(--qr-spare-ink)"
				text="spare pieces"
			/>
		</Readout>
	{:else if showCounters}
		<Readout id="cells" order={2} label="Cells painted over" value={String(dmg.covered)}>
			<Label
				x={X0}
				y={Y0 + S + 26}
				anchor="start"
				size={15}
				weight={600}
				tabular
				text="{dmg.covered} cells painted over"
			/>
		</Readout>
		<Readout id="pieces" order={3} label="Pieces" value={piecesText} color="var(--qr-bad)">
			<Label
				x={X0}
				y={Y0 + S + 52}
				anchor="start"
				size={15}
				weight={600}
				tabular
				color="var(--qr-bad-ink)"
				text={piecesText}
			/>
		</Readout>
		{#if phase === 'levels'}
			<Readout id="size" order={4} label="Code" value={levelText}>
				<Label x={X0 + S} y={Y0 + S + 26} anchor="end" size={15} muted text={levelText} />
			</Readout>
		{/if}
	{/if}
	{#if brushes && paint.size === 0}
		<Readout id="hint"
			><Label
				x={X0 + S / 2}
				y={Y0 + S / 2}
				size={18}
				weight={700}
				pill
				text="drag across the code to paint"
			/></Readout
		>
	{/if}

	<!-- the phone -->
	<rect x={PHX} y={PHY} width={PHW} height={PHH} rx="40" fill="var(--qr-phone)" />
	<rect
		x={PHX + 12}
		y={PHY + 14}
		width={PHW - 24}
		height={PHH - 28}
		rx="30"
		fill="var(--qr-screen)"
	/>
	<rect x={PHX + PHW / 2 - 30} y={PHY + 24} width="60" height="10" rx="5" fill="var(--qr-phone)" />
	<!-- the camera's view: the world grey, the paper turned as the camera sees it -->
	<clipPath id="qr-view"><rect x={VX} y={VY} width={VF} height={VF} rx="14" /></clipPath>
	<g clip-path="url(#qr-view)">
		<rect x={VX} y={VY} width={VF} height={VF} fill="var(--qr-world)" />
		<g
			transform="translate({VC.x} {VC.y}) rotate({turn}) scale({kv}) translate({-(n + 2 * QUIET) /
				2} {-(n + 2 * QUIET) / 2})"
		>
			<rect width={n + 2 * QUIET} height={n + 2 * QUIET} fill="var(--qr-paper)" />
			<g transform="translate({QUIET} {QUIET})">
				<path d={pathOf(code.modules.flatMap((m, i) => (m ? [i] : [])))} fill="var(--qr-ink)" />
				{#if paintPath}
					<path d={paintPath} fill="var(--qr-paint)" opacity="0.9" />
				{/if}
			</g>
		</g>
		{#each finderMarks as f (f.i)}
			<rect
				x={f.x - 3.9 * kv}
				y={f.y - 3.9 * kv}
				width={7.8 * kv}
				height={7.8 * kv}
				rx="3"
				transform="rotate({turn} {f.x} {f.y})"
				fill="none"
				stroke="var(--qr-found)"
				stroke-width="3"
			/>
		{/each}
	</g>
	<!-- viewfinder corners -->
	{#each [[VX + 6, VY + 6, 1, 1], [VX + VF - 6, VY + 6, -1, 1], [VX + 6, VY + VF - 6, 1, -1], [VX + VF - 6, VY + VF - 6, -1, -1]] as [x, y, sx, sy], i (i)}
		<path
			d="M{x} {y + 22 * sy}V{y}H{x + 22 * sx}"
			fill="none"
			stroke="#ffffff"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.9"
		/>
	{/each}
	{#if turn !== 0}
		<Label x={VC.x} y={VY + VF + 22} size={13} muted text="phone turned {turn}°" />
	{/if}

	<!-- the verdict -->
	<Readout
		id="result"
		order={1}
		label="The phone"
		value={readValue}
		color={ok ? 'var(--qr-found)' : 'var(--qr-bad)'}
	>
		<rect
			x={PHX + 26}
			y={VY + VF + 38}
			width={PHW - 52}
			height={PHY + PHH - 40 - (VY + VF + 38)}
			rx="16"
			fill={ok ? 'var(--qr-ok-bg)' : 'var(--qr-bad-bg)'}
			stroke={ok ? 'var(--qr-found)' : 'var(--qr-bad)'}
			stroke-width="2"
		/>
		{#if ok}
			<text
				x={PHX + 44}
				y={VY + VF + 66}
				font-size="14"
				font-weight="600"
				fill="var(--qr-found-ink)">✓ Reads:</text
			>
			<text x={PHX + 44} y={VY + VF + 94} font-size="19" font-weight="700">
				{#each readLines as line, i (i)}<tspan x={PHX + 44} dy={i === 0 ? 0 : 24}>{line}</tspan
					>{/each}
			</text>
			{#if repaired > 0}
				<text x={PHX + 44} y={PHY + PHH - 56} font-size="13" fill="var(--stage-ink-muted)">
					after repairing {repaired} spoiled {repaired === 1 ? 'piece' : 'pieces'}
				</text>
			{/if}
		{:else}
			<text x={PHX + 44} y={VY + VF + 70} font-size="20" font-weight="700" fill="var(--qr-bad-ink)"
				>✗ Can’t read it</text
			>
			<text x={PHX + 44} y={VY + VF + 98} font-size="15" fill="var(--stage-ink-muted)">
				{#each problemLines as line, i (i)}<tspan x={PHX + 44} dy={i === 0 ? 0 : 21}>{line}</tspan
					>{/each}
			</text>
		{/if}
	</Readout>
</g>

<style>
	.qr-canvas {
		cursor: crosshair;
		outline: none;
		touch-action: none;
	}
	.qr-canvas:focus-visible {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
