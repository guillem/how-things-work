import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const priorSigma: Control = {
	type: 'range',
	id: 'priorSigma',
	label: 'Prediction’s uncertainty σ',
	min: 0.5,
	max: 8,
	step: 0.1,
	default: 3,
	unit: ' m'
};
const measSigma: Control = {
	type: 'range',
	id: 'measSigma',
	label: 'Measurement’s uncertainty σ',
	min: 0.5,
	max: 8,
	step: 0.1,
	default: 2,
	unit: ' m'
};
const walkQ: Control = {
	type: 'range',
	id: 'walkQ',
	label: 'Drift per second σ (process noise)',
	min: 0,
	max: 2,
	step: 0.05,
	default: 0.5,
	unit: ' m'
};
const walkR: Control = {
	type: 'range',
	id: 'walkR',
	label: 'Sensor noise σ',
	min: 0.25,
	max: 8,
	step: 0.25,
	default: 2,
	unit: ' m'
};
const gps: Control = {
	type: 'range',
	id: 'gps',
	label: 'GPS noise σ',
	min: 1,
	max: 40,
	step: 1,
	default: 8,
	unit: ' m'
};
const every: Control = {
	type: 'range',
	id: 'every',
	label: 'A GPS fix every',
	min: 1,
	max: 10,
	step: 1,
	default: 1,
	format: (v) => (v === 1 ? '1 second' : `${v} seconds`)
};
const Q_VALUES = [0.01, 0.03, 0.1, 0.3, 1, 3];
const allowance: Control = {
	type: 'range',
	id: 'allowance',
	label: 'Acceleration the filter allows for, σ',
	min: 0.01,
	max: 3,
	step: 0.01,
	default: 0.03,
	values: () => Q_VALUES,
	format: (v) => `${v} m/s²`
};
const RATIOS = [0.1, 0.3, 1, 3, 10];
const ratio: Control = {
	type: 'range',
	id: 'ratio',
	label: 'Filter’s process noise σ ÷ the true one',
	min: 0.1,
	max: 10,
	step: 0.1,
	default: 1,
	values: () => RATIOS,
	format: (v) => (v === 1 ? '× 1 (right)' : `× ${v}`)
};

/**
 * Scenes: `blend` (two Gaussian guesses of one number and their product), `series` (the scalar
 * random walk over time and its gain; hint `compare` adds the running and moving averages),
 * `track` (an object in a plane, with a close-up of the predict and update cycle; hint `focus`
 * 'predict' | 'update' | 'gain'), `fuse` (GPS only, accelerometer only and both), `swerve` (a
 * corner and the filter's allowance for acceleration) and `check` (the innovations' whiteness).
 */
export const spec: ExplainerSpec = {
	slug: 'kalman-filter',
	title: 'The Kalman filter',
	summary:
		'Blend a prediction with a noisy measurement in proportion to how much each can be trusted, and repeat: watch the uncertainty ellipse grow on every prediction and shrink on every fix, the filter become surer than its sensor, an accelerometer and a GPS beat either alone, and a filter with the wrong model lag round a corner, confidently.',
	chapters: [
		{ id: 'one', title: 'One number, two guesses' },
		{ id: 'plane', title: 'Tracking in a plane' },
		{ id: 'fuse', title: 'Two sensors' },
		{ id: 'wrong', title: 'When the model is wrong' }
	],
	steps: [
		// ------------------------------------------------------------------ one number
		{
			id: 'blend',
			chapter: 'one',
			title: 'A prediction and a measurement',
			scene: 'blend',
			duration: 26,
			controls: [priorSigma, measSigma],
			body: `
<p>A robot on a rail knows where it was a second ago and how fast it was going, so it predicts it is now at 10 m, give or take 3 m: the spread of what it doesn't know (wheel slip, a bump) is a Gaussian with standard deviation σ = 3 m. Then a range sensor reads 16 m, give or take 2 m. Where is it?</p>
<p>This is <a href="../bayes-theorem/#formula">Bayes' rule</a> with the prediction as the prior and the measurement as the evidence: the belief afterwards is the product of the two curves, renormalised. The product of two Gaussians is a Gaussian, and its peak sits between them, closer to the narrower one:</p>
<p><strong>estimate = prediction + K × (measurement − prediction)</strong>, with the <dfn data-def="The weight the Kalman filter gives a new measurement: the prediction's variance divided by the sum of the prediction's and the measurement's variances. 0 ignores the measurement, 1 takes it as it is.">gain</dfn> <strong>K = σ<sub>p</sub>² ÷ (σ<sub>p</sub>² + σ<sub>m</sub>²)</strong>. Here K = 9 ÷ 13 ≈ 0.69, so the estimate moves 69 % of the way to the reading, to 14.2 m.</p>
<p>And the result is narrower than <em>both</em> guesses: its variance is (1 − K) σ<sub>p</sub>² = 2.8 m², σ = 1.66 m, less than the sensor's 2 m. Two uncertain sources together are surer than either. Make one of them very uncertain and the estimate simply follows the other.</p>`,
			notes: `<p>Written with inverse variances it is easier to remember: 1/σ² = 1/σ<sub>p</sub>² + 1/σ<sub>m</sub>². Certainties add. The estimate is then the certainty-weighted mean of the two. Gauss and Legendre's least squares is the same calculation; Kalman's contribution (1960) was doing it recursively, for a system that moves between measurements.</p>`
		},
		{
			id: 'cycle',
			chapter: 'one',
			title: 'Predict, correct, repeat',
			scene: 'series',
			duration: 30,
			controls: [walkQ, walkR],
			body: `
<p>Now let the thing move. A buoy drifts along a line: each second it shifts by a random amount with σ = 0.5 m (a <dfn data-def="A quantity that changes each step by an independent random amount; its variance grows linearly with time.">random walk</dfn>), and a sensor reads its position with σ = 2 m (the dots). The filter runs one cycle a second:</p>
<p><strong>Predict:</strong> with no idea which way the buoy drifts, the best guess stays where it was, but its variance grows by the drift's: P⁻ = P + Q. <strong>Correct:</strong> blend in the reading with K = P⁻ ÷ (P⁻ + R), as before; P = (1 − K) P⁻.</p>
<p>The band is the filter's own 95 % range, ±2σ. At the start it knows nothing, so K = 1 and it takes the first reading as it is. Each reading shrinks its uncertainty, the gain falls (lower chart), and within a few seconds it settles where the growth on each prediction just balances the shrink on each correction: K = 0.22 here, with σ = 0.94 m, less than half the sensor's 2 m.</p>
<p>That settled gain is the fixed point of the <dfn data-def="The recursion that carries the filter's covariance from one step to the next, P⁻ → P → next P⁻; its fixed point is the steady-state covariance and gain.">Riccati equation</dfn> for P, and it depends only on the ratio of the two noises. Raise the drift and the filter trusts each reading more; raise the sensor noise and it trusts them less.</p>`,
			notes: `<p>The fixed point solves P⁻² − Q P⁻ − Q R = 0, so P⁻ = (Q + √(Q² + 4QR))/2 and K = P⁻/(P⁻ + R). With equal noises, Q = R, the gain settles at (√5 − 1)/2 ≈ 0.618, the inverse of the golden ratio; the model tests check that the filter reaches it from any starting uncertainty. Nothing about the gain depends on the readings themselves: a linear filter can compute its whole gain sequence before the first measurement arrives.</p>`
		},
		{
			id: 'forget',
			chapter: 'one',
			title: 'Not an average',
			scene: 'series',
			hints: { compare: true },
			duration: 30,
			controls: [walkQ, walkR],
			body: `
<p>Set the drift to 0. The buoy now stands still, and the filter becomes the plain running mean: K = 1/k at the k-th reading, the dashed average of every reading so far, exactly. With nothing moving, every reading is equally good, and the <a href="../central-limit-theorem/#clt">central limit theorem</a>'s σ/√k is what you get.</p>
<p>Put the drift back and the running mean is hopeless: it remembers where the buoy used to be. A moving average of the last 10 readings forgets, but by a rule picked by hand. The filter forgets at the rate the noise sets: at a steady gain K, a reading j seconds old weighs K(1 − K)ʲ, so with a lot of drift it looks back only a few seconds, with little drift a long way.</p>
<p>The error readouts compare them. The Kalman filter beats the raw readings and every fixed-window average, whatever the window, because it is the minimum-variance estimator for this model. It does not average the measurements; it weighs a prediction against each one.</p>`,
			notes: `<p>The running mean needs the prior to be diffuse (the filter starts knowing nothing). Started from a confident prior, it is a weighted mean in which the prior counts as a measurement of its own. The window of the moving average is fixed; a filter whose gain was chosen by hand and frozen is called an α filter (α–β for position and velocity), and it is what the Kalman filter's steady state becomes.</p>`
		},
		// ------------------------------------------------------------------ plane
		{
			id: 'predict',
			chapter: 'plane',
			title: 'Prediction stretches the ellipse',
			scene: 'track',
			hints: { focus: 'predict' },
			duration: 32,
			controls: [gps],
			body: `
<p>A car moves on a plain. The filter's state is now four numbers, position and velocity, x = (x, y, v<sub>x</sub>, v<sub>y</sub>), and its uncertainty a 4 × 4 covariance matrix P. The 95 % ellipse drawn is the position part of it: the region the filter is 95 % sure the car is in.</p>
<p>The prediction assumes the car keeps its velocity for the next second: x⁻ = F x, where F adds one second of velocity to the position. That is a <a href="../linear-transformations/#transform">linear transformation</a>, a shear, and a Gaussian pushed through a linear map stays Gaussian, with covariance <strong>P⁻ = F P Fᵀ + Q</strong>.</p>
<p>The right-hand panel shows what F P Fᵀ does: it plots the belief about position against velocity along x, and the prediction tilts that ellipse, because a car that was faster than estimated is now also further ahead. Whatever the filter doesn't know about the velocity becomes uncertainty in position. (The position ellipse stays a circle here only because both axes have the same noise.)</p>
<p>Q adds what the model leaves out. The car's driver changes speed and steers, an acceleration the filter can't see; it is treated as random, about 0.4 m/s² per axis, held over each second. So the ellipses grow every time the filter predicts (dashed: the ones before).</p>`,
			notes: `<p>This is the discrete white-noise acceleration model: Q = G Gᵀ σ<sub>a</sub>², with G = (½ dt², dt) for each axis carrying a held acceleration into position and velocity. The car here is simulated from exactly that model, so the filter's model is right; the last chapter breaks it. The GPS fixes are simulated too, with independent Gaussian errors; real GPS errors are correlated over seconds (the atmosphere and the satellites' geometry change slowly), see the <a href="../gps/#geometry">GPS page</a>.</p>`
		},
		{
			id: 'update',
			chapter: 'plane',
			title: 'A fix shrinks it',
			scene: 'track',
			hints: { focus: 'update' },
			duration: 32,
			controls: [gps],
			body: `
<p>Then a GPS fix arrives: the position, give or take σ = 8 m per axis (the circle). The correction is the same blend as on the line, with matrices: the <dfn data-def="The difference between a measurement and what the filter predicted it would be; the filter's surprise.">innovation</dfn> ν = z − H x⁻ (H picks the position out of the state), its expected spread S = H P⁻ Hᵀ + R, and</p>
<p><strong>K = P⁻ Hᵀ S⁻¹, &nbsp; x = x⁻ + K ν, &nbsp; P = (I − K H) P⁻</strong>.</p>
<p>The estimate moves part of the way along the innovation, and the ellipse shrinks. The velocity is corrected too, though GPS never measures it: the tilted ellipse on the right records that a car further ahead than predicted was probably faster, and K carries the correction to both.</p>
<p>After a few cycles it settles. The filter's ellipse is then smaller than the GPS's own circle: from a stream of 8 m fixes and a model of how cars move, it knows the position to about 4 m. It is more certain than any single measurement, and the readout shows it is right to be: the real error is the size it claims.</p>`,
			notes: `<p>The same equations hold for any number of state variables and sensors; only the matrices grow. The covariance update is computed here in Joseph's form, (I − KH) P⁻ (I − KH)ᵀ + K R Kᵀ, equal to the one above but immune to rounding errors that would make P lose its symmetry. In the model tests, across 200 simulated drives the truth lies inside the 95 % ellipse 95 % of the time.</p>`
		},
		{
			id: 'noise',
			chapter: 'plane',
			title: 'Noisy sensor: lean on the model',
			scene: 'track',
			hints: { focus: 'gain' },
			duration: 30,
			controls: [gps],
			body: `
<p>Turn the GPS noise up. The fixes scatter wider, the gain on each one falls, and the filter leans on its model: it lets the prediction carry it, takes a little from each fix, and its track stays smooth. At 40 m the filter keeps about an eighth of each innovation, and its error is well under half the GPS's.</p>
<p>Turn it down to 1 m and the gain rises to about 0.6: the fixes are now better than anything the model can predict, so the filter mostly follows them. Nobody set these gains. They come out of the two noise levels, Q and R, the only things the filter is told, and it recomputes them at every step.</p>
<p>This is what <a href="../feedback-control/#disturbances">feedback control</a> needs: a controller acting on raw, noisy readings amplifies their noise, and one acting on the filter's estimate doesn't. In a robot, a drone or an aircraft the two are paired: the filter estimates the state, the controller acts on it.</p>`,
			notes: `<p>The filter is the best linear estimator whatever the noise's distribution, given its means and covariances; it is the best of all estimators, linear or not, when the noise is Gaussian, because then the posterior is exactly the Gaussian it carries. Choosing Q and R is the filter's real design work. R can often be measured from the sensor at rest; Q, how much the world departs from the model, is usually tuned.</p>`
		},
		// ------------------------------------------------------------------ fuse
		{
			id: 'fuse',
			chapter: 'fuse',
			title: 'An accelerometer and a GPS',
			scene: 'fuse',
			duration: 34,
			controls: [every],
			body: `
<p>Add an accelerometer, a sensor that reads the car's acceleration, here to within 0.05 m/s². It goes into the prediction instead of the guess that the car keeps its velocity: x⁻ = F x + G a, integrating the measured acceleration once into velocity and twice into position. That is <dfn data-def="Working out where you are from where you started and how you have moved since, without any outside fix.">dead reckoning</dfn>.</p>
<p>Alone it drifts (orange): every small error in the acceleration is integrated twice, and the position error grows faster than time. GPS alone (blue) never drifts but is noisy. Fused (green), the accelerometer carries the prediction and GPS pins down the drift, and the result is better than either, with the smallest ellipse.</p>
<p>Make the fixes rare. Between fixes the GPS-only filter has only its guess that the velocity holds, and its ellipse balloons; the fused filter coasts on the accelerometer and hardly grows. This is how phones, cars and aircraft navigate: fast inertial sensors between slow, absolute fixes.</p>`,
			notes: `<p>The fusion here is idealised: the accelerometer reads the acceleration in the map's own axes, with independent noise and no bias. A real one is bolted to the vehicle, so a gyroscope must track its orientation to rotate its readings, and gravity must be subtracted; it also has a slowly wandering bias, which the filter estimates as extra state variables. Real navigation filters are error-state extended Kalman filters running at hundreds of hertz on the inertial data, corrected by GPS once a second or so.</p>`
		},
		// ------------------------------------------------------------------ wrong
		{
			id: 'swerve',
			chapter: 'wrong',
			title: 'Round a corner, confidently wrong',
			scene: 'swerve',
			duration: 34,
			controls: [allowance],
			body: `
<p>Everything so far has been the best case: the car moved exactly as the filter's model says. Now it drives straight for 20 seconds and turns a corner. This filter allows for very little acceleration, σ = 0.03 m/s²: it believes cars go in straight lines.</p>
<p>On the straight it is excellent, steadier than the GPS by far. It then misses the corner: it overshoots, carried on by its confidence in the old velocity, and takes many seconds to come round. Through all of it its ellipse stays small. The truth (the dot) is outside the ellipse the filter is 95 % sure of, by many times its size.</p>
<p>The filter has no way to know: its gain was computed from its model, not from how badly it is doing. Raise the allowance and it turns with the car, at the price of a wobblier track on the straight. A filter is only as right as its model, and when the model is wrong it fails <em>confidently</em>.</p>`,
			notes: `<p>Trackers of manoeuvring targets fight this with several models at once. An interacting multiple model (IMM) filter runs, say, a straight-line and a turning model side by side and weighs them by how well each predicts the measurements. Others watch the innovations and raise Q when they grow too large, which is the subject of the next step.</p>`
		},
		{
			id: 'check',
			chapter: 'wrong',
			title: 'Ask the innovations',
			scene: 'check',
			duration: 34,
			controls: [ratio],
			body: `
<p>The filter never sees the truth, but it does see its own surprises. If its model is right, each innovation ν is unpredictable from the ones before (white), with the spread S it predicted. Here are 200 seconds of the plane tracker, each innovation divided by its predicted σ: about 95 % should fall within ±2, and the bars on the right, the correlation of each innovation with the ones 1 to 10 seconds earlier, should stay inside the band.</p>
<p>Make the filter's process noise too small and it lags: the measurements keep landing on the same side, the innovations are correlated, and they are wider than it predicted. Make it too big and it chases the noise: each fix's error is undone at the next, and the correlation goes negative. Only the right model gives white innovations.</p>
<p>This is the main way to check a Kalman filter in use. Its guarantee is narrower than it looks: it is optimal only for a linear system with Gaussian noise. A sensor that now and then reads wildly wrong (a GPS fix bounced off a building) is not Gaussian, and the filter believes it as much as any other; nonlinear motion needs approximations of it (the extended and unscented Kalman filters, or particle filters).</p>`,
			notes: `<p>The checks are the normalised innovation squared (νᵀS⁻¹ν, which averages 2 for a two-axis fix when the filter is consistent) and the innovations' autocorrelation, whose 95 % band for white noise is ±2/√N. The Kalman filter's first great job was navigation for Apollo: Stanley Schmidt at NASA Ames extended it to the nonlinear orbits of the trip to the Moon in the early 1960s, the first extended Kalman filter, run on the spacecraft's guidance computer.</p>`
		}
	]
};
