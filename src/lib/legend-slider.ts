export const LEGEND_SLIDER_KEY = 'fden:legend-slider';
export const DEFAULT_LEGEND_SLIDER = 0.5;

export function clampLegendSlider(n: number) {
	return Math.min(1, Math.max(0, n));
}

export function loadLegendSlider(): number {
	try {
		const raw = localStorage.getItem(LEGEND_SLIDER_KEY);
		if (raw == null) return DEFAULT_LEGEND_SLIDER;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return DEFAULT_LEGEND_SLIDER;
		return clampLegendSlider(parsed);
	} catch {
		return DEFAULT_LEGEND_SLIDER;
	}
}

export function saveLegendSlider(value: number) {
	try {
		localStorage.setItem(LEGEND_SLIDER_KEY, JSON.stringify(clampLegendSlider(value)));
	} catch {
		// private mode or quota
	}
}
