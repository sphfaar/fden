export default interface FiltrecSchema {
	readonly data: Datum[];
	readonly meta: Meta;
	readonly success: boolean;
}

export interface Datum {
	readonly code: string;
	readonly product: FiltrecSearchProduct | null;
	readonly manufacturer: string;
	readonly catalog: string;
	readonly productCode: string;
}

export interface FiltrecSearchProduct {
	readonly code: string;
	readonly image: FiltrecImage | null;
	readonly diameter1: number | null;
	readonly diameter2: number | null;
	readonly height1: number | null;
	readonly measureG: string;
	readonly beta: FiltrecMedia | null;
}

export interface FiltrecImage {
	readonly url: string;
}

export interface FiltrecMedia {
	readonly code?: string;
	readonly media?: string;
	readonly mediaEng?: string;
}

interface Meta {
	readonly last: number;
	readonly current: number;
	readonly numItemsPerPage: number;
	readonly first: number;
	readonly pageCount: number;
	readonly totalCount: number;
	readonly pageRange: number;
	readonly startPage: number;
	readonly endPage: number;
	readonly next?: number;
	readonly pagesInRange: number[];
	readonly firstPageInRange: number;
	readonly lastPageInRange: number;
	readonly currentItemCount: number;
	readonly firstItemNumber: number;
	readonly lastItemNumber: number;
}

export interface FiltrecDetailsSchema {
	readonly data?: FiltrecDetailsData;
	readonly success?: boolean;
}

export interface FiltrecDetailsData {
	readonly code: string;
	readonly description: string;
	readonly product: FiltrecDetailsProduct;
	readonly note: string;
	readonly productCode: string;
}

export interface FiltrecDetailsProduct {
	readonly a?: boolean;
	readonly flow?: string | null;
	readonly measureG?: string;
	readonly diameter1?: number | null;
	readonly diameter2?: number | null;
	readonly height1?: number | null;
	readonly note?: string;
	readonly noteEng?: string;
	readonly image?: FiltrecImage | null;
	readonly drawing?: FiltrecImage | null;
	readonly beta?: FiltrecDetailsBeta | null;
}

export interface FiltrecDetailsBeta extends FiltrecMedia {
	readonly efficiency1?: string | null;
	readonly efficiency2?: string | null;
}
