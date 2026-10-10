export default interface FleetguardSchema {
	readonly returnValue: FleetguardDetailsPage;
	readonly cacheable: boolean;
}

export interface FleetguardDetailsPage {
	readonly addToCartVisible: boolean;
	readonly inventoryVisible: boolean;
	readonly items: FleetguardItem[];
	readonly pageNumber: number;
	readonly pageSize: number;
	readonly pricingVisible: boolean;
	readonly totalRecords: number;
}

export interface FleetguardItem {
	readonly imageUrl: string | null;
	readonly price: number;
	readonly productCurrency: string;
	readonly productDetailsWrapper: FleetguardDetails;
	readonly quantity: number;
}

export interface FleetguardSpecResponse {
	readonly returnValue: readonly FleetguardSpec[] | string;
	readonly cacheable: boolean;
}

export interface FleetguardSpec {
	readonly specName?: string;
	readonly specValue?: string;
	readonly displayName?: {
		readonly DeveloperName?: string;
		readonly Spec_Name__c?: string;
		readonly Trasnlatedlanguage__c?: string;
		readonly Language__c?: string;
		readonly Id?: string;
	} | null;
}

export interface FleetguardDetails {
	readonly competitorPN: string;
	readonly crossReferenceName: string;
	readonly crossReferenceNameReverse: string;
	readonly eqManufacturer: string;
	readonly exactmatch: boolean;
	readonly globalRanking: number;
	readonly longDescription?: string;
	readonly LongPartNo?: string;
	readonly obsoleteFlag: string;
	readonly productFamily: string;
	readonly productFamilyName: string;
	readonly productId: string;
	readonly productName: string;
	readonly relatedmatch: boolean;
	readonly relatedterm: string;
	readonly score: number;
	readonly searchTerm: string;
	readonly shortDescription?: string;
	readonly showCrossRef: boolean;
	readonly showMKdisc: boolean;
	readonly uniqueId: string;
	readonly upgrade_Replace: string[];
}
