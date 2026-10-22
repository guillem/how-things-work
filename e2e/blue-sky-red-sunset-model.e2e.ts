// Why the sky is blue and sunsets red: sunlight scattered once by air, colour by colour.
import { expect, test } from '@playwright/test';
import {
	NM,
	airMass,
	balancedRGB,
	cmf,
	dominantWavelength,
	eyeSensitivity,
	glareColour,
	luminance,
	rayleighDepth,
	screenColour,
	skySpectrum,
	sunAt,
	sunSpectrum,
	sunlight,
	transmitted,
	zenithSpectrum
} from '../src/routes/blue-sky-red-sunset/model';

const rgb = (css: string) => css.match(/\d+/g)!.map(Number);

test('the colour-matching fit: the eye is most sensitive near 555 nm, and the fit is close to the CIE table', () => {
	let best = 0;
	for (let nm = 400; nm <= 700; nm++)
		if (eyeSensitivity(nm) > eyeSensitivity(best || 400)) best = nm;
	expect(best).toBeGreaterThanOrEqual(550);
	expect(best).toBeLessThanOrEqual(560);
	// CIE 1931 table values: ȳ(555) = 1.000, x̄(600) = 1.062, z̄(450) = 1.772.
	expect(cmf(555)[1]).toBeCloseTo(1, 1);
	expect(cmf(600)[0]).toBeCloseTo(1.062, 1);
	expect(cmf(450)[2]).toBeCloseTo(1.772, 1);
});

test('sunlight above the air peaks near 500 nm, has a little less violet than blue, and shows as white', () => {
	const sun = NM.map(sunlight);
	expect(NM[sun.indexOf(Math.max(...sun))]).toBeGreaterThanOrEqual(495);
	expect(NM[sun.indexOf(Math.max(...sun))]).toBeLessThanOrEqual(505);
	expect(sunlight(400)).toBeLessThan(sunlight(450));
	expect(glareColour(sun)).toBe('rgb(255, 255, 255)');
});

test('air scatters blue about six times as much as red: Rayleigh optical depth 0.097 at 550 nm', () => {
	expect(rayleighDepth(550)).toBeCloseTo(0.0973, 3);
	const ratio = rayleighDepth(450) / rayleighDepth(700);
	expect(ratio).toBeGreaterThan(5.5);
	expect(ratio).toBeLessThan(6.5);
	// Straight down through the whole air, about 1 in 5 bits of blue light bounces off, 1 in 25 of red.
	expect(1 - transmitted(450, 90)).toBeCloseTo(0.2, 1);
	expect(1 - transmitted(700, 90)).toBeCloseTo(0.036, 2);
});

test('air mass: 1 straight up, 2 at 30°, about 38 at the horizon', () => {
	expect(airMass(90)).toBeCloseTo(1, 3);
	expect(airMass(30)).toBeCloseTo(2, 1);
	expect(airMass(0)).toBeGreaterThan(37);
	expect(airMass(0)).toBeLessThan(39);
});

test('the Sun at 40° north on an equinox: rises due east at 6, 50° up in the south at noon, sets due west at 18', () => {
	expect(sunAt(6).elevation).toBeCloseTo(0, 6);
	expect(sunAt(6).azimuth).toBeCloseTo(90, 6);
	expect(sunAt(12).elevation).toBeCloseTo(50, 6);
	expect(sunAt(12).azimuth).toBeCloseTo(180, 6);
	expect(sunAt(18).azimuth).toBeCloseTo(270, 6);
});

test('the sky overhead is blue: its hue is that of light near 475 nm, not violet', () => {
	const sky = zenithSpectrum(sunAt(12));
	const hue = dominantWavelength(sky);
	expect(hue).toBeGreaterThan(465);
	expect(hue).toBeLessThan(490);
	const [r, g, b] = balancedRGB(sky);
	expect(b).toBeGreaterThan(g);
	expect(g).toBeGreaterThan(r);
	// The scattered light carries more violet (400 nm) than blue (470 nm) …
	expect(sky[NM.indexOf(400)]).toBeGreaterThan(sky[NM.indexOf(470)]);
	// … but the eye barely notices violet: weighed by its sensitivity, blue wins.
	const seen = (nm: number) => sky[NM.indexOf(nm)] * eyeSensitivity(nm);
	expect(seen(470)).toBeGreaterThan(5 * seen(400));
});

test('the Sun goes from white at noon to orange-red on the horizon', () => {
	const noon = sunSpectrum(sunAt(12).elevation);
	const [r0, g0, b0] = rgb(glareColour(noon));
	expect(r0).toBe(255);
	expect(g0).toBeGreaterThan(240);
	expect(b0).toBeGreaterThan(220);
	const horizon = sunSpectrum(0);
	// Only about 1 in 4 bits of red light gets through ~38 times the air, and almost no blue.
	expect(transmitted(700, 0)).toBeCloseTo(0.25, 1);
	expect(transmitted(450, 0)).toBeLessThan(0.001);
	const [r, g, b] = rgb(glareColour(horizon));
	expect(r).toBe(255);
	expect(g).toBeLessThan(140);
	expect(b).toBe(0);
});

test('the sky overhead dims as the Sun goes down', () => {
	const noon = luminance(zenithSpectrum(sunAt(12)));
	const dusk = luminance(zenithSpectrum(sunAt(6.1)));
	expect(dusk).toBeLessThan(noon / 3);
});

test('more air: a deeper sunset and a paler daytime sky; no air: a black sky and a white Sun', () => {
	const low = sunAt(6.25);
	const sunRG = (air: number) => {
		const [r, g] = balancedRGB(sunSpectrum(low.elevation, { air }));
		return g / r;
	};
	expect(sunRG(2)).toBeLessThan(sunRG(1));
	const saturation = (air: number) => {
		const c = rgb(screenColour(zenithSpectrum(sunAt(12), { air }), 1));
		return (Math.max(...c) - Math.min(...c)) / Math.max(...c);
	};
	expect(saturation(2)).toBeLessThan(saturation(1));
	expect(
		skySpectrum({ elevation: 30, azimuth: 0 }, sunAt(12), { air: 0 }).every((v) => v === 0)
	).toBe(true);
	expect(glareColour(sunSpectrum(5, { air: 0 }))).toBe('rgb(255, 255, 255)');
});

test('smoke: a redder low Sun and a whiter daytime sky', () => {
	const low = sunAt(6.25);
	// Redder: less green left beside the full red.
	const [, gSmoke] = rgb(glareColour(sunSpectrum(low.elevation, { smoke: 1 })));
	const [, gClear] = rgb(glareColour(sunSpectrum(low.elevation)));
	expect(gSmoke).toBeLessThan(gClear);
	const [r0, , b0] = balancedRGB(zenithSpectrum(sunAt(12)));
	const [r1, , b1] = balancedRGB(zenithSpectrum(sunAt(12), { smoke: 0.3 }));
	expect(r1 / b1).toBeGreaterThan(r0 / b0);
});
