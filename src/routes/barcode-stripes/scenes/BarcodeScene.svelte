<script lang="ts">
	/**
	 * A UPC-A barcode (0 36000 29145 2) with the scanner's red line, and below it what the scanner
	 * records: dark and light against time. Depending on the step: one digit group highlighted, a
	 * digit's four widths enlarged, the recording stretched by speed, the barcode upside down, a
	 * misprinted bar, or the till's price list. The scanner's verdict comes from the model's reader.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { encode, L_CODES, misprint, R_CODES, read, runs, sweep } from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'scan'));
	const CODE = [0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];
	const good = encode(CODE);
	const bad = misprint(good, 3);
	const modules = $derived(
		phase === 'check' && params.misprint === true && bad ? bad.modules : good
	);
	const flipped = $derived(phase === 'upside' && params.flip === true);
	const stretch = $derived(phase === 'speed' ? 1 / Number(params.speed ?? 1) : 1);
	const recording = $derived(sweep(modules, { stretch, reversed: flipped }));
	const reading = $derived(read(recording));
	const scanTo = $derived(phase === 'scan' ? Number(params.scan ?? 1) : 1);

	// ---- the barcode: 95 columns, 7 px each ------------------------------------------------------
	const MW = 7;
	const BX = 147;
	const BY = 40;
	const BH = 150;
	const isGuard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
	const bars = $derived(
		[...modules].flatMap((m, i) =>
			m === '1' ? [{ i, x: flipped ? BX + (94 - i) * MW : BX + i * MW }] : []
		)
	);
	const groupAt = (g: number) => (g < 6 ? 3 + 7 * g : 50 + 7 * (g - 6));
	const groupX = (g: number) => (flipped ? BX + (95 - groupAt(g) - 7) * MW : BX + groupAt(g) * MW);

	// ---- the recording: dark low, light high, against time ---------------------------------------
	const TY = 300;
	const TH = 50;
	const TX = BX;
	const tracePath = $derived.by(() => {
		let x = TX;
		const total = recording.reduce((a, [, w]) => a + w, 0);
		const limit = total * scanTo;
		let used = 0;
		let d = '';
		for (const [dark, w] of recording) {
			if (used >= limit) break;
			const part = Math.min(w, limit - used);
			const y = dark ? TY + TH : TY;
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y}L${(x + part * MW).toFixed(1)} ${y}`;
			x += part * MW;
			used += part;
		}
		return d;
	});
	const traceLen = $derived(recording.reduce((a, [, w]) => a + w, 0) * MW);
	const laserX = $derived(BX + scanTo * 95 * MW);

	// ---- the chosen digit's four widths ------------------------------------------------------------
	const g = $derived(Number(params.group ?? 2) - 1);
	const dg = $derived(Number(params.digit ?? 0));
	const widthsOf = (code: string) => runs(code).map(([, w]) => w);
	const fmt = (d: readonly number[]) =>
		`${d[0]} ${d.slice(1, 6).join('')} ${d.slice(6, 11).join('')} ${d[11]}`;
	const verdict = $derived(
		reading.valid
			? `reads ${fmt(reading.digits!)}`
			: reading.digits && !reading.digits.includes(-1)
				? `reads ${fmt(reading.digits)}: the check digit doesn’t match`
				: `can’t read it: ${reading.problem}`
	);
	const price = $derived(params.sale === true ? '$1.99' : '$2.49');
</script>

<g class="bc">
	<!-- the label and the bars -->
	<rect
		x={BX - 40}
		y={BY - 14}
		width={95 * MW + 80}
		height={BH + 60}
		rx="6"
		fill="var(--bc-paper)"
		stroke="var(--border-strong)"
	/>
	{#each bars as b (b.i)}
		<rect x={b.x} y={BY} width={MW} height={isGuard(b.i) ? BH + 12 : BH} fill="var(--bc-bar)" />
	{/each}
	<!-- the digits printed under the bars -->
	{#if !flipped}
		<text
			x={BX - 22}
			y={BY + BH + 24}
			font-size="18"
			fill="#1c1b19"
			font-family="ui-monospace, monospace">{CODE[0]}</text
		>
		{#each CODE.slice(1, 11) as d, k (k)}
			<text
				x={groupX(k + 1) + 16}
				y={BY + BH + 24}
				font-size="18"
				fill="#1c1b19"
				font-family="ui-monospace, monospace">{d}</text
			>
		{/each}
		<text
			x={BX + 95 * MW + 8}
			y={BY + BH + 24}
			font-size="18"
			fill="#1c1b19"
			font-family="ui-monospace, monospace">{CODE[11]}</text
		>
	{/if}

	<!-- highlights -->
	{#if phase === 'marks'}
		{#each [[0, 3], [45, 5], [92, 3]] as [i0, n] (i0)}
			<rect
				x={BX + i0 * MW - 1}
				y={BY - 8}
				width={n * MW + 2}
				height={BH + 24}
				fill="none"
				stroke="var(--bc-mark)"
				stroke-width="2"
				stroke-dasharray="4 3"
			/>
		{/each}
		<rect
			x={groupX(g) - 1}
			y={BY - 10}
			width={7 * MW + 2}
			height={BH + 20}
			fill="var(--bc-mark)"
			opacity="0.25"
		/>
		<rect
			x={groupX(g) - 1}
			y={BY - 10}
			width={7 * MW + 2}
			height={BH + 20}
			fill="none"
			stroke="var(--bc-mark)"
			stroke-width="3"
		/>
		<Readout
			id="bc-group"
			order={2}
			label="Group {g + 1}"
			value="digit {CODE[g]}, widths {widthsOf(modules.slice(groupAt(g), groupAt(g) + 7)).join(
				', '
			)}"
		>
			<Label
				x={480}
				y={262}
				text="group {g + 1} is the digit {CODE[g]}: widths {widthsOf(
					modules.slice(groupAt(g), groupAt(g) + 7)
				).join(' · ')}"
				anchor="middle"
				size={16}
				weight={700}
			/>
		</Readout>
	{/if}

	<!-- the scanner's red line -->
	{#if phase === 'scan'}
		<line
			x1={laserX}
			y1={BY - 20}
			x2={laserX}
			y2={BY + BH + 20}
			stroke="var(--bc-laser)"
			stroke-width="3"
		/>
	{:else}
		<line
			x1={BX - 30}
			y1={BY + BH / 2}
			x2={BX + 95 * MW + 30}
			y2={BY + BH / 2}
			stroke="var(--bc-laser)"
			stroke-width="2"
			opacity="0.8"
		/>
	{/if}

	<!-- the digit's widths, enlarged -->
	{#if phase === 'widths'}
		{#each [{ code: L_CODES[dg], y: 254, side: 'left half' }, { code: R_CODES[dg], y: 330, side: 'right half' }] as row (row.side)}
			{#each [...row.code] as m, k (k)}
				<rect
					x={330 + k * 30}
					y={row.y}
					width="30"
					height="46"
					fill={m === '1' ? 'var(--bc-bar)' : 'var(--bc-paper)'}
					stroke="var(--border-strong)"
				/>
			{/each}
			<Label x={316} y={row.y + 29} text={row.side} anchor="end" size={13} muted />
			<Readout
				id="bc-w-{row.side}"
				order={3}
				label="{dg} on the {row.side}"
				value="widths {widthsOf(row.code).join(', ')}"
			>
				<Label
					x={556}
					y={row.y + 29}
					text="{dg}: widths {widthsOf(row.code).join(' · ')}"
					anchor="start"
					size={16}
					weight={700}
				/>
			</Readout>
		{/each}
	{:else if phase === 'price'}
		<!-- the till -->
		<rect
			x={250}
			y={250}
			width={460}
			height={150}
			rx="10"
			fill="var(--surface-2)"
			stroke="var(--border-strong)"
		/>
		<Label x={270} y={282} text="the shop’s list (made up)" anchor="start" size={12} muted />
		<Label x={270} y={318} text="036000291452" anchor="start" size={16} mono />
		<Label x={270} y={348} text="Oat biscuits, 250 g" anchor="start" size={16} />
		<Readout
			id="bc-price"
			order={2}
			label="Price"
			value="{price}{params.sale === true ? ' (sale)' : ''}"
		>
			<Label
				x={690}
				y={348}
				text={price}
				anchor="end"
				size={22}
				weight={700}
				color={params.sale === true ? 'var(--bc-ok)' : undefined}
			/>
		</Readout>
		<Label
			x={270}
			y={382}
			text="the barcode only carries the number"
			anchor="start"
			size={12}
			muted
		/>
	{:else}
		<!-- the recording -->
		<Label
			x={TX}
			y={TY - 14}
			text="what the scanner records: light ↑, dark ↓, time →"
			anchor="start"
			size={12}
			muted
		/>
		<path d={tracePath} fill="none" stroke="var(--bc-laser)" stroke-width="2" />
		{#if phase === 'speed'}
			<Readout
				id="bc-len"
				order={3}
				label="Recording"
				value="{Math.round((traceLen / (95 * MW)) * 100)}% as long as at normal speed"
			>
				<Label
					x={TX + traceLen + 8}
					y={TY + TH / 2 + 4}
					text="{Math.round((traceLen / (95 * MW)) * 100)}% as long"
					anchor="start"
					size={12}
					tabular
				/>
			</Readout>
		{/if}
	{/if}

	<!-- the verdict -->
	{#if phase !== 'widths' && phase !== 'marks' && (phase !== 'scan' || scanTo >= 1)}
		<Readout id="bc-verdict" order={1} label="Scanner" value={verdict}>
			<circle cx={TX + 6} cy={430} r="10" fill={reading.valid ? 'var(--bc-ok)' : 'var(--bc-bad)'} />
			<Label x={TX + 26} y={436} text={verdict} anchor="start" size={16} weight={700} tabular />
			{#if reading.reversed && reading.valid}
				<Label
					x={TX + 26}
					y={460}
					text="read backwards (the right-hand patterns came first), so flipped round"
					anchor="start"
					size={13}
					muted
				/>
			{/if}
		</Readout>
	{/if}
</g>
