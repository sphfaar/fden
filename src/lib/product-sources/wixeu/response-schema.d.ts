export default interface WixEuSchema {
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
	readonly product: WixEuProduct | null;
	readonly externalProductName: string | null;
	readonly manufacturer: string | null;
	readonly filterBy: string | null;
}

interface WixEuProduct {
	readonly name: string | null;
	readonly sku: string | null;
	readonly urlKey: string | null;
	readonly attributes: WixEuAttribute[] | null;
}

export interface WixEuAssets {
	readonly successful?: boolean;
	readonly hits: WixEuAssetHit[] | null;
}

export interface WixEuAssetHit {
	readonly uriTemplate: string | null;
	readonly metaData: {
		readonly productReferences: string[] | null;
		readonly erpReferences?: string[] | null;
	} | null;
}

interface WixEuAttribute {
	readonly key: string;
	readonly value: string | null;
	readonly label: string | null;
}

interface PageInfo {
	readonly currentPage: number;
	readonly pageSize: number;
	readonly totalPages: number;
}
