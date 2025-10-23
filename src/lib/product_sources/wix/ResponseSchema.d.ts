export default interface WIXSchema {
	readonly PartID: string;
	readonly PartNumber: string;
	readonly ChildPartNumber: string;
	readonly Manufacturer: string;
	readonly Abbreviation: string;
	readonly Status: Status;
	readonly PartF: string;
	readonly Brand: null;
	readonly PartType: null;
	readonly UsageCode: number;
	readonly ImageFileName: string;
	readonly LeadTime: LeadTime;
}

enum LeadTime {
	Empty = '',
	Mto = 'MTO',
	Stock = 'STOCK'
}

enum Status {
	A = 'A',
	I = 'I',
	O = 'O'
}
