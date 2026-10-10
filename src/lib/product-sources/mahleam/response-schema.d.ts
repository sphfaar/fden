export default interface MahleamSchema {
	readonly totalMatchingArticles?: number;
	readonly maxAllowedPage?: number;
	readonly articles?: MahleamArticle[];
	readonly status?: number;
	readonly statusText?: string;
}

export interface MahleamArticle {
	readonly dataSupplierId?: number;
	readonly articleNumber?: string;
	readonly mfrName?: string;
	readonly misc?: MahleamMisc;
	readonly genericArticles?: MahleamGenericArticle[];
	readonly articleText?: MahleamArticleText[] | string;
	readonly oemNumbers?: MahleamOemNumber[];
	readonly articleCriteria?: MahleamCriterion[];
	readonly articleLogisticsCriteria?: MahleamCriterion[];
	readonly images?: MahleamImage[];
	readonly searchQueryMatches?: MahleamSearchMatch[];
}

export interface MahleamMisc {
	readonly additionalDescription?: string;
}

export interface MahleamGenericArticle {
	readonly genericArticleDescription?: string;
}

export interface MahleamArticleText {
	readonly informationTypeDescription?: string;
	readonly text?: string[];
}

export interface MahleamOemNumber {
	readonly articleNumber?: string;
	readonly mfrName?: string;
	readonly matchesSearchQuery?: boolean;
}

export interface MahleamCriterion {
	readonly criteriaId?: number;
	readonly criteriaUnitDescription?: string;
	readonly formattedValue?: string;
}

export interface MahleamImage {
	readonly imageURL800?: string;
	readonly headerDescription?: string;
	readonly sortNumber?: number;
}

export interface MahleamSearchMatch {
	readonly matchType?: string;
	readonly match?: string;
	readonly mfrName?: string;
}
