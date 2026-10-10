export default interface HydacSchema {
	readonly resultCount: number;
	readonly relation: HydacRelation[];
}

export interface HydacRelation {
	readonly competitor: Competitor;
	readonly hydac: Hydac;
}

interface Competitor {
	readonly title: string;
	readonly mat_nr: string;
	readonly manufacturer: Manufacturer;
	readonly image: string[];
	readonly product: string[];
}

interface Manufacturer {
	readonly title: string;
	readonly uid: number;
}

interface Hydac {
	readonly title: string;
	readonly mat_nr: string;
	readonly manufacturer: Manufacturer;
	readonly image: Image;
	readonly product: HydacProduct;
}

interface Image {
	readonly src: string;
	readonly title: string;
	readonly description: string;
	readonly link: string;
}

interface HydacProduct {
	readonly is_salable: number | string;
	readonly cart_enabled?: number;
	readonly id?: number;
	readonly mat_nr?: string;
}
