/**
 * The GPS constellation: the current almanac of the U.S. Coast Guard Navigation Center
 * (https://www.navcen.uscg.gov/sites/default/files/gps/almanac/current_yuma.alm, YUMA format,
 * retrieved 2026-10-15), a work of the U.S. Government in the public domain. Kept: the
 * 32 satellites marked healthy (of 32 in the file), with their elements copied
 * unchanged (scripts/data/gps/almanac.mjs). Units as in the file: radians, radians per second,
 * √metres, seconds. The almanac week 392 is a 10-bit count; the full GPS week is 2440.
 */
export interface AlmanacEntry {
	/** Pseudo-random noise code number: the satellite's identity in the signal. */
	prn: number;
	/** Eccentricity. */
	e: number;
	/** Inclination of the orbit (rad). */
	i0: number;
	/** Rate of change of the right ascension of the ascending node (rad/s). */
	omegaDot: number;
	/** Square root of the semi-major axis (m^½). */
	sqrtA: number;
	/** Longitude of the ascending node at the start of the GPS week (rad). */
	omega0: number;
	/** Argument of perigee (rad). */
	w: number;
	/** Mean anomaly at the time of applicability (rad). */
	m0: number;
	/** Clock offset (s) and drift (s/s) broadcast for the satellite clock. */
	af0: number;
	af1: number;
}

/** Full GPS week of the almanac. */
export const ALMANAC_WEEK = 2440;
/** Time of applicability, seconds into the GPS week. */
export const ALMANAC_TOA = 503808;
/** Time of applicability as a calendar date (GPS time). */
export const ALMANAC_DATE = '2026-10-16T19:56:48Z';
/** Date the file was downloaded. */
export const ALMANAC_RETRIEVED = '2026-10-15';

export const ALMANAC: readonly AlmanacEntry[] = [
	{
		prn: 1,
		e: 0.002079963684,
		i0: 0.9560738992,
		omegaDot: -8.103194673e-9,
		sqrtA: 5153.689941,
		omega0: -0.8773108018,
		w: 0.155194589,
		m0: -2.179643638,
		af0: 0.000147819519,
		af1: -7.275957614e-12
	},
	{
		prn: 2,
		e: 0.01717758179,
		i0: 0.9606938179,
		omegaDot: -8.000333246e-9,
		sqrtA: 5153.646973,
		omega0: -1.038900098,
		w: -0.694787686,
		m0: -0.9035588759,
		af0: 0.0001955032349,
		af1: 7.275957614e-12
	},
	{
		prn: 3,
		e: 0.006865024567,
		i0: 0.9962030763,
		omegaDot: -7.623174679e-9,
		sqrtA: 5153.681152,
		omega0: 0.1178828283,
		w: 1.30080672,
		m0: 1.870704926,
		af0: 0.0002098083496,
		af1: -2.182787284e-11
	},
	{
		prn: 4,
		e: 0.00403881073,
		i0: 0.9729776485,
		omegaDot: -7.657461821e-9,
		sqrtA: 5153.608398,
		omega0: 1.184190474,
		w: -2.908638421,
		m0: -1.335283088,
		af0: 0.00006484985352,
		af1: 0
	},
	{
		prn: 5,
		e: 0.005258083344,
		i0: 0.9824871309,
		omegaDot: -7.760323249e-9,
		sqrtA: 5153.536621,
		omega0: 0.05515552259,
		w: 1.514786928,
		m0: -0.8078738282,
		af0: -0.0002374649048,
		af1: 0
	},
	{
		prn: 6,
		e: 0.003910541534,
		i0: 0.9847102046,
		omegaDot: -7.806039439e-9,
		sqrtA: 5153.730957,
		omega0: -0.9203985844,
		w: -0.577158024,
		m0: -3.057369768,
		af0: -0.00048828125,
		af1: 1.455191523e-11
	},
	{
		prn: 7,
		e: 0.02099895477,
		i0: 0.9511963197,
		omegaDot: -7.886042771e-9,
		sqrtA: 5153.694824,
		omega0: 2.191159729,
		w: -1.944721371,
		m0: 2.392966961,
		af0: -0.0002336502075,
		af1: -3.637978807e-12
	},
	{
		prn: 8,
		e: 0.01200199127,
		i0: 0.9405902807,
		omegaDot: -7.977475151e-9,
		sqrtA: 5153.736328,
		omega0: -2.050315875,
		w: 0.555531367,
		m0: -1.163783212,
		af0: 0.000316619873,
		af1: -1.091393642e-11
	},
	{
		prn: 9,
		e: 0.003871440887,
		i0: 0.9673750233,
		omegaDot: -7.703178011e-9,
		sqrtA: 5153.605469,
		omega0: 1.118409438,
		w: 2.087272977,
		m0: -0.528724903,
		af0: 0.0006513595581,
		af1: -1.091393642e-11
	},
	{
		prn: 10,
		e: 0.01158046722,
		i0: 0.9956877547,
		omegaDot: -7.611745631e-9,
		sqrtA: 5153.611816,
		omega0: 0.1153713841,
		w: -2.256166659,
		m0: 0.9946123952,
		af0: -0.000509262085,
		af1: 7.275957614e-12
	},
	{
		prn: 11,
		e: 0.002749443054,
		i0: 0.9616345796,
		omegaDot: -8.046049436e-9,
		sqrtA: 5153.640625,
		omega0: -0.9066470608,
		w: -2.276593021,
		m0: -1.879766498,
		af0: -0.0001773834229,
		af1: 1.091393642e-11
	},
	{
		prn: 12,
		e: 0.008949279785,
		i0: 0.9588842,
		omegaDot: -7.748894201e-9,
		sqrtA: 5152.888672,
		omega0: -2.973016179,
		w: 1.622045367,
		m0: 1.671423369,
		af0: -0.000599861145,
		af1: 0
	},
	{
		prn: 13,
		e: 0.0024766922,
		i0: 0.9594654349,
		omegaDot: -7.748894201e-9,
		sqrtA: 5153.727051,
		omega0: -3.081290281,
		w: 1.792640434,
		m0: 1.578503307,
		af0: 0.0004558563232,
		af1: 3.637978807e-12
	},
	{
		prn: 14,
		e: 0.007574558258,
		i0: 0.942208151,
		omegaDot: -7.943188009e-9,
		sqrtA: 5153.599609,
		omega0: -3.031267377,
		w: -2.672773146,
		m0: 1.56215982,
		af0: 0.0007486343384,
		af1: 0
	},
	{
		prn: 15,
		e: 0.01703691483,
		i0: 0.945671592,
		omegaDot: -7.943188009e-9,
		sqrtA: 5153.525879,
		omega0: 0.9689092288,
		w: 1.573558691,
		m0: -2.180224124,
		af0: 0.0004529953003,
		af1: 3.637978807e-12
	},
	{
		prn: 16,
		e: 0.0153837204,
		i0: 0.9579134778,
		omegaDot: -7.737465154e-9,
		sqrtA: 5153.700195,
		omega0: -2.956410912,
		w: 0.951550454,
		m0: -0.07379061781,
		af0: 0.0003519058228,
		af1: 7.275957614e-12
	},
	{
		prn: 17,
		e: 0.01267957687,
		i0: 0.9560559229,
		omegaDot: -7.828897534e-9,
		sqrtA: 5153.677734,
		omega0: -1.942149257,
		w: -1.066782896,
		m0: -1.135025941,
		af0: -0.0002117156982,
		af1: -3.637978807e-12
	},
	{
		prn: 18,
		e: 0.006585121155,
		i0: 0.9696819866,
		omegaDot: -7.943188009e-9,
		sqrtA: 5153.555176,
		omega0: -0.9286770623,
		w: -2.805139284,
		m0: -3.074375383,
		af0: -0.0002317428589,
		af1: 7.275957614e-12
	},
	{
		prn: 19,
		e: 0.01184511185,
		i0: 0.9551451218,
		omegaDot: -7.840326581e-9,
		sqrtA: 5153.54834,
		omega0: -1.898440542,
		w: 3.076122084,
		m0: 0.5157223935,
		af0: 0.0007047653198,
		af1: 0
	},
	{
		prn: 20,
		e: 0.001875400543,
		i0: 0.9627251441,
		omegaDot: -7.783181344e-9,
		sqrtA: 5153.588867,
		omega0: 1.122857458,
		w: -1.659766463,
		m0: 1.453219845,
		af0: 0.0003061294556,
		af1: 7.275957614e-12
	},
	{
		prn: 21,
		e: 0.0009078979492,
		i0: 0.9655833817,
		omegaDot: -7.920329914e-9,
		sqrtA: 5153.599609,
		omega0: 0.1172918562,
		w: -0.256051579,
		m0: 1.442983445,
		af0: 0.0003366470337,
		af1: -1.091393642e-11
	},
	{
		prn: 22,
		e: 0.01146221161,
		i0: 0.9573981561,
		omegaDot: -7.748894201e-9,
		sqrtA: 5153.660156,
		omega0: -2.95301301,
		w: -0.955619847,
		m0: -0.5337361815,
		af0: 0.0001058578491,
		af1: 7.275957614e-12
	},
	{
		prn: 23,
		e: 0.00683927536,
		i0: 0.9905704906,
		omegaDot: -7.680319916e-9,
		sqrtA: 5153.55957,
		omega0: 0.08219755158,
		w: -2.703748997,
		m0: 1.960405726,
		af0: 0.0006990432739,
		af1: 3.637978807e-12
	},
	{
		prn: 24,
		e: 0.01896905899,
		i0: 0.935335198,
		omegaDot: -8.046049436e-9,
		sqrtA: 5153.660156,
		omega0: 2.07853835,
		w: 1.193716435,
		m0: -2.908915931,
		af0: 0.0002536773682,
		af1: 1.455191523e-11
	},
	{
		prn: 25,
		e: 0.01175880432,
		i0: 0.9473134308,
		omegaDot: -7.863184676e-9,
		sqrtA: 5153.717285,
		omega0: -3.069379834,
		w: 0.985971395,
		m0: 1.858984728,
		af0: 0.0003786087036,
		af1: -3.637978807e-12
	},
	{
		prn: 26,
		e: 0.0116353035,
		i0: 0.9280667656,
		omegaDot: -8.091765626e-9,
		sqrtA: 5153.560547,
		omega0: 3.135045522,
		w: 0.746123611,
		m0: 0.7543762482,
		af0: -0.000394821167,
		af1: 0
	},
	{
		prn: 27,
		e: 0.01454591751,
		i0: 0.949668331,
		omegaDot: -7.897471819e-9,
		sqrtA: 5153.625488,
		omega0: -2.016328613,
		w: 0.904519112,
		m0: -0.9504744948,
		af0: 0,
		af1: 0
	},
	{
		prn: 28,
		e: 0.0004906654358,
		i0: 0.9620600196,
		omegaDot: -7.794610391e-9,
		sqrtA: 5153.623047,
		omega0: 2.167964262,
		w: -0.013959,
		m0: 2.832368192,
		af0: -0.0003843307495,
		af1: 1.091393642e-11
	},
	{
		prn: 29,
		e: 0.003607273102,
		i0: 0.9587583656,
		omegaDot: -7.840326581e-9,
		sqrtA: 5153.598633,
		omega0: -1.924786737,
		w: 2.910007619,
		m0: -1.283541197,
		af0: -0.00022315979,
		af1: 7.275957614e-12
	},
	{
		prn: 30,
		e: 0.008198261261,
		i0: 0.9365276284,
		omegaDot: -8.057478483e-9,
		sqrtA: 5153.571777,
		omega0: 2.178799125,
		w: -2.258712558,
		m0: 2.164497076,
		af0: 0.0003957748413,
		af1: 1.091393642e-11
	},
	{
		prn: 31,
		e: 0.01116275787,
		i0: 0.9548934531,
		omegaDot: -7.863184676e-9,
		sqrtA: 5153.609375,
		omega0: 2.216355813,
		w: 1.028379821,
		m0: 1.321761137,
		af0: -0.0001125335693,
		af1: 3.637978807e-12
	},
	{
		prn: 32,
		e: 0.00966501236,
		i0: 0.9702811979,
		omegaDot: -7.668890869e-9,
		sqrtA: 5153.565918,
		omega0: 1.136173056,
		w: -1.974185337,
		m0: -0.390984214,
		af0: 0.0003175735474,
		af1: 1.818989404e-11
	}
];
