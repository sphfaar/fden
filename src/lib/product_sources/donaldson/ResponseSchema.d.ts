export default interface DonaldsonSchema {
	readonly 'endeca:contentPath': ContentPath;
	readonly ruleLimit: string;
	readonly 'endeca:assemblerRequestInformation': EndecaAssemblerRequestInformation;
	readonly '@type': string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly 'endeca:siteRootPath': SiteRootPath;
	readonly 'endeca:siteState': SiteState;
	readonly 'atg:currentSiteProductionURL': string;
	readonly contentPaths: string[];
	readonly templateTypes: string[];
	readonly contents: DonaldsonSchemaContent[];
	readonly name: string;
}

interface DonaldsonSchemaContent {
	readonly MainContent: MainContent[];
	readonly HeaderContent: HeaderContent[];
	readonly SecondaryContent: SecondaryContent[];
	readonly '@type': string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly name: string;
}

interface HeaderContent {
	readonly metaKeywords: string;
	readonly pageTitle: string;
	readonly '@type': string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly name: string;
	readonly metaDescription: string;
}

interface EndecaAuditInfo {
	readonly 'ecr:resourcePath': string;
	readonly 'ecr:innerPath': null | string;
}

interface MainContent {
	readonly lastRecNum?: number;
	readonly partsPagingAction?: AppPagingAction;
	readonly partsCount?: number;
	readonly '@type': string;
	readonly applicationsCount?: number;
	readonly recsPerPage?: number;
	readonly applicationPerPage?: number;
	readonly competitorPartsCount?: number;
	readonly partNumberSearch?: boolean;
	readonly partsStartRec?: number;
	readonly sortOptionMap?: SortOptionMap;
	readonly appPagingAction?: AppPagingAction;
	readonly customerPartsStartRec?: number;
	readonly competitorPartsPagingAction?: AppPagingAction;
	readonly currentRegion?: string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly endecaCompetitorPartsCount?: number;
	readonly competitorPartsStartRec?: number;
	readonly pagingActionTemplate?: AppPagingAction;
	readonly competitorPartsPerPage?: number;
	readonly totalNumRecs?: number;
	readonly sortOptions?: AppPagingAction[];
	readonly customerPartsPerPage?: number;
	readonly applicationStartRec?: number;
	readonly name: string;
	readonly competitorProductDetailDTOList?: CompetitorProductDetailDTOList[];
	readonly firstRecNum?: number;
	readonly partsPerPage?: number;
	readonly customerPartsPagingAction?: AppPagingAction;
	readonly partsNavigation?: PartsNavigation[];
	readonly pageType?: string;
	readonly subCategory2?: string;
	readonly browseProductCategory?: string;
	readonly subCategory1?: string;
	readonly primaryCategory?: string;
	readonly ruleLimit?: number;
	readonly templateTypes?: string[];
	readonly contents?: MainContentContent[];
	readonly contentPaths?: string[];
}

interface AppPagingAction {
	readonly '@class': AppPagingActionClass;
	readonly navigationState: string;
	readonly siteRootPath: SiteRootPath;
	readonly siteState: SiteState;
	readonly link: string;
	readonly label: null | string;
	readonly contentPath: ContentPath;
	readonly selected?: boolean;
}

enum AppPagingActionClass {
	COMEndecaInfrontCartridgeModelNavigationAction = 'com.endeca.infront.cartridge.model.NavigationAction',
	COMEndecaInfrontCartridgeModelSortOptionLabel = 'com.endeca.infront.cartridge.model.SortOptionLabel'
}

enum ContentPath {
	Search = '/search'
}

enum SiteRootPath {
	Pages = '/pages'
}

interface SiteState {
	readonly '@class': EndecaSiteStateClass;
	readonly contentPath: ContentPath;
	readonly matchedUrlPattern: null;
	readonly properties: EndecaSiteStateProperties;
	readonly siteDefinition: SiteDefinition;
	readonly siteDisplayName: DisplayName;
	readonly siteId: SiteID;
	readonly validSite: boolean;
}

enum EndecaSiteStateClass {
	COMEndecaInfrontSiteModelSiteState = 'com.endeca.infront.site.model.SiteState'
}

interface SiteDefinition {
	readonly '@class': SiteDefinitionClass;
	readonly displayName: DisplayName;
	readonly filterStateConfiguration: null;
	readonly id: SiteID;
	readonly urlPattern: null;
}

enum SiteDefinitionClass {
	COMEndecaInfrontSiteModelSiteDefinition = 'com.endeca.infront.site.model.SiteDefinition'
}

enum DisplayName {
	Dci = 'DCI'
}

enum SiteID {
	Dci = '/DCI'
}

interface CompetitorProductDetailDTOList {
	readonly addToCart: boolean;
	readonly cancelledDpn: null;
	readonly cancelledDpnList: null;
	readonly cancelledProductId: null;
	readonly '@class': CompetitorProductDetailDTOListClass;
	readonly competitorProductNotes: null;
	readonly customerMfgName: null;
	readonly customerNumber: null;
	readonly description: string;
	readonly donaldsonPartNumber: string;
	readonly enablePalletForRegion: boolean;
	readonly equipmentCatalogNotes: null;
	readonly equippedQuantity: number;
	readonly globalSearch: boolean;
	readonly manufactureName: string;
	readonly manufacturerPartNumber: string;
	readonly multipack: boolean;
	readonly multipackList: null;
	readonly partSearchMatched: boolean;
	readonly pdpURL: string;
	readonly priceInventoryStatus: boolean;
	readonly productId: string;
	readonly productLine: ProductLine;
	readonly region: null;
	readonly replacementNote: null;
	readonly resultAvailable: boolean;
	readonly resultNotFoundMessage: null;
	readonly searchTerm: null;
	readonly skuCPNMap: null;
	readonly skuCatalogPartNumber: string;
	readonly skuDPNMap: null;
	readonly skuId: string;
	readonly skuMultipackMap: null;
	readonly skuStatusNotes: null;
	readonly status: null;
	readonly thumbnailImage: string;
	readonly upcCode: null;
	readonly vinEquippedQuantity: number;
}

enum CompetitorProductDetailDTOListClass {
	COMDonaldsonCommerceEndecaAssemblerDTOProductDetailDTO = 'com.donaldson.commerce.endeca.assembler.DTO.ProductDetailDTO'
}

enum ProductLine {
	EngineHydraulic = 'Engine & Hydraulic'
}

interface MainContentContent {
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly name: string;
	readonly NavigationLink: NavigationLink[];
	readonly '@type': string;
}

interface NavigationLink {
	readonly categoryLearnMorePage: string;
	readonly mobileCategoryImageURL: string;
	readonly dimvalId: string;
	readonly '@type': string;
	readonly displayName: string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly productLineLabel: string;
	readonly categoryLearnMoreKey: string;
	readonly categoryName: string;
	readonly categoryDescriptionKey: string;
	readonly categoryDescriptionPage: string;
	readonly name: string;
	readonly productLineName: string;
	readonly categoryImageURL: string;
	readonly categoryLearnMoreCTA: string;
	readonly categoryId: string;
}

interface PartsNavigation {
	readonly nonAvailableProductlines: string;
	readonly '@type': Type;
	readonly displayName: string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly name: string;
	readonly dimensionName: string;
	readonly whyPrecedenceRuleFired: null;
	readonly displayNamePropertyAlias: DisplayNamePropertyAlias;
	readonly multiSelect: boolean;
	readonly refinements: Refinement[];
	readonly refinementTranslated?: boolean;
}

enum Type {
	RefinementMenu = 'RefinementMenu'
}

enum DisplayNamePropertyAlias {
	DisplayName = 'displayName'
}

interface Refinement {
	readonly '@class': RefinementClass;
	readonly navigationState: string;
	readonly siteRootPath: SiteRootPath;
	readonly siteState: SiteState;
	readonly count: number;
	readonly link: string;
	readonly label: string;
	readonly contentPath: ContentPath;
	readonly properties: RefinementProperties;
	readonly multiSelect: boolean;
}

enum RefinementClass {
	COMEndecaInfrontCartridgeModelRefinement = 'com.endeca.infront.cartridge.model.Refinement'
}

interface RefinementProperties {
	readonly 'category.rootCatalogId'?: string;
	readonly 'category.siteId'?: string;
	readonly 'dimval.prop.displayName_ja'?: string;
	readonly 'dimval.prop.displayName_it'?: string;
	readonly 'dimval.prop.displayName_fr'?: string;
	readonly 'dimval.prop.displayName_zh'?: string;
	readonly displayName_es?: string;
	readonly 'record.id'?: string;
	readonly 'category.repositoryId'?: string;
	readonly 'category.catalogs.repositoryId'?: string;
	readonly 'dimval.prop.displayName_ru'?: string;
	readonly 'dimval.prop.displayName_ko'?: string;
	readonly 'dimval.prop.displayName_pt'?: string;
	readonly displayName_en?: string;
	readonly 'DGraph.Spec': string;
	readonly 'dimval.prop.displayName_in'?: string;
	readonly 'category.ancestorCatalogIds'?: string;
	readonly 'dimval.prop.displayName_pl'?: string;
	readonly displayName_de?: string;
	readonly 'dimval.prop.displayName_tr'?: string;
}

interface SortOptionMap {
	readonly 'application.equipmentMake_dsc': string;
	readonly 'application.equipmentMake_asc': string;
	readonly 'application.equipmentType_asc': string;
	readonly 'application.equipmentType_dsc': string;
	readonly 'application.equipmentModel_asc': string;
	readonly 'application.engineName_dsc': string;
	readonly 'application.engineModel_dsc': string;
	readonly product_description_asc: string;
	readonly 'competitorCrossRef.competitorPartNumber_asc': string;
	readonly 'competitorCrossRef.competitorPartNumber_dsc': string;
	readonly 'application.equipmentModel_dsc': string;
	readonly sku_catalogpart_asc: string;
	readonly 'application.engineName_asc': string;
	readonly 'application.enginemodel_asc': string;
}

interface SecondaryContent {
	readonly searchCrumbs: SearchCrumb[];
	readonly geoFilterCrumb: null;
	readonly '@type': string;
	readonly 'endeca:auditInfo': EndecaAuditInfo;
	readonly name: string;
	readonly removeAllAction: AppPagingAction;
	readonly displayNamePropertyAlias: DisplayNamePropertyAlias;
}

interface SearchCrumb {
	readonly removeAction: AppPagingAction;
	readonly '@class': string;
	readonly correctedTerms: null;
	readonly terms: string;
	readonly key: string;
	readonly matchMode: string;
}

interface EndecaAssemblerRequestInformation {
	readonly 'endeca:contentPath': ContentPath;
	readonly 'endeca:searchTermsStemmed': string[];
	readonly records: Record[];
	readonly '@type': string;
	readonly 'endeca:searchKey': string;
	readonly 'endeca:eqlExpression': string;
	readonly 'endeca:recordsPerPage': number;
	readonly 'endeca:eneTime': number;
	readonly 'endeca:skuIds': string[];
	readonly 'endeca:relRankStrategy': string;
	readonly 'endeca:requestId': string;
	readonly 'endeca:activePage': number;
	readonly 'endeca:searchTermsOriginal': string[];
	readonly 'endeca:numRecords': number;
	readonly 'endeca:siteRootPath': SiteRootPath;
	readonly 'endeca:recordOffset': number;
	readonly 'endeca:languageId': string;
	readonly 'endeca:assemblyStartTimestamp': number;
	readonly 'endeca:assemblyFinishTimestamp': number;
	readonly 'endeca:searchTermsExpanded': string[];
	readonly 'endeca:resourcePath': string;
	readonly 'endeca:stemType': string;
	readonly 'endeca:searchTerms': string;
	readonly 'endeca:requestType': string;
	readonly 'endeca:sessionId': string;
}

interface Record {
	readonly 'record.id': string;
}
