import type { ActionFailure } from '@sveltejs/kit';
import type { GetNextProducts, GetProducts } from './types';
import { descriptors as filtrecDescriptors, getters as filtrecGetters } from './filtrec';
import { descriptors as ufihydDescriptors, getters as ufihydGetters } from './ufihyd';
import { descriptors as ufiamDescriptors, getters as ufiamGetters } from './ufiam';
import { descriptors as hifiDescriptors, getters as hifiGetters } from './hifi';
import { descriptors as faifiltriDescriptors, getters as faifiltriGetters } from './faifiltri';
import { descriptors as wixDescriptors, getters as wixGetters } from './wix';
import { descriptors as wixeuDescriptors, getters as wixeuGetters } from './wixeu';
import { descriptors as parkerDescriptors, getters as parkerGetters } from './parker';
import { descriptors as hydacDescriptors, getters as hydacGetters } from './hydac';
import { descriptors as fleetguardDescriptors, getters as fleetguardGetters } from './fleetguard';
import { descriptors as donaldsonDescriptors, getters as donaldsonGetters } from './donaldson';
import { descriptors as mannDescriptors, getters as mannGetters } from './mann';
import { descriptors as sfDescriptors, getters as sfGetters } from './sf';
import { descriptors as baldwinDescriptors, getters as baldwinGetters } from './baldwin';
import { descriptors as ikronDescriptors, getters as ikronGetters } from './ikron';
import { descriptors as stauffDescriptors, getters as stauffGetters } from './stauff';
import { descriptors as hengstDescriptors, getters as hengstGetters } from './hengst';
import {
	descriptors as mpfiltriusaDescriptors,
	getters as mpfiltriusaGetters
} from './mpfiltriusa';
import {
	descriptors as filtrationgroupDescriptors,
	getters as filtrationgroupGetters
} from './filtrationgroup';
import { descriptors as mahleamDescriptors, getters as mahleamGetters } from './mahleam';
import { descriptors as fbnDescriptors, getters as fbnGetters } from './fbn';
import { descriptors as argohytosDescriptors, getters as argohytosGetters } from './argohytos';
type Getter = {
	getProducts: GetProducts;
	getNextProducts: GetNextProducts;
	getSession?: (
		user: string,
		password: string
	) => Promise<string | null | ActionFailure<{ authError: boolean }>>;
};

export const sourcesDescriptors: SourceDescriptors[] = [
	filtrecDescriptors,
	ufihydDescriptors,
	ufiamDescriptors,
	hifiDescriptors,
	faifiltriDescriptors,
	wixDescriptors,
	wixeuDescriptors,
	parkerDescriptors,
	hydacDescriptors,
	fleetguardDescriptors,
	donaldsonDescriptors,
	mannDescriptors,
	sfDescriptors,
	baldwinDescriptors,
	ikronDescriptors,
	stauffDescriptors,
	mpfiltriusaDescriptors,
	filtrationgroupDescriptors,
	mahleamDescriptors,
	hengstDescriptors,
	fbnDescriptors,
	argohytosDescriptors
];

export const sourcesGetters: Record<string, Getter> = {
	filtrec: filtrecGetters,
	ufihyd: ufihydGetters,
	ufiam: ufiamGetters,
	hifi: hifiGetters,
	faifiltri: faifiltriGetters,
	wix: wixGetters,
	wixeu: wixeuGetters,
	parker: parkerGetters,
	hydac: hydacGetters,
	fleetguard: fleetguardGetters,
	donaldson: donaldsonGetters,
	mann: mannGetters,
	sf: sfGetters,
	baldwin: baldwinGetters,
	ikron: ikronGetters,
	stauff: stauffGetters,
	mpfiltriusa: mpfiltriusaGetters,
	filtrationgroup: filtrationgroupGetters,
	mahleam: mahleamGetters,
	hengst: hengstGetters,
	fbn: fbnGetters,
	argohytos: argohytosGetters
};
