export default interface HiFiSchema {
	readonly id: string;
	readonly query: Query;
	readonly paging: Paging;
	readonly results: Result[];
	readonly duration: number;
}

interface Paging {
	readonly currentPage: number;
	readonly pageSize: number;
	readonly count: number;
	readonly totalFetched: number;
	readonly total: number;
	readonly lastPage: number;
	readonly prevPage: null;
	readonly nextPage: number;
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

interface Result {
	readonly id: string;
	readonly reference: string;
	readonly brand: Brand;
	readonly products: Product[];
	readonly isPublic: boolean;
}

interface Brand {
	readonly id: string;
	readonly name: string;
}

interface Product {
	readonly id: string;
	readonly number: string;
	readonly reference: string;
	readonly family: string;
	readonly lifecycle: null;
	readonly filterCode2: FilterCode2;
	readonly abcdeClassification: null;
	readonly classifiedPublic: boolean;
	readonly designation: string;
	readonly attributes: Attribute[];
	readonly photos?: Drawing[];
	readonly drawings: Drawing[];
	// readonly customerReferences: any[];
	readonly volume: number | null;
	readonly weight: number | null;
	readonly originCountry: null;
	readonly commodityCode: null;
	readonly filterCode4: null;
	readonly gencode: null | string;
	// readonly priceListCodes: any[];
	readonly unit: ProductUnit;
	readonly isPublic: boolean;
	readonly isInternal: boolean;
	readonly isNeutral: boolean;
	readonly isPersonalized: boolean;
}

interface Attribute {
	readonly code: string;
	readonly type: Type;
	readonly unit?: AttributeUnit;
	readonly decimalValue?: number;
	readonly isPublic: boolean;
	readonly stringValue?: string;
}

enum Type {
	Decimal = 'DECIMAL',
	String = 'STRING'
}

enum AttributeUnit {
	Mm = 'mm',
	Pcs = 'Pcs'
}

interface Drawing {
	readonly id: string;
	readonly product: null;
	readonly broadcastType: BroadcastType;
	readonly broadcastOrder: number;
}

enum BroadcastType {
	Public = 'PUBLIC'
}

enum FilterCode2 {
	Std = 'STD'
}

enum ProductUnit {
	Pcs = 'PCS'
}
