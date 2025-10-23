export default interface SfSchema {
	readonly payload: Payload;
	readonly success: boolean;
	readonly message: null;
	readonly modelErrors: null;
}

interface Payload {
	readonly items: ItemElement[];
	readonly itemsTotal: number;
}

interface ItemElement {
	readonly originalNumber: string;
	readonly id: string;
	readonly sku: string;
	readonly item: ItemItem;
	readonly type: string;
	readonly availability: Availability;
	readonly favorite: boolean;
	readonly pricePcs: number;
	readonly quantity: number;
	readonly note: null;
	readonly label: null;
	readonly disabled: boolean;
	readonly brand: string;
}

interface Availability {
	readonly state: State;
	readonly inStockDate: null;
}

type State = 'comingSoon';

interface ItemItem {
	readonly image: Image;
	readonly link: Link;
	readonly sublabel: string;
}

interface Image {
	readonly id: string;
	readonly alt: string;
	readonly defaultUrl: null | string;
	readonly defaultUrlHiRes: null | string;
}

interface Link {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly target: Target;
	readonly isActive: boolean;
	readonly smartLink: SmartLink;
	readonly localization: null;
}

interface SmartLink {
	readonly itemId: null;
	readonly titleCodename: null;
}

type Target = '_self';
