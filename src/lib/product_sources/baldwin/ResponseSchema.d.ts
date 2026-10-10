export default interface BaldwinSchema {
	readonly responseHeader?: ResponseHeader;
	readonly grouped?: Readonly<Record<string, CrossReferenceGroup | undefined>>;
}

export interface ResponseHeader {
	readonly status?: number;
	readonly QTime?: number;
}

export interface CrossReferenceGroup {
	readonly matches?: number;
	readonly doclist?: CrossReferenceList;
}

export interface CrossReferenceList {
	readonly numFound?: number;
	readonly start?: number;
	readonly docs?: CrossReferenceDocument[];
}

export interface CrossReferenceDocument {
	readonly manufacturer_s?: string;
	readonly partNumber_s?: string;
	readonly code_si?: string;
	readonly urlKeyword_si?: string;
	readonly psURLKeyword_si?: string;
	readonly qualifiers_s?: string;
	readonly qualifiers_appfacet?: string;
	readonly baldwinPartId_s?: string;
	readonly compPartId_s?: string;
	readonly productSeriesId_s?: string;
	readonly manufacturer_appfacet?: string;
	readonly id?: string;
}

export interface BaldwinPartSchema {
	readonly response?: {
		readonly numFound?: number;
		readonly docs?: BaldwinPartDocument[];
	};
}

export interface BaldwinPartDocument {
	readonly baldwinPartId_s?: string;
	readonly description_si?: string;
	readonly lengthmm_si?: string;
	readonly od1mm_si?: string;
	readonly id1mm_si?: string;
	readonly od2mm_si?: string;
	readonly id2mm_si?: string;
	readonly thread_si?: string;
	readonly perInch_si?: string;
	readonly micronRating_si?: string;
	readonly fits_si?: string;
	readonly notes_si?: string;
	readonly contain_si?: string;
	readonly sizemm_si?: string;
	readonly size_si?: string;
	readonly aGskt_si?: string;
	readonly fGskt_si?: string;
	readonly iGskt_si?: string;
	readonly oGskt_si?: string;
	readonly inlet_si?: string;
	readonly outlet_si?: string;
	readonly partImage_si?: string;
}
