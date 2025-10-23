export default interface ParkerSchema {
	readonly '@odata.context': string;
	readonly '@odata.count': number;
	readonly '@search.facets': SearchFacets;
	readonly value: Value[];
}

interface SearchFacets {
	readonly DivisionName: DivisionName[];
	readonly Type: DivisionName[];
	readonly FromManufacturerName: DivisionName[];
}

interface DivisionName {
	readonly count: number;
	readonly value: string;
}

interface Value {
	readonly '@search.score': number;
	readonly CrossReferenceID: string;
	readonly CreatedOn: Date;
	readonly FromPartNumber: string;
	readonly Division: string;
	readonly DivisionName: string;
	readonly Type: Type;
	readonly FromManufacturerName: string;
	readonly ToPartNumber: string;
	readonly DropIn: DropIn;
	readonly Description: null | string;
	readonly UrlCountryCode: null | string;
	readonly URLKeywords: null | string;
	readonly CleanedFromPartNumber: string;
	readonly Published: Published;
	readonly DivisionId: number;
	readonly PartTypeId: number;
	readonly ManufacturerId: number;
	readonly IsTFS: DropIn;
	readonly Obsolete: DropIn;
	readonly ActualFromPartNumber: string;
}

enum DropIn {
	False = 'False',
	True = 'True'
}

enum Published {
	Yes = 'YES'
}

enum Type {
	CylindersAndActuators = 'Cylinders and Actuators',
	FiltersCollectorsSeparatorsPurifiers = 'Filters, Collectors, Separators, Purifiers',
	FittingsAndQuickCouplings = 'Fittings and Quick Couplings',
	HosePipingAndTubing = 'Hose, Piping and Tubing',
	MotorsDrivesAndControllers = 'Motors, Drives and Controllers',
	SealsAndORings = 'Seals and O-Rings',
	Valves = 'Valves'
}
