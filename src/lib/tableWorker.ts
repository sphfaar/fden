// self.onmessage = async function (e: MessageEvent<ProductsFromSource[]>) {
// 	const prodsFromSrcs: ProductsFromSource[] = e.data;
//
// 	const productsOfTable: ProductOfTable[] = prodsFromSrcs.flatMap((prodsfromSrc) => {
// 		return prodsfromSrc.productsData.products.map((product) => {
// 			return {
// 				source: {
// 					name: prodsfromSrc.source.name,
// 					image: prodsfromSrc.source.logo ?? prodsfromSrc.source.banner
// 				},
// 				manufacturerCode: product.manufacturer_code,
// 				crossCode: product.source_reference_code,
// 				manufacturerName: product.manufacturer,
// 				detailsUrl: product.detailsUrl,
// 				thumbnails: product.thumbnails
// 			};
// 		});
// 	});
//
// 	postMessage(productsOfTable);
// };
