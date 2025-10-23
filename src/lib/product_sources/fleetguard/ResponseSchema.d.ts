export default interface FleetguardSchema {
	readonly actions: ActionElement[];
	readonly context: Context;
	readonly perfSummary: PerfSummary;
}

interface ActionElement {
	readonly id: string;
	readonly state: string;
	readonly returnValue: ActionReturnValue;
}

interface ActionReturnValue {
	readonly returnValue: PurpleReturnValue;
	readonly cacheable: boolean;
}

interface ReturnValueElement {
	readonly sfid: string;
	readonly equipId: string;
	readonly externalId: string;
	readonly equipType: EquipType;
	readonly equipMfgr: string;
	readonly equipMakeModel: string;
	readonly engineModel: string;
	readonly equipYear: string;
	readonly globalRanking?: number;
}

enum EquipType {
	Empty = '',
	Engine = 'Engine',
	Industrial = 'Industrial',
	Marine = 'Marine',
	OffHighway = 'Off highway',
	OnHighway = 'On Highway',
	Powergen = 'Powergen'
}

interface PurpleReturnValue {
	readonly filterDetails?: FilterDetail[];
	readonly productIds?: string[];
	readonly productSearchData?: ProductSearchDatum[];
	readonly totalCount?: number;
}

interface FilterDetail {
	readonly displayName: string;
}

interface ProductSearchDatum {
	readonly competitorPN?: string;
	readonly crossReferenceName?: string;
	readonly crossReferenceNameReverse?: string;
	readonly eqManufacturer?: string;
	readonly exactmatch: boolean;
	readonly globalRanking?: number;
	readonly imgUrl: string;
	readonly longDescription?: string;
	readonly obsoleteFlag: ObsoleteFlag;
	readonly productFamily: ProductFamily;
	readonly productFamilyName?: string;
	readonly productId: string;
	readonly productName: string;
	readonly relatedmatch: boolean;
	readonly relatedterm: string;
	readonly score: number;
	readonly searchTerm: string;
	readonly shortDescription: string;
	readonly showCrossRef?: boolean;
	readonly showMKdisc: boolean;
	readonly uniqueId: string;
	readonly upgrade_Replace: string[];
}

enum ObsoleteFlag {
	N = 'N',
	Y = 'Y'
}

enum ProductFamily {
	ExhaustSystem = 'Exhaust System',
	Fuel = 'Fuel',
	Lube = 'Lube'
}

interface Context {
	readonly mode: string;
	readonly app: string;
	readonly contextPath: string;
	readonly pathPrefix: string;
	readonly fwuid: string;
	readonly mlr: number;
	readonly coos: number;
	readonly loaded: Loaded;
	readonly globalValueProviders: GlobalValueProvider[];
	readonly enableAccessChecks: boolean;
	readonly apce: number;
	readonly dns: string;
	readonly ls: number;
	readonly lav: string;
	readonly csp: number;
	readonly lgef: string[];
	readonly cpf: number;
	readonly mna: Mna;
	readonly arse: number;
	readonly acaf: number;
	readonly services: string[];
}

interface GlobalValueProvider {
	readonly type: string;
	readonly values: Values;
}

interface Values {
	readonly eswConfigDeveloperName: AppContextID;
	readonly isVoiceOver: IsVoiceOver;
	readonly setupAppContextId: AppContextID;
	readonly density: AppContextID;
	readonly srcdoc: IsVoiceOver;
	readonly appContextId: AppContextID;
	readonly dynamicTypeSize: AppContextID;
}

interface AppContextID {
	readonly writable: boolean;
	readonly defaultValue: string;
}

interface IsVoiceOver {
	readonly writable: boolean;
	readonly defaultValue: boolean;
}

interface Loaded {
	readonly 'APPLICATION@markup://siteforce:communityApp': string;
	readonly 'COMPONENT@markup://instrumentation:o11ySecondaryLoader': string;
}

interface Mna {
	readonly lightning: string;
}

interface PerfSummary {
	readonly version: string;
	readonly request: number;
	readonly actions: { [key: string]: ActionValue };
	readonly actionsTotal: number;
	readonly overhead: number;
}

interface ActionValue {
	readonly total: number;
	readonly db: number;
}
