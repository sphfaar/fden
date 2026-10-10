export default interface IkronSchema {
	readonly options?: Options;
	readonly value: Value;
}

interface Options {
	readonly classes?: string;
}

interface Value {
	readonly codice?: string;
	readonly concorrente?: string;
	readonly ikron?: string;
	readonly link?: string;
	readonly ___id___?: number;
}
