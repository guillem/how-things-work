<script lang="ts">
	/**
	 * The two large bodies in a view, with the five Lagrange points if asked: the collinear points
	 * as open circles, L4 and L5 filled in the "stable" colour while μ is below Routh's limit.
	 * `rot` turns everything about the centre of mass (the view from the stars).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { POINT_IDS, ROUTH, lagrangePoints } from '../model';
	import { BODY, C, sx, sy, type View } from './shared';

	interface Props {
		v: View;
		mu: number;
		big: string;
		small: string;
		points?: boolean;
		/** Point names drawn next to the points. */
		pointLabels?: boolean;
		/** Body names drawn next to the bodies. */
		bodyLabels?: boolean;
		rot?: number;
		rBig?: number;
		rSmall?: number;
		pointOpacity?: number;
		/** Points to emphasise (others dimmed). */
		focus?: string[];
	}
	let {
		v,
		mu,
		big,
		small,
		points = true,
		pointLabels = true,
		bodyLabels = true,
		rot = 0,
		rBig = 15,
		rSmall = 8,
		pointOpacity = 1,
		focus = []
	}: Props = $props();

	const turn = (x: number, y: number) => ({
		x: x * Math.cos(rot) - y * Math.sin(rot),
		y: x * Math.sin(rot) + y * Math.cos(rot)
	});
	const inView = (X: number, Y: number) =>
		X >= v.x0 - 1 && X <= v.x1 + 1 && Y >= v.y0 - 1 && Y <= v.y1 + 1;

	const L = $derived(lagrangePoints(mu));
	const bigP = $derived(turn(-mu, 0));
	const smallP = $derived(turn(1 - mu, 0));
	const B = $derived({ X: sx(v, bigP.x), Y: sy(v, bigP.y) });
	const S = $derived({ X: sx(v, smallP.x), Y: sy(v, smallP.y) });
	const stable = $derived(mu < ROUTH);
	const pts = $derived(
		POINT_IDS.map((id) => {
			const p = turn(L[id].x, L[id].y);
			const X = sx(v, p.x);
			const Y = sy(v, p.y);
			// a point's label sits below it, or above for L4; dropped where it would crowd a body
			const nearSmall = Math.hypot(X - S.X, Y - S.Y) < rSmall + 10;
			const nearBig = Math.hypot(X - B.X, Y - B.Y) < rBig + 10;
			return {
				id,
				X,
				Y,
				shown: inView(X, Y) && !nearSmall && !nearBig,
				filled: (id === 'L4' || id === 'L5') && stable,
				dim: focus.length > 0 && !focus.includes(id),
				ly: id === 'L4' ? Y - 14 : Y + 24
			};
		})
	);
</script>

<g>
	{#if inView(B.X, B.Y)}
		<circle
			cx={B.X}
			cy={B.Y}
			r={rBig}
			fill={BODY[big] ?? BODY['large body']}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{#if bodyLabels}
			<Label x={B.X} y={B.Y + rBig + 18} text={big} size={12} weight={600} />
		{/if}
	{/if}
	{#if inView(S.X, S.Y)}
		<circle
			cx={S.X}
			cy={S.Y}
			r={rSmall}
			fill={BODY[small] ?? BODY['small body']}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{#if bodyLabels}
			<Label x={S.X} y={S.Y - rSmall - 9} text={small} size={12} weight={600} />
		{/if}
	{/if}
	{#if points}
		{#each pts as p (p.id)}
			{#if p.shown}
				<g opacity={pointOpacity * (p.dim ? 0.4 : 1)}>
					<circle
						cx={p.X}
						cy={p.Y}
						r="5.5"
						fill={p.filled ? C.stable : 'var(--stage-bg)'}
						stroke={p.filled ? C.stable : C.point}
						stroke-width="2"
					/>
					{#if pointLabels}
						<Label
							x={p.X}
							y={p.ly}
							text={p.id}
							size={13}
							weight={700}
							color={p.filled ? C.stableText : C.pointText}
						/>
					{/if}
				</g>
			{/if}
		{/each}
	{/if}
</g>
