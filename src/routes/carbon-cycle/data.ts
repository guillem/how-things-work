/**
 * Reservoir sizes and flows of the global carbon cycle, GtC and GtC/yr.
 *
 * Where the two disagree, the latest edition wins:
 *
 * - GCB 2025: Friedlingstein, P. et al. (2026), "Global Carbon Budget 2025",
 *   Earth System Science Data 18, 3211–3288, https://doi.org/10.5194/essd-18-3211-2026
 *   (CC BY 4.0). Fig. 2 (stocks; fluxes as decade means 2015–2024), Table 7
 *   (decade means), Table 8 (cumulative 1850–2024), text (atmosphere 590 GtC in
 *   1750, 898 GtC in 2024; 1 ppm = 2.124 GtC, Table 1).
 * - AR6: Canadell, J. G. et al. (2021), "Global Carbon and Other Biogeochemical
 *   Cycles and Feedbacks", in Climate Change 2021: The Physical Science Basis
 *   (IPCC AR6 WG1), ch. 5, Fig. 5.12: pre-industrial gross flows, the split of
 *   the ocean into surface (900) and intermediate + deep (37,100), and the slow
 *   flows of volcanoes, weathering, rivers and burial.
 * - Rock: Falkowski, P. et al. (2000), "The Global Carbon Cycle: A Test of Our
 *   Knowledge of Earth as a System", Science 290, 291–296,
 *   https://doi.org/10.1126/science.290.5490.291, Table 1: sedimentary
 *   carbonates > 60,000,000 GtC, kerogens 15,000,000 GtC.
 * - NPP: Zhao, M. & Running, S. W. (2010), Science 329, 940–943, 53.5 GtC/yr
 *   (MODIS, 2000–2009); about 47% of gross photosynthesis, as in Waring et al.
 *   (1998), Tree Physiology 18, 129–134.
 */

/** Stocks before industrialisation (1750). */
export const PRE = {
	/** GCB 2025 text: 590 GtC in 1750 (278 ppm). */
	atmosphere: 590,
	/** GCB 2025 Fig. 2. */
	plants: 450,
	soils: 1700,
	/** Frozen; not exchanging in this model. GCB 2025 Fig. 2. */
	permafrost: 1400,
	/** AR6 Fig. 5.12. */
	surfaceOcean: 900,
	deepOcean: 37100,
	/** Dissolved organic carbon, AR6 Fig. 5.12 (GCB 2025: 700 "organic carbon"). */
	oceanOrganic: 700,
	marineLife: 3,
	/** GCB 2025 Fig. 2 (AR6: 1750). */
	seafloor: 1750,
	/** Proven reserves, GCB 2025 Fig. 2. */
	coal: 560,
	oil: 230,
	gas: 115,
	/** Falkowski et al. (2000) Table 1. */
	carbonateRock: 60_000_000,
	kerogen: 15_000_000
} as const;

export const FOSSIL_RESERVES = PRE.coal + PRE.oil + PRE.gas;
/** Fossil resources (not yet economic to extract), AR6 Fig. 5.12 caption: coal + oil + gas. */
export const FOSSIL_RESOURCES = 11_490 + 6_780 + 365;
export const ROCK = PRE.carbonateRock + PRE.kerogen;

/** The atmosphere in 2024 (GCB 2025: 422.8 ppm, 898 GtC). */
export const AIR_2024 = 898;
export const PPM_2024 = 422.8;

/** Natural gross flows, GtC/yr (AR6 Fig. 5.12, pre-industrial). */
export const NATURAL = {
	photosynthesis: 113,
	respiration: 111.1,
	/** Net primary production (Zhao & Running 2010). */
	npp: 53.5,
	oceanIn: 54.0,
	oceanOut: 54.6,
	/** Water carrying carbon down out of the mixed layer, and back up. */
	subduction: 275,
	obduction: 264,
	/** Sinking organic matter (the biological pump). */
	export: 11,
	volcanoes: 0.1,
	weathering: 0.3,
	riversToOcean: 0.8,
	seafloorBurial: 0.2
} as const;

/** The human budget, decade mean 2015–2024, GtC/yr (GCB 2025 Table 7). */
export const BUDGET = {
	fossil: 9.8,
	landUse: 1.4,
	air: 5.6,
	ocean: 3.2,
	land: 2.4,
	imbalance: 0
} as const;

/** Cumulative 1850–2024, GtC (GCB 2025 Table 8). */
export const CUMULATIVE = {
	fossil: 495,
	landUse: 250,
	air: 290,
	ocean: 200,
	land: 175,
	imbalance: 80
} as const;
