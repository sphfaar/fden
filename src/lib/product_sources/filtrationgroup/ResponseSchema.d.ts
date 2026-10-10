export default interface FiltrationGroupchema {
	readonly success: boolean;
	readonly template: string;
	readonly message?: string;
}

export interface FiltrationGroupCategories {
	readonly data?: {
		readonly products?: {
			readonly items?: readonly FiltrationGroupCategoryItem[];
		};
	};
}

export interface FiltrationGroupCategoryItem {
	readonly sku?: string | null;
	readonly categories?: readonly FiltrationGroupCategory[];
}

export interface FiltrationGroupCategory {
	readonly name?: string | null;
	readonly url_path?: string | null;
}
