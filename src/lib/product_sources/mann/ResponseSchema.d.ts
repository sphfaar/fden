export default interface MannSchema {
	readonly data: Data;
}

interface Data {
	readonly catalogSearch: CatalogSearch;
}

interface CatalogSearch {
	readonly applications: Application[];
	readonly crossReference: CrossReference;
	readonly products: Products;
	readonly __typename: string;
}

interface Application {
	readonly applicationSegment: string;
	readonly totalCount: number;
	readonly brands: Brand[];
	readonly vehicleCategories: VehicleCategory[];
	readonly __typename: string;
}

interface Brand {
	readonly brandName: string;
	readonly vehicleBrandId: string;
	readonly modelSeries: ModelSery[];
	readonly __typename: BrandTypename;
}

enum BrandTypename {
	SmartSearchBrand = 'SmartSearchBrand'
}

interface ModelSery {
	readonly modelSeriesId: string;
	readonly modelSeriesName: string;
	readonly modelSeriesDate: string;
	readonly modelTypes: ModelType[];
	readonly __typename: ModelSeryTypename;
}

enum ModelSeryTypename {
	SmartSearchModelSeries = 'SmartSearchModelSeries'
}

interface ModelType {
	readonly bhp: string;
	readonly ccm: string;
	readonly engineCode: string;
	readonly fuelType: FuelType;
	readonly kw: string;
	readonly modelTypeId: string;
	readonly vehicleManufacturedFrom: Date;
	readonly vehicleManufacturedTo: Date;
	readonly vehicleName: string;
	readonly modelCode: string;
	readonly serialNumberRange: string;
	readonly __typename: ModelTypeTypename;
}

enum ModelTypeTypename {
	SmartSearchVehicleModel = 'SmartSearchVehicleModel'
}

enum FuelType {
	Empty = '',
	The04 = '04',
	The08 = '08'
}

interface VehicleCategory {
	readonly vehicleBrandCategory: string;
	readonly brands: Brand[];
	readonly __typename: string;
}

interface CrossReference {
	readonly items: CrossReferenceItem[];
	readonly pageInfo: PageInfo;
	readonly totalCount: number;
	readonly __typename: string;
}

interface CrossReferenceItem {
	readonly product: PurpleProduct | null;
	readonly externalNumber: string | null;
	readonly intProductIdentifier: string;
	readonly externalProductName: string | null;
	readonly manufacturer: string;
	readonly filterBy: string | null;
	readonly textLinkages?: Linkage[];
	readonly __typename: PurpleTypename;
}

interface Linkage {
	readonly module_name?: string | null;
	readonly module_unit?: string | null;
	readonly module_value?: string | null;
	readonly __typename?: string;
}

enum PurpleTypename {
	SearchEXTProductItem = 'SearchExtProductItem'
}

interface PurpleProduct {
	readonly name: string;
	readonly sku: string;
	readonly urlKey: string;
	readonly attributes: Attribute[];
	readonly customTables: CustomTable[];
	readonly __typename: ProductTypename;
}

enum ProductTypename {
	SimpleProduct = 'SimpleProduct'
}

interface Attribute {
	readonly adminValue: null | string;
	readonly key: string;
	readonly value: null | string;
	readonly label?: string;
	readonly __typename: AttributeTypename;
	readonly unit?: AttributeUnit;
}

enum AttributeTypename {
	VisibleAttributes = 'VisibleAttributes'
}

enum AttributeUnit {
	Bar = 'bar',
	Empty = '',
	None = 'none',
	Piece = 'piece'
}

interface CustomTable {
	readonly code: Code;
	readonly unit: CustomTableUnit;
	readonly values: Attribute[];
	readonly __typename: CustomTableTypename;
}

enum CustomTableTypename {
	CustomTableAttributes = 'CustomTableAttributes'
}

enum Code {
	DimensionTable = 'dimension_table',
	Status = 'status'
}

enum CustomTableUnit {
	DontUseMe = 'dont use me'
}

interface PageInfo {
	readonly currentPage: number;
	readonly pageSize: number;
	readonly totalPages: number;
	readonly __typename: string;
}

interface Products {
	readonly items: ProductsItem[];
	readonly pageInfo: PageInfo;
	readonly totalCount: number;
	readonly __typename: string;
}

interface ProductsItem {
	readonly product: FluffyProduct;
	readonly __typename: FluffyTypename;
}

enum FluffyTypename {
	SearchProductItem = 'SearchProductItem'
}

interface FluffyProduct {
	readonly sku: string;
	readonly urlKey: string;
	readonly name: string;
	readonly attributes: Attribute[];
	readonly references: Reference[];
	readonly __typename: ProductTypename;
}

interface Reference {
	readonly referenceTypeId: string;
	readonly referenceTypeName: string;
	readonly referenceTypeDescription: string;
	readonly referenceProducts: ReferenceProduct[];
	readonly __typename: string;
}

interface ReferenceProduct {
	readonly salesDesignation: string;
	readonly urlKey: string;
	readonly __typename: string;
}
