export default interface UfiSchema {
	readonly actions: Action[];
	readonly context: Context;
	readonly perfSummary: PerfSummary;
}

interface Action {
	readonly id: string;
	readonly state: string;
	readonly returnValue: ActionReturnValue;
	// readonly error:       any[];
}

interface ActionReturnValue {
	readonly returnValue: ReturnValueReturnValue;
	readonly cacheable: boolean;
}

interface ReturnValueReturnValue {
	readonly hits: Hit[];
	readonly total: Total;
}

interface Hit {
	readonly sort: string[];
	readonly _source: Source;
	readonly _id: string;
	readonly _type: Type;
	readonly _index: Index;
}

type Index = 'pim-emea_cross_ufi';

interface Source {
	readonly manufacturer: Manufacturer;
	readonly description?: string;
	readonly cross_code: string;
	readonly application_code: string;
	readonly application: Application;
	readonly filter: string;
}

interface Application {
	readonly pt_PT: string;
	readonly de_DE: string;
	readonly fr_FR: string;
	readonly en_EN: string;
	readonly pt_BR: string;
	readonly zh_CN: string;
	readonly es_ES: string;
	readonly tr_TR: string;
	readonly ru_RU: string;
	readonly it_IT: string;
}

type Manufacturer = 'AC DELCO' | 'ADL (BLUEPRINT)';

type Type = '_doc';

interface Total {
	readonly relation: string;
	readonly value: number;
}

interface Context {
	readonly mode: string;
	readonly app: string;
	readonly contextPath: string;
	readonly pathPrefix: string;
	readonly fwuid: string;
	readonly mlr: number;
	readonly uad: number;
	readonly coos: number;
	readonly loaded: Loaded;
	readonly globalValueProviders: GlobalValueProvider[];
	readonly enableAccessChecks: boolean;
	readonly apce: number;
	readonly dns: string;
	readonly ls: number;
	// readonly lairn:                any[];
	// readonly laerc:                any[];
	readonly lav: string;
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
}

interface Mna {
	readonly lightning: string;
}

interface PerfSummary {
	readonly version: string;
	readonly request: number;
	readonly actions: Actions;
	readonly actionsTotal: number;
	readonly overhead: number;
}

interface Actions {
	readonly '140;a': The140A;
}

interface The140A {
	readonly total: number;
	readonly db: number;
}
