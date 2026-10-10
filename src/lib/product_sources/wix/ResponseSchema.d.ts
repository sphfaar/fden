export default interface WixSchema {
	readonly data: Data;
}

interface Data {
	readonly catalogSearch: CatalogSearch;
}

interface CatalogSearch {
	readonly crossReference: CrossReference;
}

interface CrossReference {
	readonly items: CrossReferenceItem[];
	readonly pageInfo: PageInfo;
	readonly totalCount: number;
}

interface CrossReferenceItem {
	readonly product: WixProduct | null;
	readonly externalProductName: string | null;
	readonly manufacturer: string | null;
	readonly filterBy: string | null;
}

interface WixProduct {
	readonly name: string | null;
	readonly sku: string | null;
	readonly urlKey: string | null;
	readonly attributes: WixAttribute[] | null;
}

export interface WixAssets {
	readonly successful?: boolean;
	readonly hits: WixAssetHit[] | null;
}

export interface WixAssetHit {
	readonly uriTemplate: string | null;
	readonly metaData: {
		readonly productReferences: string[] | null;
		readonly erpReferences?: string[] | null;
	} | null;
}

interface WixAttribute {
	readonly key: string;
	readonly value: string | null;
}

interface PageInfo {
	readonly currentPage: number;
	readonly pageSize: number;
	readonly totalPages: number;
}
