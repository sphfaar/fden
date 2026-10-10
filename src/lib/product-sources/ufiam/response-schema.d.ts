export default interface UfiSchema {
	readonly actions?: UfiAction[];
}

export interface UfiAction {
	readonly state?: string;
	readonly returnValue?: {
		readonly returnValue?: UfiCrossReturn;
	};
}

export interface UfiCrossReturn {
	readonly hits?: UfiCrossHit[];
	readonly total?: UfiTotal;
}

export interface UfiCrossHit {
	readonly _source?: UfiCrossSource;
}

export interface UfiCrossSource {
	readonly manufacturer?: string;
	readonly description?: string;
	readonly cross_code?: string;
	readonly application_code?: string;
	readonly application?: UfiLocalized;
	readonly filter?: string;
}

export interface UfiLocalized {
	readonly en_EN?: string;
	readonly it_IT?: string;
}

export interface UfiTotal {
	readonly relation?: string;
	readonly value?: number;
}

export interface UfiDetailAura {
	readonly actions?: UfiDetailAction[];
}

export interface UfiDetailAction {
	readonly state?: string;
	readonly returnValue?: {
		readonly returnValue?: UfiDetailReturn;
	};
}

export interface UfiDetailReturn {
	readonly id?: string;
	readonly elasticsearchResult?: {
		readonly hits?: UfiDetailHit[];
	};
}

export interface UfiDetailHit {
	readonly _source?: UfiProductSource;
}

export interface UfiProductSource {
	readonly code?: string;
	readonly family_name?: UfiLocalized;
	readonly public_note?: string;
	readonly sizes?: Record<string, UfiSize>;
	readonly box?: UfiBox;
	readonly images?: UfiImages;
}

export interface UfiSize {
	readonly value?: number | string;
	readonly description?: UfiLocalized;
	readonly um?: string;
}

export interface UfiBox {
	readonly w?: number | string;
	readonly l?: number | string;
	readonly h?: number | string;
}

export interface UfiImageFile {
	readonly path?: string;
	readonly thumb?: string;
}

export interface UfiImages {
	readonly image?: UfiImageFile;
	readonly image_dim?: UfiImageFile;
}
