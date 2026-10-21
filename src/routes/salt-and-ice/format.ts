/** Readout formats: whole degrees with a real minus sign, whole grams. */
export function degrees(temp: number): string {
	const r = Math.round(temp);
	return r < 0 ? `−${-r} °C` : `${r} °C`;
}

export const grams = (g: number) => `${Math.round(g).toLocaleString('en-US')} g`;
