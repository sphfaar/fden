interface GetProductsConfig {
	showPerfReqProxyToSource?: boolean;
	showPerfReqClientToProxy?: boolean;
}
export type GetProducts = (
	code: string,
	config?: GetProductsConfig,
	page?: number,
	sessionToken?: string
) => Promise<ProductsData>;

export type GetNextProducts = (
	code: string,
	config?: GetProductsConfig,
	page: number,
	sessionToken?: string
) => Promise<ProductsData> | null;
