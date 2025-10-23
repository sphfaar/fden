export default interface MahleamSchema {
	readonly totalMatchingArticles: number;
	readonly maxAllowedPage: number;
	readonly articles: Article[];
	readonly dataSupplierFacets: DataSupplierFacets;
	readonly genericArticleFacets: GenericArticleFacets;
	readonly status: number;
}

interface Article {
	readonly dataSupplierId: number;
	readonly articleNumber: string;
	readonly mfrId: number;
	readonly mfrName: ArticleMfrName;
	readonly misc: Misc;
	readonly genericArticles: GenericArticle[];
	readonly articleText: string;
	readonly gtins: string[];
	readonly tradeNumbers: string[];
	readonly tradeNumbersDetails: TradeNumbersDetail[];
	readonly oemNumbers: Number[];
	// readonly replacesArticles:         any[];
	// readonly replacedByArticles:       any[];
	readonly articleCriteria: ArticleCriterion[];
	// readonly linkages:                 any[];
	readonly pdfs: PDF[];
	readonly images: Image[];
	readonly comparableNumbers: Number[];
	readonly searchQueryMatches: SearchQueryMatch[];
	// readonly links:                    any[];
	readonly totalLinkages: number;
	readonly articleLogisticsCriteria: ArticleCriterion[];
}

interface ArticleCriterion {
	readonly criteriaId: number;
	readonly criteriaDescription: string;
	readonly criteriaAbbrDescription?: string;
	readonly criteriaUnitDescription?: CriteriaUnitDescription;
	readonly criteriaType: Type;
	readonly rawValue: string;
	readonly formattedValue: string;
	readonly immediateDisplay: boolean;
	readonly isMandatory: boolean;
	readonly isInterval: boolean;
	readonly keyTableType?: Type;
	readonly keyTableNum?: number;
}

enum Type {
	A = 'A',
	K = 'K',
	N = 'N'
}

enum CriteriaUnitDescription {
	CM = 'cm',
	G = 'g',
	Mm = 'mm',
	Nm = 'Nm'
}

interface Number {
	readonly articleNumber: string;
	readonly dataSupplierId?: number;
	readonly mfrId: number;
	readonly mfrName: string;
	readonly matchesSearchQuery: boolean;
}

interface GenericArticle {
	readonly genericArticleId: number;
	readonly genericArticleDescription: string;
	readonly assemblyGroupNodeId: number;
	readonly assemblyGroupName: AssemblyGroupName;
	readonly legacyArticleId: number;
	readonly linkageTargetTypes: LinkageTargetType[];
}

enum AssemblyGroupName {
	AirSupply = 'Air Supply',
	Crankcase = 'Crankcase',
	CrankshaftDrive = 'Crankshaft Drive',
	FuelSupplySystem = 'Fuel Supply System'
}

enum LinkageTargetType {
	M = 'M',
	O = 'O',
	V = 'V'
}

interface Image {
	readonly imageURL50: string;
	readonly imageURL100: string;
	readonly imageURL200: string;
	readonly imageURL400: string;
	readonly imageURL800: string;
	readonly imageURL1600: string;
	readonly imageURL3200: string;
	readonly fileName: string;
	readonly typeDescription: TypeDescription;
	readonly typeKey: number;
	readonly headerDescription: ImageHeaderDescription;
	readonly headerKey: number;
	readonly sortNumber: number;
	readonly assetSource: AssetSource;
}

enum AssetSource {
	Article = 'article'
}

enum ImageHeaderDescription {
	Picture = 'Picture',
	TechnicalDrawing = 'Technical Drawing'
}

enum TypeDescription {
	ArticlePicture = 'Article Picture'
}

enum ArticleMfrName {
	Clevite = 'CLEVITE',
	Izumi = 'IZUMI',
	Knecht = 'KNECHT'
}

interface Misc {
	readonly articleStatusId: number;
	readonly articleStatusDescription: ArticleStatusDescription;
	readonly articleStatusValidFromDate: number;
	readonly quantityPerPackage: number;
	readonly quantityPerPartPerPackage: number;
	readonly isSelfServicePacking: boolean;
	readonly hasMandatoryMaterialCertification: boolean;
	readonly isRemanufacturedPart: boolean;
	readonly isAccessory: boolean;
	readonly batchSize1?: number;
	readonly batchSize2?: number;
}

enum ArticleStatusDescription {
	ArticleToBeDiscontinued = 'Article to be discontinued',
	InPreparation = 'In preparation',
	NoLongerDeliverableByTheManufacturer = 'no longer deliverable by the manufacturer',
	Normal = 'Normal',
	OnDemand = 'on demand',
	OnlyDeliverableAccordingToPartsList = 'Only deliverable according to parts list'
}

interface PDF {
	readonly url: string;
	readonly fileName: FileName;
	readonly typeDescription: TypeDescription;
	readonly headerDescription: PDFHeaderDescription;
	readonly sortNumber: number;
	readonly assetSource: AssetSource;
}

enum FileName {
	The233199966PDF = '233199966.PDF',
	The479702651PDF = '479702651.PDF',
	The479706273PDF = '479706273.PDF',
	The479711048PDF = '479711048.PDF',
	The479711456PDF = '479711456.PDF',
	The480532998PDF = '480532998.PDF',
	The480533069PDF = '480533069.PDF',
	The527478218PDF = '527478218.PDF',
	The546053932PDF = '546053932.PDF',
	The634880934PDF = '634880934.PDF',
	The634880944PDF = '634880944.PDF',
	The635439540PDF = '635439540.PDF'
}

enum PDFHeaderDescription {
	InstallationManual = 'Installation Manual',
	ServiceInformation = 'Service Information'
}

interface SearchQueryMatch {
	readonly matchType: MatchType;
	readonly description: Description;
	readonly match: string;
	readonly mfrId?: number;
	readonly mfrName?: SearchQueryMatchMfrName;
}

enum Description {
	AccessoryListArticleNumber = 'Accessory List Article Number',
	AccessoryListParentArticleNumber = 'Accessory List Parent Article Number',
	ArticleNumber = 'Article Number',
	ComparableNumber = 'Comparable number',
	OENumber = 'OE Number',
	PartsListArticleNumber = 'Parts List Article Number',
	PartsListParentArticleNumber = 'Parts List Parent Article Number'
}

enum MatchType {
	AccessoryListArticleNumber = 'AccessoryListArticleNumber',
	AccessoryListParentArticleNumber = 'AccessoryListParentArticleNumber',
	ArticleNumber = 'ArticleNumber',
	ComparableNumber = 'ComparableNumber',
	OENumber = 'OENumber',
	PartsListArticleNumber = 'PartsListArticleNumber',
	PartsListParentArticleNumber = 'PartsListParentArticleNumber'
}

enum SearchQueryMatchMfrName {
	Ashika = 'ASHIKA',
	Isuzu = 'ISUZU',
	Mitsubishi = 'MITSUBISHI'
}

interface TradeNumbersDetail {
	readonly tradeNumber: string;
	readonly isImmediateDisplay: boolean;
}

interface DataSupplierFacets {
	readonly total: number;
	readonly counts: DataSupplierFacetsCount[];
}

interface DataSupplierFacetsCount {
	readonly dataSupplierId: number;
	readonly mfrId: number;
	readonly mfrName: string;
	readonly count: number;
}

interface GenericArticleFacets {
	readonly total: number;
	readonly counts: GenericArticleFacetsCount[];
}

interface GenericArticleFacetsCount {
	readonly genericArticleId: number;
	readonly genericArticleDescription: string;
	readonly count: number;
}
