export default interface Response1Schema {
	// nonFoundTerms: any[];
	products: Product[];
}

interface Product {
	attributes: Attributes;
	Id: string;
	Name: string;
	CrossRef__c: string;
	CNPR_ShortDescRT__c: string;
}

interface Attributes {
	type: Type;
	url: string;
}
