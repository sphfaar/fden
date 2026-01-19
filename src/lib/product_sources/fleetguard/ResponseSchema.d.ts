export default interface FleetguardSchema {
	readonly returnValue: ReturnValue;
	readonly cacheable: boolean;
}

interface ReturnValue {
	readonly addToCartVisible: boolean;
	readonly inventoryVisible: boolean;
	readonly items: Item[];
	readonly pageNumber: number;
	readonly pageSize: number;
	readonly pricingVisible: boolean;
	readonly totalRecords: number;
}

interface Item {
	readonly imageUrl: string;
	readonly price: number;
	readonly productCurrency: string;
	readonly productDetailsWrapper: ProductDetailsWrapper;
	readonly quantity: number;
}

interface ProductDetailsWrapper {
	readonly competitorPN: string;
	readonly crossReferenceName: string;
	readonly crossReferenceNameReverse: string;
	readonly eqManufacturer: string;
	readonly exactmatch: boolean;
	readonly globalRanking: number;
	readonly longDescription: string;
	readonly obsoleteFlag: string;
	readonly productFamily: string;
	readonly productFamilyName: string;
	readonly productId: string;
	readonly productName: string;
	readonly relatedmatch: boolean;
	readonly relatedterm: string;
	readonly score: number;
	readonly searchTerm: string;
	readonly shortDescription: string;
	readonly showCrossRef: boolean;
	readonly showMKdisc: boolean;
	readonly uniqueId: string;
	readonly upgrade_Replace: string[];
}
