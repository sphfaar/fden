export default interface ArgohytosSchema {
	readonly total: number;
	readonly offset: number;
	readonly amount: number;
	readonly elements: Element[];
	readonly type: string;
	readonly sortKeys: string[];
	readonly name: string;
}

interface Element {
	readonly attributes: ElementAttribute[];
	readonly uri: string;
	readonly title: Title;
	readonly attributeGroups: AttributeGroups;
}

interface AttributeGroups {
	readonly SEARCH_DETAIL_ATTRIBUTES: SearchDetailAttributes;
}

interface SearchDetailAttributes {
	readonly name: SEARCHDETAILATTRIBUTESName;
	readonly attributes: SEARCHDETAILATTRIBUTESAttribute[];
}

interface SEARCHDETAILATTRIBUTESAttribute {
	readonly name: AttributeName;
	readonly type: PurpleType;
	readonly value: string[];
}

type AttributeName = 'CompetitorIDs' | 'CustomerSKUs' | 'FullCompetitorIDs';

type PurpleType = 'MultipleString';

type SEARCHDETAILATTRIBUTESName = 'SEARCH_DETAIL_ATTRIBUTES';

interface ElementAttribute {
	readonly name: string;
	readonly type: FluffyType;
	readonly value: ValueUnion;
}

type FluffyType = 'String' | 'ResourceAttribute' | 'Boolean' | 'DefaultCategoryRO';

type ValueUnion = boolean | ValueClass | string;

interface ValueClass {
	readonly type: ValueType;
	readonly value?: number;
	readonly unit?: string;
	readonly name?: ID;
	readonly id?: ID;
	readonly categoryPath?: CategoryPath[];
	readonly uri?: string;
}

interface CategoryPath {
	readonly name: ID;
	readonly type: CategoryPathType;
	readonly id: ID;
	readonly uri: string;
}

type ID = 'AHCatalog' | '010050010010' | '010050040150';

type CategoryPathType = 'CategoryPath';

type ValueType = 'Quantity' | 'DefaultCategory';

type Title = 'Paper element' | 'EXAPOR Standard element' | 'EXAPOR R.GO Element';
