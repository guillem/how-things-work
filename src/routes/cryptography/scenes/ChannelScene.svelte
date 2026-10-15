<script lang="ts">
	/**
	 * Alice and Bob on an open line through three routers, with Eve tapping the middle one.
	 *
	 * Phases (`step.hints.phase`):
	 * - `open`: three plain messages travel back and forth; as each passes the tapped router a
	 *   copy drops to Eve and lands in her notebook. Loops.
	 * - `key`: the one-time pad. The bits of "HI" are XORed with a shared key; only the
	 *   scrambled bits travel, Eve copies them, and Bob XORs the same key to read "HI".
	 *   Loops. Asks how the key got there.
	 *
	 * Bits and XOR come from the model (`crypto.ts`). Reduced motion shows the complete
	 * frame: every row shown, every message logged, nothing in flight.
	 */
	import { clamp, cycle, Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bits8, padBytes, utf8, xorBytes } from '../crypto';
	import Person from './Person.svelte';

	let { step, t, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'open'));

	// ---- layout -------------------------------------------------------------------------
	const LINE_Y = 104;
	const X0 = 140;
	const X1 = 820;
	const ROUTERS = [300, 480, 660];
	const EVE = { x: 480, y: 262 };
	const NOTE = { x: 572, y: 196, w: 360 };

	// ---- open: three messages -------------------------------------------------------------
	const MSGS = [
		{ text: 'Hi Bob!', from: 'alice' },
		{ text: 'Hi Alice, what’s up?', from: 'bob' },
		{ text: 'Meet me at noon', from: 'alice' }
	] as const;
	const GAP = 3.2;
	const TRAVEL = 2.4;
	const OPEN_PERIOD = 0.6 + MSGS.length * GAP + 3;

	// ---- key: the one-time pad ------------------------------------------------------------
	const MSG = utf8('HI');
	const KEY = padBytes(2, 2024);
	const CIPHER = xorBytes(MSG, KEY);
	const ROW_BITS = [MSG, KEY, CIPHER, KEY, MSG].map((bytes) =>
		Array.from(bytes, bits8).join('').split('').map(Number)
	);
	const KEY_BITS = ROW_BITS[1];
	const ROWS = [
		{ label: 'Alice’s message', side: 'H I', at: 0.4 },
		{ label: '⊕ shared key', side: 'key', at: 1.1 },
		{ label: '= what is sent', side: '', at: 1.8 },
		{ label: '⊕ shared key', side: 'key', at: 5.2 },
		{ label: '= what Bob reads', side: 'H I', at: 5.9 }
	];
	const KEY_PERIOD = 11;
	const SEND_AT = 2.4;
	const RY = (i: number) => 402 + i * 36;
	const CX = (i: number) => 268 + i * 28 + (i >= 8 ? 14 : 0);

	const tv = $derived(
		reduced
			? 1e6
			: phase === 'open'
				? cycle(t, OPEN_PERIOD) * OPEN_PERIOD
				: cycle(t, KEY_PERIOD) * KEY_PERIOD
	);

	/** Position of message i in flight (u 0 → 1 from sender to receiver), or null. */
	const inFlight = (start: number) => {
		const u = (tv - start) / TRAVEL;
		return u >= 0 && u <= 1 ? u : null;
	};
	/** How far a copy has dropped from the tapped router to Eve (0 → 1), from the moment the
	 *  message passes the middle router. */
	const dropped = (start: number) => clamp((tv - start - TRAVEL / 2) / 0.6, 0, 1);

	const openMsgs = $derived(
		MSGS.map((m, i) => {
			const start = 0.6 + i * GAP;
			const u = inFlight(start);
			const ltr = m.from === 'alice';
			return {
				...m,
				i,
				u,
				x: u === null ? 0 : ltr ? X0 + (X1 - X0) * u : X1 - (X1 - X0) * u,
				drop: dropped(start),
				logged: tv >= start + TRAVEL / 2 + 0.6
			};
		})
	);

	const cipherU = $derived(inFlight(SEND_AT));
	const cipherDrop = $derived(dropped(SEND_AT));
	const cipherLogged = $derived(tv >= SEND_AT + TRAVEL / 2 + 0.6);
	const cipherArrived = $derived(tv >= SEND_AT + TRAVEL);
	const rowOn = (i: number) => smoothstep(ROWS[i].at, ROWS[i].at + 0.5, tv);
	const pillW = (text: string) => text.length * 7.4 + 22;
	const noteH = $derived(phase === 'open' ? 150 : 128);
	const colorOf = (from: string) => (from === 'alice' ? 'var(--cr-alice)' : 'var(--cr-bob)');
</script>

{#snippet keyIcon(x: number, y: number, s = 1)}
	<g transform="translate({x} {y}) scale({s})" fill="none" stroke="var(--cr-key)" stroke-width="3">
		<circle cx="0" cy="0" r="7" />
		<path d="M7 0 H26 M20 0 V7 M25 0 V6" stroke-linecap="round" />
	</g>
{/snippet}

{#snippet pill(x: number, y: number, text: string, color: string, mono = false)}
	{@const w = mono ? text.length * 8.2 + 22 : pillW(text)}
	<rect x={x - w / 2} y={y - 14} width={w} height="26" rx="13" fill={color} />
	<Label
		{x}
		y={y + 4}
		{text}
		size={13}
		weight={600}
		anchor="middle"
		color="#fff"
		halo={false}
		{mono}
	/>
{/snippet}

<g>
	<!-- the line and its routers -->
	<line x1={X0} x2={X1} y1={LINE_Y} y2={LINE_Y} stroke="var(--stage-line)" stroke-width="2" />
	{#each ROUTERS as rx (rx)}
		<rect
			x={rx - 26}
			y={LINE_Y - 15}
			width="52"
			height="30"
			rx="7"
			fill="var(--surface)"
			stroke="var(--border)"
			stroke-width="1.5"
		/>
		<Readout id="router-{rx}">
			<Label x={rx} y={LINE_Y + 34} text="router" size={11} anchor="middle" muted />
		</Readout>
	{/each}
	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="channel-title">
		<Label
			x={480}
			y={42}
			text="The public channel: anyone along the way can copy"
			size={13}
			anchor="middle"
			muted
		/>
	</Readout>

	<!-- Eve's tap -->
	<line
		x1={EVE.x}
		x2={EVE.x}
		y1={LINE_Y + 40}
		y2={EVE.y - 40}
		stroke="var(--cr-eve)"
		stroke-width="2"
		stroke-dasharray="5 4"
	/>

	<Person x={80} y={LINE_Y} name="Alice" color="var(--cr-alice)" />
	<Person x={880} y={LINE_Y} name="Bob" color="var(--cr-bob)" />
	<Person x={EVE.x} y={EVE.y} name="Eve" color="var(--cr-eve)" role="eavesdropper" />

	<!-- Eve's notebook -->
	<Readout id="eve-note">
		<rect
			x={NOTE.x}
			y={NOTE.y}
			width={NOTE.w}
			height={noteH}
			rx="10"
			fill="var(--surface)"
			stroke="var(--cr-eve)"
			stroke-opacity="0.6"
		/>
		<Label
			anchor="start"
			x={NOTE.x + 16}
			y={NOTE.y + 26}
			text="Eve’s copy of the traffic"
			size={13}
			weight={700}
			color="var(--cr-eve)"
		/>
	</Readout>

	{#if phase === 'open'}
		<Readout
			id="eve-log"
			order={2}
			label="Eve’s copy of the traffic"
			value="every message"
			note={MSGS.map((m) => `“${m.text}”`).join(' · ')}
			color="var(--cr-eve)"
		>
			{#each openMsgs as m (m.i)}
				{#if m.logged}
					<Label
						anchor="start"
						tabular
						x={NOTE.x + 16}
						y={NOTE.y + 58 + m.i * 28}
						text="{m.from === 'alice' ? 'Alice → Bob' : 'Bob → Alice'}:  “{m.text}”"
						size={13}
						halo={false}
					/>
				{/if}
			{/each}
		</Readout>
		<!-- copies dropping to Eve -->
		{#each openMsgs as m (m.i)}
			{#if m.drop > 0 && m.drop < 1}
				<circle
					cx={EVE.x}
					cy={LINE_Y + 20 + m.drop * (EVE.y - 60 - LINE_Y - 20)}
					r="6"
					fill={colorOf(m.from)}
				/>
			{/if}
		{/each}
		<!-- messages in flight -->
		{#each openMsgs as m (m.i)}
			{#if m.u !== null}
				{@render pill(m.x, LINE_Y, m.text, colorOf(m.from))}
			{/if}
		{/each}

		<Readout
			id="open-question"
			order={1}
			label="The public channel"
			value="strangers carry every message"
			note="Can Alice and Bob keep anything secret when every word is overheard?"
		>
			<rect
				x="40"
				y="452"
				width="880"
				height="104"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={480}
				y={492}
				text="Every message crosses machines run by strangers, and Eve reads them all."
				size={15}
				weight={600}
				anchor="middle"
				halo={false}
			/>
			<Label
				x={480}
				y={524}
				text="Can Alice and Bob keep anything secret when every word is overheard?"
				size={14}
				anchor="middle"
				muted
				halo={false}
			/>
		</Readout>
	{:else}
		<!-- what Eve copied -->
		<Readout
			id="eve-cipher"
			order={2}
			label="Eve’s copy"
			value={ROW_BITS[2].join('').replace(/(.{8})/, '$1 ')}
			note="without the key: random-looking bits, any two letters"
			color="var(--cr-eve)"
		>
			{#if cipherLogged}
				<Label
					anchor="start"
					x={NOTE.x + 16}
					y={NOTE.y + 60}
					text="Alice → Bob:"
					size={13}
					halo={false}
				/>
				<Label
					anchor="start"
					tabular
					x={NOTE.x + 108}
					y={NOTE.y + 60}
					text={ROW_BITS[2].join('').replace(/(.{8})/, '$1 ')}
					size={13}
					mono
					halo={false}
				/>
				<Label
					anchor="start"
					x={NOTE.x + 16}
					y={NOTE.y + 90}
					text="Without the key: random-looking bits."
					size={12}
					muted
					halo={false}
				/>
				<Label
					anchor="start"
					x={NOTE.x + 16}
					y={NOTE.y + 110}
					text="They could stand for any two letters."
					size={12}
					muted
					halo={false}
				/>
			{/if}
		</Readout>
		{#if cipherDrop > 0 && cipherDrop < 1}
			<circle
				cx={EVE.x}
				cy={LINE_Y + 20 + cipherDrop * (EVE.y - 60 - LINE_Y - 20)}
				r="6"
				fill="var(--cr-alice)"
			/>
		{/if}
		{#if cipherU !== null}
			{@render pill(
				X0 + (X1 - X0) * cipherU,
				LINE_Y,
				ROW_BITS[2].join('').replace(/(.{8})/, '$1 '),
				'var(--cr-alice)',
				true
			)}
		{/if}

		<!-- both already hold the key -->
		{@render keyIcon(22, 176, 0.9)}
		<Readout id="key-a">
			<Label
				anchor="start"
				x={58}
				y={182}
				text="key"
				size={12}
				color="var(--cr-key)"
				weight={700}
			/>
		</Readout>
		{@render keyIcon(838, 176, 0.9)}
		<Readout id="key-b">
			<Label
				anchor="start"
				x={874}
				y={182}
				text="key"
				size={12}
				color="var(--cr-key)"
				weight={700}
			/>
		</Readout>

		<!-- the XOR table -->
		<Readout
			id="key-question"
			order={1}
			label="But first"
			value="both need the same key"
			note="How, if Eve hears everything?"
			color="var(--cr-key)"
		>
			<Label
				x={480}
				y={364}
				text="But first both need the same key. How, if Eve hears everything?"
				size={14}
				weight={700}
				anchor="middle"
				color="var(--cr-key)"
			/>
		</Readout>
		{#each ROWS as row, r (r)}
			{@const on = rowOn(r)}
			{@const bitsRow = ROW_BITS[r]}
			<g opacity={on}>
				<Readout id="row-label-{r}">
					<Label
						tabular
						x={250}
						y={RY(r) + 5}
						text={row.label}
						size={13}
						anchor="end"
						weight={600}
						halo={false}
					/>
					{#snippet narrow()}
						<Label
							tabular
							x={250}
							y={RY(r) + 9}
							text={['msg', '⊕ key', '= sent', '⊕ key', '= Bob'][r]}
							size={26}
							anchor="end"
							weight={700}
							halo={false}
						/>
					{/snippet}
				</Readout>
				{#each bitsRow as b, i (i)}
					{@const isKey = r === 1 || r === 3}
					{@const flipped = r === 2 && KEY_BITS[i] === 1}
					<rect
						x={CX(i)}
						y={RY(r) - 14}
						width="24"
						height="26"
						rx="4"
						fill={isKey && b ? 'var(--cr-key)' : flipped ? 'var(--cr-key)' : 'var(--cr-cell)'}
						fill-opacity={isKey && b ? 0.85 : flipped ? 0.25 : 1}
						stroke={r === 2 ? 'var(--cr-eve)' : 'none'}
						stroke-opacity="0.5"
					/>
					<Readout id="bit-{r}-{i}">
						<Label
							tabular
							x={CX(i) + 12}
							y={RY(r) + 4}
							text={String(b)}
							size={14}
							weight={700}
							anchor="middle"
							halo={false}
							mono
							color={isKey && b ? '#fff' : undefined}
						/>
						{#snippet narrow()}
							<Label
								tabular
								x={CX(i) + 12}
								y={RY(r) + 8}
								text={String(b)}
								size={22}
								weight={700}
								anchor="middle"
								halo={false}
								mono
								color={isKey && b ? '#fff' : undefined}
							/>
						{/snippet}
					</Readout>
				{/each}
				{#if row.side === 'H I'}
					<Readout id="side-{r}">
						<Label
							anchor="start"
							x={CX(15) + 44}
							y={RY(r) + 5}
							text="“HI”"
							size={15}
							weight={700}
							halo={false}
							color="var(--cr-alice)"
						/>
						{#snippet narrow()}
							<Label
								anchor="start"
								x={CX(15) + 40}
								y={RY(r) + 10}
								text="HI"
								size={28}
								weight={700}
								halo={false}
								color="var(--cr-alice)"
							/>
						{/snippet}
					</Readout>
				{:else if r === 2}
					<Readout id="side-sent">
						<Label
							anchor="start"
							x={CX(15) + 44}
							y={RY(r) + 5}
							text="sent: Eve sees it"
							size={12}
							halo={false}
							color="var(--cr-eve)"
							weight={600}
						/>
					</Readout>
				{/if}
			</g>
		{/each}
		{#if cipherArrived}
			<Readout id="flip-back">
				<Label
					anchor="start"
					x={CX(15) + 44}
					y={RY(3) + 5}
					text="Bob flips them back"
					size={12}
					muted
					halo={false}
					opacity={rowOn(3)}
				/>
			</Readout>
		{/if}
	{/if}
</g>
