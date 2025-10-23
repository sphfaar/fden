export default interface IkronSchema {
	readonly options: Options;
	readonly value: Value;
}

interface Options {
	readonly classes: string;
}

interface Value {
	readonly codice?: string;
	readonly concorrente?: Concorrente;
	readonly ikron?: string;
	readonly link?: string;
	readonly ___id___: number;
}

enum Concorrente {
	ArgoHytos = 'ARGO-HYTOS',
	Donaldson = 'DONALDSON',
	Fbo = 'FBO',
	MpFiltri = 'MP FILTRI',
	Omt = 'OMT',
	Parker = 'PARKER',
	Sofima = 'SOFIMA',
	Ufi = 'UFI'
}
