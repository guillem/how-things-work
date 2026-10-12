import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

/** Carbohydrate in the meal. */
const carbs: Control = {
	type: 'range',
	id: 'carbs',
	label: 'Carbohydrate in the meal',
	min: 0,
	max: 120,
	step: 5,
	default: 75,
	unit: ' g',
	help: '75 g of glucose is the sugary drink of a glucose tolerance test. 0 g: no meal.'
};

/** Exercise: none, easy or a moderate run. */
const exercise: Control = {
	type: 'select',
	id: 'exercise',
	label: 'Exercise (45 minutes)',
	default: 'run',
	options: [
		{ value: 'none', label: 'None' },
		{ value: 'easy', label: 'Easy: 40% of aerobic capacity' },
		{ value: 'run', label: 'Moderate run: 65%' }
	],
	help: 'Effort as a share of the most oxygen the body can use (VO₂max).'
};

/** When the run starts, relative to the meal. */
const runAt: Control = {
	type: 'range',
	id: 'runAt',
	label: 'Start of the exercise',
	min: 0,
	max: 180,
	step: 15,
	default: 30,
	format: (v) => (v === 0 ? 'with the meal' : `${v} min after the meal`)
};

/** The β-cells' insulin output, relative to normal. */
const production: Control = {
	type: 'range',
	id: 'production',
	label: 'Insulin production',
	min: 0,
	max: 200,
	step: 5,
	default: 100,
	unit: '%',
	help: 'How much insulin the pancreas can make, compared with a healthy adult.'
};

/**
 * The same slider on the type 2 step, under its own id so that turning
 * production off on the type 1 step does not carry over.
 */
const production2: Control = { ...production, id: 'production2' };

/** How strongly cells respond to insulin, relative to normal. */
const sensitivity: Control = {
	type: 'range',
	id: 'sensitivity',
	label: 'Insulin sensitivity',
	min: 10,
	max: 100,
	step: 5,
	default: 100,
	unit: '%',
	help: 'How much glucose each unit of insulin moves into cells. Below 100%: insulin resistance.'
};

/** A dose of rapid-acting insulin injected by hand. */
const dose: Control = {
	type: 'range',
	id: 'dose',
	label: 'Rapid-acting insulin',
	min: 0,
	max: 20,
	step: 0.5,
	default: 0,
	format: (v) => `${v} unit${v === 1 ? '' : 's'}`,
	help: 'Injected under the skin. It takes about an hour to act fully.'
};

/** The meal on the dosing step, under its own id (the run step suggests a 0 g meal). */
const dosingCarbs: Control = { ...carbs, id: 'dosingCarbs' };

/** A run during the dosing step (its own control, off by default). */
const dosingRun: Control = {
	type: 'toggle',
	id: 'dosingRun',
	label: 'Moderate run, 30 minutes after the meal',
	default: false
};

/** When the dose is injected, relative to the meal. */
const doseAt: Control = {
	type: 'range',
	id: 'doseAt',
	label: 'Injected',
	min: -30,
	max: 90,
	step: 5,
	default: -15,
	format: (v) =>
		v < 0 ? `${-v} min before the meal` : v === 0 ? 'with the meal' : `${v} min after the meal`
};

export const spec: ExplainerSpec = {
	slug: 'homeostasis',
	title: 'How the body keeps its blood sugar steady',
	summary:
		'Feed a virtual person or send them for a run and watch insulin and glucagon hold their blood glucose in a narrow range. Then break the loop the two ways diabetes does, and try dosing insulin by hand.',
	chapters: [
		{ id: 'steady', title: 'A number the body defends' },
		{ id: 'meals', title: 'Meals and runs' },
		{ id: 'broken', title: 'When the loop breaks' }
	],
	steps: [
		// ------------------------------------------------------------------ steady
		{
			id: 'fuel',
			chapter: 'steady',
			title: 'Sugar in the blood',
			scene: 'body',
			hints: { view: 'fuel' },
			duration: 18,
			body: `
<p>Every cell in your body burns <strong class="tag glucose">glucose</strong>, a simple sugar, for energy. Your blood carries it to them. The brain is the hungriest customer: it runs almost entirely on glucose and can store only a tiny amount, so it needs a steady supply, every minute of the day.</p>
<p>Too little glucose in the blood and the brain falters: shakiness, confusion, and in the end unconsciousness. Too much, for years, and it damages blood vessels, nerves, eyes and kidneys.</p>
<p>So the body holds its <dfn data-def="The concentration of glucose in the blood, measured in milligrams per decilitre (mg/dL) in the USA and millimoles per litre (mmol/L) in most other countries; 18 mg/dL = 1 mmol/L.">blood glucose</dfn> in a narrow range. After a night without food it sits between about <strong>70 and 100 mg/dL</strong> (3.9–5.6 mmol/L). That is remarkably little sugar: all the blood of an adult holds only about 4 grams of it, a teaspoonful.</p>
<p>Holding a quantity steady inside the body, whatever happens outside, is called <dfn data-def="From the Greek for “staying the same”: keeping the body's internal conditions (temperature, water, salt, sugar, acidity…) within narrow limits.">homeostasis</dfn>. Blood glucose is one of the best examples, and this page shows how it works.</p>`,
			notes: `<p>The 70–100 mg/dL range for fasting glucose and the thresholds used on this page come from the American Diabetes Association's <i>Standards of Care in Diabetes</i>. The 4 grams are worked out in D. H. Wasserman, “Four grams of glucose”, <i>American Journal of Physiology – Endocrinology and Metabolism</i> 296: E11 (2009). The brain alone uses about 120 g of glucose a day (Berg, Tymoczko &amp; Stryer, <i>Biochemistry</i>), so the blood's supply would last it only about 50 minutes if nothing topped it up.</p>`
		},
		{
			id: 'loop',
			chapter: 'steady',
			title: 'Two hormones, one loop',
			scene: 'body',
			hints: { view: 'loop' },
			duration: 24,
			body: `
<p>The control centre is the <dfn data-def="An organ behind the stomach. Most of it makes digestive juices; scattered through it are tiny clusters of hormone-producing cells, the islets of Langerhans.">pancreas</dfn>. Scattered through it are tiny clusters of cells, the islets, which measure the glucose in the blood flowing past and answer with two hormones that do opposite jobs:</p>
<ul>
<li>When glucose rises, <strong>β-cells</strong> release <strong class="tag insulin">insulin</strong>. Muscle and fat cells take glucose in, and the <dfn data-def="The body's chemical factory. Among many jobs it stores glucose as glycogen and makes new glucose when the blood needs it.">liver</dfn> stores it as <dfn data-def="A large branched molecule made of thousands of glucose units: the body's short-term store of sugar, kept in the liver and muscles.">glycogen</dfn> and stops releasing it. Glucose falls.</li>
<li>When glucose falls, <strong>α-cells</strong> release <strong class="tag glucagon">glucagon</strong>. The liver breaks down glycogen and makes new glucose, and releases it into the blood. Glucose rises.</li>
</ul>
<p>Each response pushes glucose back the way it came, and switches itself off as glucose gets back to normal. That is a <dfn data-def="A control loop in which a change triggers a response that opposes the change, so the controlled quantity returns towards its set point.">negative feedback loop</dfn>: the same idea as a thermostat that turns the heating on when the room gets cold and off when it is warm again.</p>`,
			notes: `<p>Every negative feedback loop has the same parts: a <em>sensor</em> that measures the quantity (here the islet cells), a <em>controller</em> that compares it with a target (the islets again), and <em>effectors</em> that push it back (the liver, muscle and fat). The islet cells also talk to each other: insulin released by β-cells next door is one of the signals that holds the α-cells' glucagon down after a meal.</p>`
		},
		// ------------------------------------------------------------------ meals
		{
			id: 'meal',
			chapter: 'meals',
			title: 'Give them a meal',
			scene: 'plot',
			hints: { case: 'meal', lines: 'ogtt' },
			duration: 24,
			controls: [carbs],
			body: `
<p>Here is a virtual adult who has not eaten for the night. At time 0 they drink a sugary drink with 75 g of glucose. The charts follow their <strong class="tag glucose">glucose</strong>, <strong class="tag insulin">insulin</strong> and <strong class="tag glucagon">glucagon</strong> over the next six hours; the tank on the left shows the glucose flowing into and out of the blood at the moment marked by the cursor.</p>
<p>Glucose from the gut floods in and blood glucose climbs. The β-cells respond within minutes: <dfn data-def="Insulin is measured in micro-units per millilitre of blood (µU/mL); about 10 is normal after a night's fast.">insulin</dfn> rises several-fold, glucagon drops, and the extra glucose is pushed into muscle, fat and liver. Within about two hours glucose is back under 140 mg/dL; by about four hours insulin and glucagon are back at their starting levels. The loop has done its job and switched itself off.</p>
<p>Change the size of the meal. A bigger meal brings a bigger insulin response, but glucose still comes back.</p>`,
			notes: `<p>This is a doctor's <dfn data-def="A test for diabetes: after a night's fast the patient drinks 75 g of glucose and their blood glucose is measured two hours later.">oral glucose tolerance test</dfn>. A healthy result is under 140 mg/dL (7.8 mmol/L) two hours after the drink; 200 mg/dL (11.1 mmol/L) or more means diabetes (American Diabetes Association).</p>
<p><strong>The model.</strong> Glucose and insulin follow the equations of Topp, Promislow, De Vries, Miura &amp; Finegood (<i>Journal of Theoretical Biology</i>, 2000), which balance the liver's output against uptake by the body's cells, with insulin acting after a delay as in Bergman's “minimal model” (Bergman, Phillips &amp; Cobelli, 1981). The meal is absorbed as in Hovorka et al. (<i>Physiological Measurement</i>, 2004). We made the β-cells respond more steeply to glucose than in Topp's model so that this healthy person passes the test; glucagon is a simplified term whose strength is illustrative. Insulin is cleared at the rate Hovorka et al. measured; adrenaline, cortisol and growth hormone, which also defend against low glucose and act during exercise, are left out. In this model a healthy adult's glucose peaks near 190 mg/dL; in real people it usually peaks lower and earlier. A real meal also contains fat and protein, which slow absorption down. It is a model of an average adult, not of you: use it to understand the loop, never to make medical decisions.</p>`
		},
		{
			id: 'run',
			chapter: 'meals',
			title: 'Send them for a run',
			scene: 'plot',
			hints: { case: 'run' },
			duration: 24,
			controls: [exercise, runAt, carbs],
			body: `
<p>Now the same person goes for a 45-minute run after the meal. Working muscles burn glucose fast, and during exercise they can take it in even without much insulin. The faint curves show the same day without the run.</p>
<p>A run soon after the meal lowers the glucose peak. The loop reacts to the extra demand: insulin falls, so that the cells take up less glucose and the liver releases more, and glucagon rises, which makes the liver release even more. Glucose dips, but stays in the normal range. When the run stops, the rest of the meal is still arriving and insulin has to climb again, so glucose bounces back up for a while before it settles.</p>
<p>Set the meal to 0 g to send them running on an empty stomach: glucose dips by only about 10–15 mg/dL, because the liver tops it up almost as fast as the muscles take it out. Holding glucose steady while the demand changes is what the loop is for.</p>`,
			notes: `<p>The exercise terms follow Roy &amp; Parker (ADCHEM 2006), who extended Bergman's minimal model with the measured fall of insulin during exercise. In healthy volunteers glucose stayed nearly level for the first 40 minutes of mild exercise, at about 30% of their aerobic capacity (Ahlborg et al., <i>Journal of Clinical Investigation</i>, 1974). The size of the muscles' extra glucose uptake in this model is illustrative. On runs of several hours the liver's glycogen runs out and glucose does fall; this model does not include that.</p>`
		},
		// ------------------------------------------------------------------ broken
		{
			id: 'type1',
			chapter: 'broken',
			title: 'No insulin: type 1 diabetes',
			scene: 'plot',
			hints: { case: 'type1', lines: 'diagnosis' },
			duration: 24,
			controls: [production],
			body: `
<p>In <dfn data-def="A disease in which the immune system destroys the insulin-making β-cells of the pancreas. It can start at any age, and about half of cases begin in adulthood. It accounts for about 5–10% of people with diabetes.">type 1 diabetes</dfn> the body's own immune system destroys the β-cells. The loop loses the hormone that brings glucose down.</p>
<p>Turn insulin production down. With less insulin the cells take in less glucose and nothing stops the liver releasing it, so glucose stays higher even before the meal. Below about a quarter of normal output, the fasting value passes 126 mg/dL: diabetes. At 0%, glucose after a meal climbs to about 600 mg/dL and is still above 400 six hours later. The sensor still works — the problem is that the controller has nothing to answer with.</p>
<p>Above about 180 mg/dL the kidneys cannot hold on to all the glucose and some spills into the urine: one of the first signs of untreated diabetes is passing a lot of sweet urine and being very thirsty.</p>`,
			notes: `<p>Diabetes is diagnosed with a fasting glucose of 126 mg/dL (7.0 mmol/L) or more, a 2-hour glucose tolerance test of 200 mg/dL (11.1 mmol/L) or more, or a long-term average (HbA1c) of 6.5% or more (American Diabetes Association). Type 1 accounts for about 5–10% of people with diabetes (US Centers for Disease Control and Prevention). In a UK Biobank study, 42% of type 1 cases diagnosed before age 60 began after age 30 (Thomas et al., <i>The Lancet Diabetes &amp; Endocrinology</i>, 2018).</p>
<p>The healthy adult of this model has the fasting glucose of Topp et al.'s normal state, 100 mg/dL: at the very edge of the normal range, which ends just under 100.</p>
<p>Without insulin the body also turns to burning fat, which produces acids called ketones. That dangerous state, diabetic ketoacidosis, is not part of this model, which only follows glucose. The kidney threshold in the model, 9 mmol/L (162 mg/dL), comes from Hovorka et al. (2004); in people it varies around 180 mg/dL.</p>`
		},
		{
			id: 'type2',
			chapter: 'broken',
			title: 'Deaf to insulin: type 2 diabetes',
			scene: 'plot',
			hints: { case: 'type2', lines: 'diagnosis' },
			duration: 24,
			controls: [sensitivity, production2],
			body: `
<p>In <dfn data-def="The most common form of diabetes (about 90–95% of cases), in which the body's cells respond weakly to insulin and the pancreas can no longer make enough extra insulin to compensate.">type 2 diabetes</dfn> the pancreas still makes insulin, but the body's cells respond to it less: they have become <dfn data-def="A state in which a given amount of insulin moves less glucose into cells than normal. It is linked to excess body fat, inactivity, genes and age.">insulin resistant</dfn>.</p>
<p>Turn insulin sensitivity down. The β-cells notice that glucose is staying high and make more insulin — look how high the insulin curve climbs — and glucose still comes down after the meal, only more slowly. The loop is straining, but it is still closed.</p>
<p>With sensitivity at 50%, turn production up to 200%. With twice the insulin, glucose looks almost normal again: many people stay like this for years, with high insulin and normal glucose. Type 2 diabetes begins when the β-cells can no longer keep up. Set sensitivity to 40% and production to 40%, and the fasting glucose passes 126 mg/dL.</p>`,
			notes: `<p>Between normal and diabetic there is a grey zone that doctors call prediabetes: a fasting glucose of 100–125 mg/dL, or a 2-hour test of 140–199 mg/dL (American Diabetes Association). In real life the β-cells adapt over months and years, and in Topp et al.'s full model their number grows and shrinks with the glucose they are exposed to. This page holds them fixed and lets you play their part with the production slider. Type 2 diabetes makes up about 90–95% of diabetes (US Centers for Disease Control and Prevention).</p>`
		},
		{
			id: 'dosing',
			chapter: 'broken',
			title: 'Closing the loop by hand',
			scene: 'plot',
			hints: { case: 'dosing', lines: 'hypo' },
			duration: 30,
			controls: [dose, doseAt, dosingCarbs, dosingRun],
			body: `
<p>A person with type 1 diabetes has to be the missing part of the loop: measure their glucose, and inject insulin to match what they eat and do. This person already has a long-acting background insulin that holds their fasting glucose near 100 mg/dL. Now they eat 75 g of carbohydrate. Try to keep their glucose as close as you can to the range 70–180 mg/dL.</p>
<p>Start with no injection and the glucose soars. Add rapid-acting insulin before the meal. Too little and it still soars. Too much, or a dose meant for a bigger meal, and a few hours later glucose falls below 70 mg/dL: <strong>hypoglycaemia</strong>, the red band. Below 54 mg/dL it is dangerous. Injected insulin cannot be switched off when glucose falls, and in type 1 diabetes glucagon does not rise to rescue it either: its line stays flat even when glucose drops below 70, where a working pancreas would raise it several-fold. A run makes the insulin already injected work harder, and glucose falls faster.</p>
<p>Injected insulin takes about an hour to act fully, while a meal is absorbed faster. Inject an hour after the meal and glucose first soars, then crashes. Timing matters as much as the dose, and every meal, run and illness changes the answer. That is why people with type 1 diabetes count carbohydrates, check their glucose many times a day, and increasingly wear sensors and pumps that do part of the job automatically.</p>
<p class="formula"><strong>This is a simplified model of an average adult, not medical advice.</strong> Never use it to choose a real dose.</p>`,
			notes: `<p>The American Diabetes Association calls glucose under 70 mg/dL (3.9 mmol/L) level 1 hypoglycaemia, and under 54 mg/dL (3.0 mmol/L) level 2, which needs immediate action: shaking, sweating, confusion and, if it goes on, seizures or loss of consciousness. Exercise raises the risk of hypoglycaemia during and for many hours after it (Riddell et al., <i>The Lancet Diabetes &amp; Endocrinology</i>, 2017); the delayed effect is not in this model.</p>
<p>The loss of the glucagon response is well documented: people with type 1 diabetes lose their glucagon response to falling glucose (Gerich et al., <i>Science</i>, 1973). The insulin is absorbed from under the skin as in Hovorka et al. (2004), so plasma insulin peaks about an hour after the injection, and its effect on glucose about half an hour later. The background insulin here delivers about 17 units a day, a flat stand-in for long-acting insulin.</p>`
		},
		{
			id: 'loops',
			chapter: 'broken',
			title: 'Many diseases are a broken loop',
			scene: 'loops',
			duration: 24,
			body: `
<p>Blood glucose is only one of the quantities your body holds steady. Body temperature, the amount of water and salt in your blood, its calcium, its acidity, your blood pressure: each has its own sensor, its own messenger and its own effectors, wired as a negative feedback loop.</p>
<p>And just as with glucose, many diseases are one link of a loop failing: an effector that stops working, a messenger that goes missing, or a signal the body no longer hears. Some are the loop's target moving: a fever is the thermostat set higher on purpose, not broken.</p>
<p>When you meet a new disease, a good first question is: which quantity does the body normally hold steady here, and which part of the loop has broken?</p>`,
			notes: `<p>Endocrinologists diagnose such diseases by reading both ends of a loop at once. In the thyroid loop, a low thyroid hormone with a <em>high</em> TSH points to a failing thyroid gland (the pituitary is shouting at a gland that cannot answer); a low thyroid hormone with a <em>low</em> TSH points to the pituitary instead. The same logic of insulin and glucose levels together tells type 1 from type 2 diabetes.</p>`
		}
	]
};
