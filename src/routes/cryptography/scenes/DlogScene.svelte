<script lang="ts">
	/**
	 * Eve's attack on the key exchange: the discrete logarithm by trial. A scatter of 2ˣ mod 101
	 * for x = 0 … 99 (the powers jump around with no pattern), a dashed line at Alice's public
	 * number A, and a scan that tries x = 0, 1, 2, … until 2ˣ lands on A. Loops. A side panel
	 * compares Eve's tries with Alice's multiplications and gives the real-world sizes.
	 *
	 * Numbers come from the model (`diffieHellman`, `eveSearch`, `REAL`); Alice's secret is the
	 * `a` slider. Reduced motion shows the finished search.
	 */
	import { clamp, cycle, Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fastPower, slowPower, sup } from '../../primes-modular-arithmetic/modular';
	import { DH, REAL, diffieHellman, eveSearch } from '../crypto';

	let { t, params, reduced }: StageProps = $props();
	const a = $derived(clamp(Math.round(Number(params.a ?? 29)), 2, 99));
	const b = $derived(clamp(Math.round(Number(params.b ?? 64)), 2, 99));
	const A = $derived(diffieHellman(a, b).A);
	const found = $derived(eveSearch(A));
	const cost = $derived(fastPower(DH.g, a, DH.p).total);

	const pts = Array.from({ length: DH.p - 1 }, (_, i) => ({ i, v: slowPower(DH.g, i, DH.p) }));
	const AX = { x0: 70, x1: 486, y0: 520, y1: 80 };
	const sx = (v: number) => AX.x0 + (v / 100) * (AX.x1 - AX.x0);
	const sy = (v: number) => AX.y0 - (v / 100) * (AX.y0 - AX.y1);
	const TICKS = [0, 20, 40, 60, 80, 100];

	const RATE = 12;
	const searchEnd = $derived(0.6 + (found.tries - 1) / RATE);
	const period = $derived(searchEnd + 5);
	const su = $derived(reduced ? 1e6 : cycle(t, period) * period);
	const trying = $derived(Math.min(found.x ?? 99, Math.max(0, Math.floor((su - 0.6) * RATE))));
	const searching = $derived(su >= 0.6);
	const hit = $derived(su >= searchEnd);
	const nTries = $derived(hit ? found.tries : searching ? trying + 1 : 0);
	const PX = 572;
</script>

<g>
	<!-- axes -->
	{#each TICKS as v (v)}
		<line x1={AX.x0} x2={AX.x1} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
		<Readout id="tick-{v}">
			<Label tabular x={AX.x0 - 8} y={sy(v) + 4} text={String(v)} size={11} anchor="end" muted />
			<Label tabular x={sx(v)} y={AX.y0 + 20} text={String(v)} size={11} anchor="middle" muted />
		</Readout>
	{/each}
	<line x1={AX.x0} x2={AX.x0} y1={AX.y0} y2={AX.y1} stroke="var(--stage-line)" />
	<line x1={AX.x0} x2={AX.x1} y1={AX.y0} y2={AX.y0} stroke="var(--stage-line)" />
	<Readout id="x-title">
		<Label
			x={(AX.x0 + AX.x1) / 2}
			y={AX.y0 + 46}
			text="exponent Eve tries"
			size={13}
			weight={600}
			anchor="middle"
		/>
		{#snippet narrow()}
			<Label
				x={(AX.x0 + AX.x1) / 2}
				y={AX.y0 + 40}
				text="x"
				size={28}
				weight={600}
				anchor="middle"
			/>
		{/snippet}
	</Readout>
	<Readout id="y-title">
		<Label anchor="start" x={AX.x0 - 40} y={AX.y1 - 22} text="2ˣ mod 101" size={13} weight={600} />
		{#snippet narrow()}
			<Label
				anchor="start"
				x={AX.x0 - 40}
				y={AX.y1 - 22}
				text="2ˣ mod 101"
				size={26}
				weight={600}
			/>
		{/snippet}
	</Readout>

	<!-- target: Alice's public number -->
	<line
		x1={AX.x0}
		x2={AX.x1}
		y1={sy(A)}
		y2={sy(A)}
		stroke="var(--cr-alice)"
		stroke-width="1.5"
		stroke-dasharray="6 4"
	/>
	<Readout id="a-line">
		<Label
			anchor="start"
			tabular
			x={AX.x1 + 14}
			y={sy(A) + 4}
			text="A = {A}"
			size={13}
			weight={700}
			color="var(--cr-alice)"
		/>
		{#snippet narrow()}
			<Label
				anchor="start"
				tabular
				x={AX.x1 + 10}
				y={sy(A) + 9}
				text="A = {A}"
				size={26}
				weight={700}
				color="var(--cr-alice)"
			/>
		{/snippet}
	</Readout>

	{#if searching && !hit}
		<line
			x1={sx(trying)}
			x2={sx(trying)}
			y1={AX.y0}
			y2={AX.y1}
			stroke="var(--cr-eve)"
			stroke-width="1.5"
			opacity="0.5"
		/>
	{/if}

	{#each pts as p (p.i)}
		{@const tried = searching && p.i <= trying}
		<circle
			cx={sx(p.i)}
			cy={sy(p.v)}
			r={tried ? 4 : 3.2}
			fill={tried ? 'var(--cr-eve)' : 'var(--stage-ink-muted)'}
			opacity={tried ? 0.9 : 0.45}
		/>
	{/each}
	{#if hit && found.x !== null}
		<circle
			cx={sx(found.x)}
			cy={sy(A)}
			r="10"
			fill="none"
			stroke="var(--cr-alice)"
			stroke-width="3"
		/>
		<Readout id="found">
			<Label
				tabular
				x={sx(found.x)}
				y={sy(A) - 16}
				text="a = {found.x}"
				size={14}
				weight={700}
				anchor="middle"
				color="var(--cr-alice)"
			/>
			{#snippet narrow()}
				<Label
					tabular
					x={sx(found.x)}
					y={sy(A) - 18}
					text="a = {found.x}"
					size={26}
					weight={700}
					anchor="middle"
					color="var(--cr-alice)"
				/>
			{/snippet}
		</Readout>
	{:else if searching}
		<circle
			cx={sx(trying)}
			cy={sy(slowPower(DH.g, trying, DH.p))}
			r="7"
			fill="none"
			stroke="var(--cr-eve)"
			stroke-width="2"
		/>
	{/if}

	<!-- panel -->
	<Readout
		id="eve-wants"
		order={1}
		label="Eve wants a with"
		value="2ᵃ ≡ {A} (mod 101)"
		note="no pattern to follow: try a = 0, 1, 2, …"
	>
		<Label
			anchor="start"
			tabular
			x={PX}
			y={70}
			text="Eve wants a with 2ᵃ ≡ {A} (mod 101)"
			size={17}
			weight={700}
		/>
		<Label
			anchor="start"
			x={PX}
			y={94}
			text="No pattern to follow: try a = 0, 1, 2, …"
			size={13}
			muted
		/>
	</Readout>
	<Readout id="status">
		<Label
			anchor="start"
			tabular
			x={PX}
			y={134}
			text={hit
				? `Found: a = ${found.x ?? '?'}`
				: searching
					? `Trying ${trying}: 2${sup(trying)} ≡ ${slowPower(DH.g, trying, DH.p)}`
					: 'Trying a = 0, 1, 2, …'}
			size={16}
			weight={600}
			color={hit ? 'var(--cr-alice)' : undefined}
		/>
	</Readout>
	<Readout
		id="eve-tries"
		order={2}
		label="Eve, by trying"
		value="{nTries} {nTries === 1 ? 'try' : 'tries'}"
		color="var(--cr-bad)"
	>
		<Label anchor="start" x={PX} y={178} text="Eve, by trying" size={14} weight={700} />
		<Label
			anchor="start"
			tabular
			x={PX}
			y={204}
			text="{nTries} {nTries === 1 ? 'try' : 'tries'}"
			size={22}
			weight={700}
			color="var(--cr-bad)"
		/>
	</Readout>
	<Readout
		id="alice-mults"
		order={3}
		label="Alice, forwards"
		value="{cost} multiplication{cost === 1 ? '' : 's'}"
		color="var(--cr-ok)"
	>
		<Label anchor="start" x={PX + 190} y={178} text="Alice, forwards" size={14} weight={700} />
		<Label
			anchor="start"
			tabular
			x={PX + 190}
			y={204}
			text="{cost} multiplication{cost === 1 ? '' : 's'}"
			size={22}
			weight={700}
			color="var(--cr-ok)"
		/>
	</Readout>
	<Readout id="tiny">
		<Label
			anchor="start"
			x={PX}
			y={240}
			text="Easy for Eve here: the clock is tiny."
			size={13}
			muted
		/>
	</Readout>
	<Readout
		id="real"
		order={4}
		label="Real keys"
		value="a prime of {REAL.keyBits} bits"
		note="Alice: at most 4,094 multiplications · Eve by trying: up to about 10⁶¹⁶ tries"
	>
		<rect
			x={PX - 14}
			y={270}
			width={960 - PX - 2}
			height={250}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label
			anchor="start"
			tabular
			x={PX + 4}
			y={300}
			text="Real keys: a prime of {REAL.keyBits} bits"
			size={14}
			weight={700}
			halo={false}
		/>
		<Label
			anchor="start"
			tabular
			x={PX + 4}
			y={320}
			text="({REAL.keyDigits} digits) or more"
			size={14}
			weight={700}
			halo={false}
		/>
		<Label
			anchor="start"
			x={PX + 4}
			y={354}
			text="Alice: at most 4,094 multiplications"
			size={13}
			color="var(--cr-ok)"
			weight={600}
			halo={false}
		/>
		<Label
			anchor="start"
			x={PX + 4}
			y={380}
			text="Eve by trying: up to about 10⁶¹⁶ tries"
			size={13}
			color="var(--cr-bad)"
			weight={600}
			halo={false}
		/>
		<Label
			anchor="start"
			x={PX + 4}
			y={416}
			text="Cleverer attacks exist. Their record:"
			size={13}
			halo={false}
		/>
		<Label
			anchor="start"
			tabular
			x={PX + 4}
			y={438}
			text="a {REAL.dlogRecordBits}-bit ({REAL.dlogRecordDigits}-digit) prime, in 2019,"
			size={13}
			halo={false}
		/>
		<Label
			anchor="start"
			x={PX + 4}
			y={460}
			text="after thousands of years of computer time."
			size={13}
			halo={false}
		/>
		<Label
			anchor="start"
			x={PX + 4}
			y={494}
			text="The numbers here are for illustration."
			size={12}
			muted
			halo={false}
		/>
	</Readout>
</g>
