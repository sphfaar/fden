export default interface ArgohytosSchema {
	readonly header: Header[];
	readonly data: ArgohytosRow[];
	readonly src: string;
	readonly count: number;
	readonly index: null;
	readonly hasDetails: boolean;
}

export interface ArgohytosRow {
	readonly id: string;
	readonly sysId: string;
	readonly sku: string;
	readonly materialNumber: string;
	readonly description: string;
	readonly dimension: string;
	readonly referenceNumber: string;
	readonly referenceName: string;
	readonly imagePath: string;
	readonly quantityUnit: string;
	readonly sortOrder: string;
}

interface Header {
	readonly id: string;
	readonly hidden?: boolean;
	readonly dictId?: string;
}

export interface ArgohytosDetails {
	readonly sku: string;
	readonly materialNumber: string;
	readonly imagePath: string | null;
	readonly categories: ArgohytosCategory[];
	readonly productDescription: string | null;
	readonly headerAttributes: ArgohytosAttribute[];
	readonly extendedAttributes: ArgohytosAttribute[];
}

export interface ArgohytosCategory {
	readonly code: string;
	readonly label: string;
}

export interface ArgohytosAttribute {
	readonly code: string;
	readonly label: string;
	readonly value: string | null;
	readonly type: string;
}
