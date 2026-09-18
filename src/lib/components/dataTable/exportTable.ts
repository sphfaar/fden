import type { BookType } from 'xlsx';

export type ExportBookType =
	| 'xlsx'
	| 'xlsm'
	| 'xlsb'
	| 'biff8'
	| 'biff5'
	| 'biff4'
	| 'biff3'
	| 'biff2'
	| 'ods'
	| 'fods'
	| 'csv'
	| 'txt'
	| 'html';

export interface FormatVersion {
	bookType: ExportBookType;
	label: string;
	extension: string;
}

/** Excel 2007+ formats from https://docs.sheetjs.com/docs/miscellany/formats */
export const XLSX_VERSIONS: FormatVersion[] = [
	{ bookType: 'xlsx', label: 'Excel 2007+ XML (XLSX)', extension: 'xlsx' },
	{ bookType: 'xlsm', label: 'Excel 2007+ Macro XML (XLSM)', extension: 'xlsm' },
	{ bookType: 'xlsb', label: 'Excel 2007+ Binary (XLSB)', extension: 'xlsb' }
];

/** Classic XLS BIFF versions from https://docs.sheetjs.com/docs/miscellany/formats */
export const XLS_VERSIONS: FormatVersion[] = [
	{ bookType: 'biff8', label: 'Excel 97-2004 (BIFF8)', extension: 'xls' },
	{ bookType: 'biff5', label: 'Excel 5.0/95 (BIFF5)', extension: 'xls' },
	{ bookType: 'biff4', label: 'Excel 4.0 (BIFF4)', extension: 'xls' },
	{ bookType: 'biff3', label: 'Excel 3.0 (BIFF3)', extension: 'xls' },
	{ bookType: 'biff2', label: 'Excel 2.0/2.1 (BIFF2)', extension: 'xls' }
];

export const LAST_XLSX_VERSION = XLSX_VERSIONS[0];
export const LAST_XLS_VERSION = XLS_VERSIONS[0];

const ZIP_BOOK_TYPES = new Set<ExportBookType>(['xlsx', 'xlsm', 'xlsb', 'ods']);
const LEGACY_XLS_BOOK_TYPES = new Set<ExportBookType>(['biff2', 'biff3', 'biff4', 'biff5']);

export function toExportRows(products: ProductOfTable[]) {
	return products.map((product) => ({
		Source: product.source.name,
		'Manufacturer Code': product.manufacturerCode,
		'Cross Code': product.crossCode,
		'Manufacturer Name': product.manufacturerName
	}));
}

export function filenameFor(bookType: ExportBookType): string {
	const version = [...XLSX_VERSIONS, ...XLS_VERSIONS].find((entry) => entry.bookType === bookType);
	if (version) {
		if (
			bookType === 'biff5' ||
			bookType === 'biff4' ||
			bookType === 'biff3' ||
			bookType === 'biff2'
		) {
			return `products-${bookType}.${version.extension}`;
		}
		return `products.${version.extension}`;
	}
	return `products.${bookType}`;
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = 'noopener';
	anchor.click();
	URL.revokeObjectURL(url);
}

export function exportProductsJson(products: ProductOfTable[]) {
	const blob = new Blob([JSON.stringify(toExportRows(products), null, 2)], {
		type: 'application/json'
	});
	downloadBlob(blob, 'products.json');
}

export async function exportProductsSheet(products: ProductOfTable[], bookType: ExportBookType) {
	const XLSX = await import('xlsx');
	if (LEGACY_XLS_BOOK_TYPES.has(bookType)) {
		const cpexcel = await import('xlsx/dist/cpexcel.full.mjs');
		XLSX.set_cptable(cpexcel);
	}

	const worksheet = XLSX.utils.json_to_sheet(toExportRows(products));
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
	XLSX.writeFile(workbook, filenameFor(bookType), {
		bookType: bookType as BookType,
		compression: ZIP_BOOK_TYPES.has(bookType)
	});
}
