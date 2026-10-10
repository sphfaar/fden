export default interface HiFiSchema {
	readonly id: string;
	readonly query: Query;
	readonly paging: Paging;
	readonly results: HiFiResult[];
	readonly duration: number;
}

interface Paging {
	readonly currentPage: number;
	readonly pageSize: number;
	readonly count: number;
	readonly totalFetched: number;
	readonly total: number;
	readonly lastPage?: number;
	readonly prevPage?: number | null;
	readonly nextPage?: number | null;
}

interface Query {
	readonly id: string;
	readonly page: number;
	readonly queryString: string;
	readonly filters: Filter[];
}

interface Filter {
	readonly name: string;
	readonly type: string;
	readonly values: string[];
}

export interface HiFiResult {
	readonly id: string;
	readonly reference: string;
	readonly referenceSlug?: string;
	readonly brand: HiFiBrand;
	readonly products: HiFiCrossProduct[];
	readonly isPublic?: boolean;
}

interface HiFiBrand {
	readonly id: string;
	readonly name: string;
	readonly slug?: string;
}

export interface HiFiCrossProduct {
	readonly id: string;
	readonly number?: string;
	readonly reference: string;
	readonly referenceSlug?: string;
	readonly family?: string;
	readonly designation?: string;
	readonly attributes?: HiFiAttribute[];
	readonly photos?: HiFiMedia[];
	readonly drawings?: HiFiMedia[];
	readonly unit?: string;
	readonly weight?: number | null;
	readonly volume?: number | null;
	readonly gencode?: string | null;
	readonly replacementFor?: string[];
	readonly isPublic?: boolean;
}

export interface HiFiAttribute {
	readonly code: string;
	readonly type?: string;
	readonly unit?: string;
	readonly decimalValue?: number;
	readonly stringValue?: string;
	readonly isPublic?: boolean;
}

export interface HiFiMedia {
	readonly id: string;
	readonly broadcastType?: string;
	readonly broadcastOrder?: number;
}
