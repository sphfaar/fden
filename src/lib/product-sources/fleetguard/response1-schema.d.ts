export default interface FleetguardPartsResponse {
	readonly returnValue: string;
	readonly cacheable: boolean;
}

export interface FleetguardPartsPayload {
	readonly nonFoundTerms: readonly unknown[];
	readonly products: readonly FleetguardPart[];
}

export interface FleetguardPart {
	readonly attributes: {
		readonly type: string;
		readonly url: string;
	};
	readonly Id: string;
	readonly Name: string;
	readonly CrossRef__c: string;
	readonly CNPR_ShortDescRT__c?: string;
}
