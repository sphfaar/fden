export default interface SfSchema {
	readonly payload: Payload;
	readonly success: boolean;
	readonly message: string | null;
	readonly modelErrors: null;
}

interface Payload {
	readonly data: SfRow[];
	readonly pagination: SfPagination;
}

export interface SfPagination {
	readonly itemsTotal: number;
	readonly pageSize: number;
	readonly pagesCount: number;
	readonly currentPage: number;
}

export interface SfRow {
	readonly originalNumber: string;
	readonly id: string;
	readonly sku: string;
	readonly item: SfItem;
	readonly type: string;
	readonly availability: SfAvailability;
	readonly favorite: boolean;
	readonly pricePcs: number;
	readonly priceUponRequest?: boolean;
	readonly quantity: number;
	readonly note: string | null;
	readonly label: string | null;
	readonly disabled: boolean;
	readonly brand: string;
}

interface SfAvailability {
	readonly state: string;
	readonly inStockDate: string | null;
}

interface SfItem {
	readonly image: SfImage;
	readonly link: SfLink;
	readonly sublabel: string;
}

interface SfImage {
	readonly id: string;
	readonly alt: string;
	readonly defaultUrl: string | null;
	readonly defaultUrlHiRes: string | null;
}

interface SfLink {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly target: string;
	readonly isActive: boolean;
	readonly smartLink: SfSmartLink;
	readonly localization: null;
}

interface SfSmartLink {
	readonly itemId: null;
	readonly titleCodename: null;
}
