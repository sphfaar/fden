export default interface BaldwinSchema {
	readonly responseHeader: ResponseHeader;
	readonly grouped: Grouped;
}

interface Grouped {
	readonly [index: string]: CompPartIDS1000OR1000OR1000;
}

interface CompPartIDS1000OR1000OR1000 {
	readonly matches: number;
	readonly doclist: Doclist;
}

interface Doclist {
	readonly numFound: number;
	readonly start: number;
	readonly docs: Doc[];
}

interface Doc {
	readonly manufacturer_appfacet: string;
	readonly baldwinPartId_s: string;
	readonly quantity_si: string;
	readonly manufacturerSort_appfacet: string;
	readonly urlKeyword_si: string;
	readonly id: string;
	readonly compPartId_s: string;
	readonly baldwinPartIdSort_appfacet: string;
	readonly manufacturerHashCode_s: string;
	readonly qualifiers_appfacet: string;
	readonly code_si: string;
	readonly partNumber_s: string;
	readonly coreName_s: CoreNameS;
	readonly psURLKeyword_si: string;
	readonly partNumberSort_appfacet: string;
	readonly qualifiers_s: string;
	readonly manufacturer_s: string;
	readonly _version_: number;
}

enum CoreNameS {
	BaldwinCrossRefData = 'BaldwinCrossRefData'
}

interface ResponseHeader {
	readonly status: number;
	readonly QTime: number;
	readonly params: Params;
}

interface Params {
	readonly indent: string;
	readonly q: string;
	readonly 'group.limit': string;
	readonly _tmp5005753679398: string;
	readonly 'group.query': string;
	readonly group: string;
	readonly 'group.offset': string;
	readonly wt: string;
	readonly fq: string;
}
