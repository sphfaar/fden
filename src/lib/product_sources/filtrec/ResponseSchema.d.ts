export default interface FiltrecSchema {
	readonly data: Datum[];
	readonly meta: Meta;
	readonly success: boolean;
}

interface Datum {
	readonly code: string;
	readonly product: Product;
	readonly manufacturer: string;
	readonly catalog: string;
	readonly productCode: string;
}

interface Product {
	readonly code: string;
	readonly image: Image;
	readonly diameter1: number;
	readonly diameter2: null;
	readonly height1: number;
	readonly measureG: string;
	readonly beta: Beta;
}

interface Beta {
	readonly code: string;
	readonly media: string;
	readonly mediaEng: string;
}

interface Image {
	readonly url: string;
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
	readonly pagesInRange: number[];
	readonly firstPageInRange: number;
	readonly lastPageInRange: number;
	readonly currentItemCount: number;
	readonly firstItemNumber: number;
	readonly lastItemNumber: number;
}
