/** Places a receiver can be put, for the steps that use the real constellation. */
export interface Place {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

export const PLACES: readonly Place[] = [
	{ id: 'london', name: 'London', lat: 51.51, lon: -0.13 },
	{ id: 'palma', name: 'Palma de Mallorca', lat: 39.57, lon: 2.65 },
	{ id: 'nairobi', name: 'Nairobi', lat: -1.29, lon: 36.82 },
	{ id: 'tokyo', name: 'Tokyo', lat: 35.68, lon: 139.69 },
	{ id: 'sydney', name: 'Sydney', lat: -33.87, lon: 151.21 },
	{ id: 'quito', name: 'Quito', lat: -0.18, lon: -78.47 },
	{ id: 'mcmurdo', name: 'Antarctica (McMurdo)', lat: -77.85, lon: 166.67 }
];

export const placeById = (id: unknown): Place => PLACES.find((p) => p.id === id) ?? PLACES[0];
