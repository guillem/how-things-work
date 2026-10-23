// The two-process model of sleep (Borbély; parameters of Skeldon, Dijk & Derks 2014): the
// pressure that builds while awake and drains in sleep, gated by a 24-hour clock, checked
// against what is known about real sleep and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	DEFAULT_PLAN,
	at,
	feeling,
	gap,
	nights,
	rounds,
	simulate,
	type Plan
} from '../src/routes/why-you-get-sleepy/model';

const run = (plan: Plan) => {
	const series = simulate(plan);
	return { series, nights: nights(series, plan) };
};
const FREE: Plan = { ...DEFAULT_PLAN, mode: 'free' };
/** Minutes between getting into bed and falling asleep, on the first night shown. */
const latency = (plan: Plan) => {
	const n = run(plan).nights[0];
	return (n.onset - n.bed) * 60;
};

test('left alone, an adult sleeps about 8½ hours from about 23:00, every 24 hours', () => {
	const { nights: ns } = run(FREE);
	expect(ns).toHaveLength(3);
	for (const n of ns) {
		expect(n.wake - n.onset).toBeGreaterThan(8);
		expect(n.wake - n.onset).toBeLessThan(9);
		expect(n.onset % 24).toBeGreaterThan(22.75);
		expect(n.onset % 24).toBeLessThan(23.25);
	}
	expect(ns[1].onset - ns[0].onset).toBeCloseTo(24, 1);
});

test('the tank fills all day and drains all night, and a night clears what a day built', () => {
	const { series, nights: ns } = run(DEFAULT_PLAN);
	const n = ns[0];
	const day = series.filter((x) => x.t > ns[0].wake && x.t < ns[1].onset);
	const night = series.filter((x) => x.t > n.onset && x.t < n.wake);
	for (let i = 1; i < day.length; i++) expect(day[i].s).toBeGreaterThan(day[i - 1].s);
	for (let i = 1; i < night.length; i++) expect(night[i].s).toBeLessThan(night[i - 1].s);
	// Over the day and the night the level changes about twice as fast asleep as awake, so one
	// night clears the day.
	expect(ns[1].sAtWake).toBeCloseTo(n.sAtWake, 2);
	expect(n.sAtOnset).toBeGreaterThan(0.6);
	expect(n.sAtWake).toBeLessThan(0.1);
});

test('in bed at 20:00 you lie awake almost three hours; at 22:30, about twenty minutes', () => {
	expect(latency({ ...DEFAULT_PLAN, bedtime: 20 })).toBeGreaterThan(150);
	expect(latency({ ...DEFAULT_PLAN, bedtime: 20 })).toBeLessThan(180);
	expect(latency({ ...DEFAULT_PLAN, bedtime: 22.5 })).toBeGreaterThan(10);
	expect(latency({ ...DEFAULT_PLAN, bedtime: 22.5 })).toBeLessThan(30);
	// Going to bed earlier still doesn't get you to sleep any earlier.
	const early = run({ ...DEFAULT_PLAN, bedtime: 19 }).nights[0];
	const late = run({ ...DEFAULT_PLAN, bedtime: 22 }).nights[0];
	expect(early.onset).toBeCloseTo(late.onset, 1);
});

test('the day feels best in the morning and sleepiness builds into the evening', () => {
	const { series } = run(DEFAULT_PLAN);
	expect(feeling(at(series, 24 + 9))).toBe('wide awake');
	expect(feeling(at(series, 24 + 20))).toBe('a bit tired');
	expect(feeling(at(series, 24 + 22))).toBe('sleepy');
	expect(feeling(at(series, 24 + 3))).toBe('asleep');
});

test('an earlier alarm leaves the tank fuller in the morning and you sleepier all day', () => {
	const normal = run(DEFAULT_PLAN);
	const early = run({ ...DEFAULT_PLAN, wake: 5 });
	expect(early.nights[0].sAtWake).toBeGreaterThan(normal.nights[0].sAtWake + 0.04);
	for (let h = 8; h <= 22; h++)
		expect(gap(at(early.series, 24 + h))).toBeGreaterThan(gap(at(normal.series, 24 + h)));
	// An alarm at 8:00 or later never rings: you wake by yourself at about 7:30.
	for (const wake of [8, 10]) {
		const n = run({ ...DEFAULT_PLAN, wake }).nights[0];
		expect(n.natural).toBe(true);
		expect(n.wake % 24).toBeGreaterThan(7.25);
		expect(n.wake % 24).toBeLessThan(7.75);
	}
	// A routine of short nights settles: the third morning is no worse than the first.
	expect(early.nights[2].sAtWake).toBeCloseTo(early.nights[0].sAtWake, 2);
});

test('a skipped night: the tank overflows, worst in the early morning, then a second wind', () => {
	const { series, nights: ns } = run({ ...DEFAULT_PLAN, skip: 2 });
	expect(ns).toHaveLength(2);
	const normal = run(DEFAULT_PLAN).series;
	const h = (x: number) => gap(at(series, 48 + x));
	expect(at(series, 48 + 22).s).toBeGreaterThan(0.85);
	for (let x = 8; x <= 22; x++) expect(h(x)).toBeGreaterThan(gap(at(normal, 48 + x)) + 0.1);
	expect(feeling(at(series, 48 + 8))).toBe('can hardly keep your eyes open');
	// The clock still lifts you in the afternoon, though the tank keeps filling.
	expect(h(16)).toBeLessThan(h(8) - 0.05);
	expect(at(series, 48 + 16).s).toBeGreaterThan(at(series, 48 + 8).s);
	// And the next night you fall asleep the moment you lie down.
	expect(ns[1].onset - ns[1].bed).toBe(0);
});

test('an afternoon nap puts tonight’s sleep later: 90 minutes by over two hours, 20 by less', () => {
	const night = (minutes: number) =>
		run({ ...DEFAULT_PLAN, napMinutes: minutes, napAt: 15 }).nights[1].onset;
	const none = night(0);
	expect(night(90) - none).toBeGreaterThan(2);
	expect(night(90) - none).toBeLessThan(2.75);
	expect(night(20) - none).toBeGreaterThan(0.5);
	expect(night(20) - none).toBeLessThan(1);
	// Left alone after a long nap you would also wake later the next morning.
	const free = (minutes: number) =>
		run({ ...FREE, napMinutes: minutes, napAt: 15 }).nights.find((n) => n.onset > 36)!;
	expect(free(90).wake).toBeGreaterThan(free(0).wake);
});

test('a night is five rounds of about ninety minutes, deep sleep early and dreams late', () => {
	const { series, nights: ns } = run(DEFAULT_PLAN);
	const r = rounds(series, ns[0]);
	expect(r).toHaveLength(5);
	for (const x of r) expect((x.to - x.from) * 60).toBeGreaterThan(80);
	const deep = r.map((x) => x.deep);
	const first = deep[0] + deep[1];
	expect(first).toBeGreaterThan(3 * (deep[3] + deep[4]));
	expect(r[4].dream).toBeGreaterThan(2 * r[0].dream);
});
