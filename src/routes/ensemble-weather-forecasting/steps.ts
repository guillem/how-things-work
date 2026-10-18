import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const obsErr: Control = {
	type: 'select',
	id: 'obsErr',
	label: 'Measurement error',
	default: '0.3',
	options: [
		{ value: '1', label: '1' },
		{ value: '0.3', label: '0.3' },
		{ value: '0.03', label: '0.03' },
		{ value: '0.003', label: '0.003' }
	],
	help: 'Typical error of each measured value; the weather itself varies by about 3.6.'
};

const day: Control = { type: 'action', id: 'day', label: 'Another day', action: 'Another day' };

const model: Control = {
	type: 'select',
	id: 'model',
	label: 'Forecast model',
	default: 'perfect',
	options: [
		{ value: 'perfect', label: 'Perfect' },
		{ value: 'weak10', label: 'Heating 10 % weak' },
		{ value: 'weak20', label: 'Heating 20 % weak' }
	],
	help: 'The truth always runs with F = 8; a wrong model forecasts with F = 7.2 or 6.4.'
};

const lead: Control = {
	type: 'range',
	id: 'lead',
	label: 'Lead time',
	min: 1,
	max: 30,
	step: 1,
	default: 3,
	format: (v) => `day ${v}`
};

/**
 * Scenes: `ring` (Hovmöller strips of the truth, the forecast and their difference, with the
 * error against time beside them), `fan` (one cell's 51 members against the truth, and spread
 * against error), `regimes` (Lorenz 63: three clouds of starts on the attractor) and `odds`
 * (the chance of rain in each cell, and the reliability diagram).
 * Ring hints: `focus` 'truth' | 'single' | 'tenfold' | 'cycle'. Fan hints: `focus` 'fan' |
 * 'stats'. Odds hints: `focus` 'odds' | 'reliability'. `seed`: the first day's weather.
 * A scene reads a control only on the steps that offer it, and the defaults elsewhere.
 */
export const spec: ExplainerSpec = {
	slug: 'ensemble-weather-forecasting',
	title: 'Weather forecasts: why they come as odds',
	summary:
		'Forecast a ring of forty chaotic weather cells (Lorenz 96) from a slightly wrong measurement and watch the error double every two days; launch fifty-one forecasts and read the odds off the fan, check them against what happened, see a wrong model go confident and wrong, and keep the forecast on track by observing and correcting.',
	chapters: [
		{ id: 'one', title: 'One forecast' },
		{ id: 'many', title: 'Many forecasts' },
		{ id: 'odds', title: 'From a fan to odds' },
		{ id: 'correct', title: 'Keeping on track' }
	],
	steps: [
		// ------------------------------------------------------------------ one
		{
			id: 'ring',
			chapter: 'one',
			title: 'Forty cells round a latitude circle',
			scene: 'ring',
			hints: { focus: 'truth', seed: 5 },
			duration: 26,
			body: `
<p>Real weather models solve the equations of the <a href="../atmosphere-weather/">atmosphere</a> on millions of grid points. To see what happens to a forecast, a much smaller model will do, as long as it is chaotic in the same way. The one forecasters use to test their methods is Edward Lorenz's model of 1996: forty numbers x<sub>1</sub> … x<sub>40</sub> spaced round a circle of latitude, each standing for the weather at one longitude, changing as</p>
<p class="formula">dx<sub>k</sub>/dt = (x<sub>k+1</sub> − x<sub>k−2</sub>) x<sub>k−1</sub> − x<sub>k</sub> + F</p>
<p>The product term moves values round the circle, as winds carry weather, without creating or destroying energy; −x<sub>k</sub> is friction, and <strong>F = 8</strong> is a steady heating that keeps it all going. The ring's last cell is next to its first.</p>
<p>The strip is a <dfn data-def="A chart with position round the circle across and time down, used by meteorologists to follow waves as they travel.">Hovmöller diagram</dfn>: each row is the whole circle at one moment, warm colours for high values and cold for low, with time running down, 6 hours per row. The weather never settles: crests rise, drift round the circle and fade, and the pattern never repeats.</p>`,
			notes: `<p>Lorenz presented the model at an ECMWF seminar in 1995 ("Predictability: a problem partly solved", published 1996). Its values are dimensionless; over a long run each cell averages 2.3 with a standard deviation of 3.6. He scaled one model time unit to 5 days, which makes its damping time realistic and, as the next step shows, makes small errors double in about the time they did in the weather models of the 1990s. The page uses that scale (a 6-hour step is 0.05 units) and integrates the equations with fourth-order Runge–Kutta.</p>`
		},
		{
			id: 'single',
			chapter: 'one',
			title: 'One forecast, from a measurement',
			scene: 'ring',
			hints: { focus: 'single', seed: 5 },
			duration: 30,
			controls: [obsErr, day],
			body: `
<p>Now forecast. Measure today's forty values, each with a small random error (0.3, about a twelfth of how much the weather varies), and run the same equations from the measurement. The middle strip is your forecast; the right-hand strip is how far it is from the truth.</p>
<p>For days the forecast looks just like the truth. Meanwhile the error, invisible at first, grows. The chart on the right shows its size, the root-mean-square over the circle, on a logarithmic scale, where steady doubling is a straight line: in this model errors double about every <strong>2.1 days</strong>, as in <a href="../chaos-fractals/#twins">the twin pendulums</a>.</p>
<p>The forecast is useful until its error reaches <strong>3.6</strong>, the spread of the climate: from then on it is no better than forecasting the average weather. With this measurement that takes about 9 days on average, close to the range of today's best global forecasts. Try <em>another day</em>: on some days the forecast lasts two weeks, on others five days.</p>`,
			notes: `<p>The errors of real forecast models double faster: about a day and a half for the largest weather systems in ECMWF's model around 2000 (Simmons and Hollingsworth, 2002), and only hours for thunderstorm-sized features. Operational centres measure the useful range differently, usually as the lead time at which the anomaly correlation of the 500 hPa height falls to 60 %; the threshold here, error equal to the climate's spread, is a simple stand-in. The error is measured against the truth the page knows; real forecasters only ever have observations and analyses to compare with.</p>`
		},
		{
			id: 'tenfold',
			chapter: 'one',
			title: 'Ten times better measurements buy a week',
			scene: 'ring',
			hints: { focus: 'tenfold', seed: 5 },
			duration: 30,
			controls: [obsErr],
			body: `
<p>Surely better measurements help? The chart now shows the error averaged over thirty days' forecasts, for four measurement errors from 1 down to 0.003. The tenfold reductions, from 0.3 to 0.03 and from 0.03 to 0.003, each shift the curve later by roughly the same amount: a ten times smaller error has to double log<sub>2</sub> 10 ≈ 3.3 more times before it gets as large, which takes about <strong>a week</strong> here. Ten times better buys a week; a hundred times better, two. The range grows with the <em>logarithm</em> of the precision.</p>
<p>In the real atmosphere it is worse. Small features, such as thunderstorms, have errors that double in hours and pass on to larger scales, so beyond a point better measurements of the large-scale weather buy almost nothing: Lorenz argued in 1969 that weather has a limit of about two weeks however well it is observed.</p>`,
			notes: `<p>Forecasts have still improved steadily, by about one day of useful range per decade: today's six-day forecast is as good as a five-day forecast was ten years earlier (Bauer, Thorpe and Brunet, 2015). That gain came from better models, more and better-used observations and more computing power together. A 2019 study with modern models put the intrinsic limit of mid-latitude weather at about two weeks (Zhang and others, 2019).</p>`
		},
		// ------------------------------------------------------------------ many
		{
			id: 'fan',
			chapter: 'many',
			title: 'Fifty-one forecasts',
			scene: 'fan',
			hints: { focus: 'fan', seed: 3 },
			duration: 30,
			controls: [day, obsErr],
			body: `
<p>Since the measurement is uncertain, forecasters don't run one forecast; they run an <dfn data-def="A set of forecasts from slightly different starting states (and often slightly different model versions), run to estimate how uncertain a forecast is.">ensemble</dfn>. Keep the forecast from the measurement, the <em>control</em>, and add fifty more, each started from the measurement plus a fresh random error of the same size: fifty perturbed starts that sample the uncertainty of the measurement, plus the control. The European Centre for Medium-Range Weather Forecasts (ECMWF) runs fifty-one members too.</p>
<p>The graph follows one cell, "your town", for twenty days: the truth in black, the members in thin lines and their average dashed. For a few days they agree; then the fan opens. Underneath, the <strong>spread</strong> of the members (their typical distance from their average) grows along with the actual error of that average.</p>
<p>Press <em>another day</em> several times. Some fans stay narrow for a week; others burst open within three days. Chaos does not make forecasts useless; it makes their range vary from day to day, and the ensemble shows which days are which.</p>`,
			notes: `<p>ECMWF's ensemble has one control and fifty perturbed members and runs to 15 days ahead. Its starting perturbations are not plain random noise: they come from an ensemble of data assimilations and from the directions in which errors grow fastest (singular vectors), and random perturbations to the model's physics stand in for model error. Here each member's start is the measurement plus Gaussian noise of the measurement's own size. That approximates the uncertainty of the starting state; it does not by itself guarantee that the ensemble's probabilities are calibrated.</p>`
		},
		{
			id: 'regimes',
			chapter: 'many',
			title: 'Some weather is more predictable',
			scene: 'regimes',
			duration: 26,
			body: `
<p>Why do fans differ? Because how fast errors grow depends on the state of the weather. Lorenz's earlier model (1963), three variables with σ = 10, ρ = 28 and β = 8/3, makes it visible: its states trace the butterfly-shaped <dfn data-def="The set of states a chaotic system settles onto and wanders over for ever, never repeating.">attractor</dfn>, drawn here from the side.</p>
<p>Three tight clouds of forty starts each are run forward for the same time. Cloud A crosses from one wing to the other and arrives still tight: its spread barely grows. Cloud B stretches into a thread. Cloud C passes close to where the wings meet and is torn apart: some members go round one wing, some the other. A forecaster with that third ensemble knows, before the weather happens, that the forecast is uncertain, and roughly how: it is a choice of two.</p>
<p>Real weather has such forks too: whether a blocking high sets in, which way a storm turns. Tim Palmer used this picture to explain why forecast uncertainty is <dfn data-def="Depending on the current state of the weather, not just on how far ahead the forecast is.">flow-dependent</dfn>.</p>`,
			notes: `<p>The three starts were chosen by running clouds from 400 points along the attractor and picking a slow, a middling and a fast grower. In this model an error doubles in about 0.76 time units on average (its largest Lyapunov exponent is 0.906), but at some points nearby states converge for a while and at others they separate many times faster than average.</p>`
		},
		{
			id: 'spread',
			chapter: 'many',
			title: 'Is the fan honest?',
			scene: 'fan',
			hints: { focus: 'stats', seed: 3 },
			duration: 30,
			controls: [model, day],
			body: `
<p>A fan is only useful if its width tells you how wrong the forecast will be. The chart below now averages forty days' forecasts. In a perfect model the spread and the error of the members' average stay close at every lead time, averaged over many forecasts: the fan is honest.</p>
<p>The average also beats the control. It averages away what can't be predicted, so at long range its error stops at 3.6, the climate's spread: it has become the climate average. A single forecast's error goes on to 5.1, √2 times more, because by then it is as far from the truth as any two random days are from each other.</p>
<p>Now make the model wrong: weaken its heating F by a tenth, or a fifth. The members still agree with each other, and the fan is as narrow as before or narrower, but they drift away from the truth together: the spread falls well below the error. A wrong model gives a <strong>confident fan that misses</strong>. That is why forecasters check spread against error over many past forecasts, and add random perturbations to the model itself to stand for its own errors.</p>`,
			notes: `<p>Spread and error are compared as root-mean-squares over the forty cells and the forty start days. The spread uses the 51 members around their mean (dividing by 50); the error is that of the mean. Ensembles of real forecast models were, for years, underdispersive in just this way: too narrow for their errors, especially in the first few days.</p>`
		},
		// ------------------------------------------------------------------ odds
		{
			id: 'odds',
			chapter: 'odds',
			title: "What '70 % chance of rain' means",
			scene: 'odds',
			hints: { focus: 'odds', seed: 36 },
			duration: 30,
			controls: [lead, day],
			body: `
<p>Say it rains in a cell when its value is above 6; in this model's climate that happens on 17 % of days. The chance of rain the ensemble gives a cell is simply the share of the 51 members in which it rains there. The bars show it for every cell round the circle on the chosen day; the drops underneath show where it actually rained.</p>
<p>A '70 % chance of rain' is a statement about one place: of all the times a forecast says 70 % for a spot, it should rain there about 7 times in 10. It does <em>not</em> mean rain over 70 % of the area, nor for 70 % of the day: neighbouring cells get quite different chances, and each applies to its own cell.</p>
<p>Slide the lead time out. As predictability is lost, the chances cluster around the climate's frequency of rain, about 17 %. Individual bars can still rise or fall, and fifty-one members leave some scatter even at long range. Chaos has wiped out the forecast of the weather, but not of the climate: the model still knows how often it rains.</p>`,
			notes: `<p>"Rain" here is a stand-in: a value above 6 in Lorenz's model is not a physical rainfall. Real precipitation forecasts give the chance of at least a set amount (often 0.1 or 0.2 mm) at a point during a set period, which is why a forecast for a whole day can show a higher chance than for any single hour of it.</p>`
		},
		{
			id: 'reliability',
			chapter: 'odds',
			title: 'Do the odds come true?',
			scene: 'odds',
			hints: { focus: 'reliability', seed: 36 },
			duration: 30,
			controls: [model, lead],
			body: `
<p>To check the odds, collect many forecasts: here a hundred start days × forty cells, four thousand forecasts for each lead time. Group them by the chance they gave and count how often it rained. Odds that come true lie on the diagonal of this <dfn data-def="A plot of how often an event happened against the probability that was forecast for it; reliable forecasts lie on the diagonal.">reliability diagram</dfn>. The dots are estimates from a finite sample of neighbouring, related cells, so expect some scatter about the diagonal.</p>
<p>For the first week or two the perfect-model ensemble is close to reliable: when it says 30 %, it rains about 30 % of the time. At long range even it becomes a little overconfident, because fifty-one members sample the chances only roughly. Now pick the model with its heating 20 % weak, on day 5. It is <strong>overconfident</strong>: when it gives under 5 %, it still rains about 6 % of the time, and when it gives 90 % or more, it rains only about four times in five. And its climate is wrong: on average it forecasts rain 11 % of the time where it really rains 17 %.</p>
<p>Even with perfect equations, a finite ensemble from approximate starts can give overconfident raw probabilities, and a wrong model makes it much worse: a raw count of members is not automatically a trustworthy probability. Forecasters <em>calibrate</em> it: from years of past forecasts and outcomes they learn how often it really rained when the ensemble said p, as in <a href="../bayes-theorem/#formula">Bayes' theorem</a>, and correct the odds they publish.</p>`,
			notes: `<p>The forecasts are grouped in eleven bins of width 10 % around 0 %, 10 %, … 100 %, and dots with fewer than ten forecasts are left out. Neighbouring cells of one day are not independent forecasts, so the dots scatter more than a count of 4,000 independent cases would suggest. Calibration methods used in practice include ensemble model output statistics (EMOS) and Bayesian model averaging, fitted to a few weeks to years of past forecasts; forecasters also verify with the Brier score, which combines reliability with sharpness.</p>`
		},
		// ------------------------------------------------------------------ correct
		{
			id: 'cycle',
			chapter: 'correct',
			title: 'Forecast, observe, correct',
			scene: 'ring',
			hints: { focus: 'cycle', seed: 5 },
			duration: 30,
			controls: [day],
			body: `
<p>A forecast centre never lets a forecast run on its own for long. Twice a day here, new observations arrive, of every other cell only and each with an error of 1, three times worse than before. Each time, the ensemble is run forward to that moment and then corrected: every member is pulled towards the observations by a weight that balances the ensemble's own spread against the observation error. This is an <dfn data-def="A filter that combines forecast and observation uncertainty. The ordinary Kalman filter gives exact Bayesian inference for linear systems with Gaussian errors; ensemble versions approximate it for nonlinear models.">ensemble Kalman filter</dfn>: an approximation to <a href="../bayes-theorem/">Bayesian</a> updating that uses the ensemble's means and covariances. The members' correlations carry each correction to the unobserved cells nearby.</p>
<p>The middle strip is now the <dfn data-def="The best estimate of the current state of the atmosphere, combining the latest short forecast with new observations; the starting point of the next forecast.">analysis</dfn>, the average of the corrected ensemble. Its error stays about <strong>0.55</strong>, sawing up between observations and down at each one: smaller than the error of any single observation, even in the cells that are never observed. A forecast left alone from the same start drifts to the error of a random day.</p>
<p>That is the whole cycle: observe, correct, run many forecasts, and publish the fan as odds, because beyond a few days that is the honest form a forecast can take.</p>`,
			notes: `<p>The filter is a serial ensemble square-root filter (Whitaker and Hamill, 2002) with 51 members; each observation's correction is tapered with distance (Gaspari–Cohn localisation, half-width 4 cells) and the spread is inflated by 5 % before each correction, two standard fixes for a small ensemble. ECMWF itself uses four-dimensional variational assimilation (4D-Var) with an ensemble of data assimilations; Canada's centre runs an ensemble Kalman filter. Real assimilation uses millions of observations of many kinds a day, from satellites, aircraft, balloons and stations.</p>`
		}
	]
};
