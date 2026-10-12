import { dev } from '$app/env';
import { env } from 'cloudflare:workers';

/**
How long a passed check lasts. The Turnstile token itself expires after 5 minutes and is single-use.
*/
export const TURNSTILE_PASS_SECONDS = 12 * 60 * 60;

export const TURNSTILE_COOKIE = 'fdenTurnstile';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const PASS_PREFIX = 'v1';

const DUMMY_SITE_KEYS = new Set([
	'1x00000000000000000000AA',
	'1x00000000000000000000BB',
	'2x00000000000000000000AB',
	'2x00000000000000000000BB',
	'3x00000000000000000000FF'
]);

const DUMMY_SECRET_KEYS = new Set([
	'1x0000000000000000000000000000000AA',
	'2x0000000000000000000000000000000AA',
	'3x0000000000000000000000000000000AA'
]);

export interface TurnstileKeys {
	siteKey: string;
	secretKey: string;
}

interface SiteverifyBody {
	success?: unknown;
	hostname?: unknown;
	action?: unknown;
	'error-codes'?: unknown;
}

let hmacKeyCache: { secretKey: string; key: CryptoKey } | undefined;

function binding(name: string): string | undefined {
	try {
		const value = (env as unknown as Record<string, unknown>)[name];
		if (typeof value !== 'string') return undefined;
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	} catch (error) {
		console.error('Turnstile binding is unavailable', error);
		return undefined;
	}
}

function isDummySiteKey(siteKey: string): boolean {
	return DUMMY_SITE_KEYS.has(siteKey);
}

function isDummySecretKey(secretKey: string): boolean {
	return DUMMY_SECRET_KEYS.has(secretKey);
}

/**
Both keys, or undefined when the gate cannot run. Test keys are ignored outside local dev.
*/
export function readTurnstileKeys(): TurnstileKeys | undefined {
	const siteKey = binding('TURNSTILE_SITE_KEY');
	const secretKey = binding('TURNSTILE_SECRET_KEY');
	if (!siteKey || !secretKey) return undefined;
	if (!dev && (isDummySiteKey(siteKey) || isDummySecretKey(secretKey))) {
		console.error('Turnstile test keys are ignored outside local dev.');
		return undefined;
	}
	return { siteKey, secretKey };
}

/**
`vite dev` never challenges. Preview and production still do.
*/
export function isTurnstileDevBypass(): boolean {
	return dev;
}

/**
Same-origin path only. Rejects protocol-relative and off-site targets, and the challenge page itself.
*/
export function safeNextPath(raw: string | undefined): string {
	if (
		raw === undefined ||
		raw.length === 0 ||
		raw.length > 2048 ||
		!raw.startsWith('/') ||
		raw.startsWith('//') ||
		raw.includes('\\') ||
		raw.includes('\0')
	) {
		return '/';
	}

	let parsed: URL;
	try {
		parsed = new URL(raw, 'https://turnstile.invalid');
	} catch {
		return '/';
	}

	return parsed.origin !== 'https://turnstile.invalid' ||
		parsed.username !== '' ||
		parsed.password !== '' ||
		parsed.pathname.includes('\0') ||
		parsed.pathname.includes('\\') ||
		parsed.pathname === '/challenge' ||
		parsed.pathname === '/challenge/'
		? '/'
		: parsed.pathname + parsed.search;
}

function arrayBufferFrom(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCodePoint(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array | undefined {
	if (!/^[\w-]+$/.test(value)) return undefined;
	const remainder = value.length % 4;
	const padding = remainder === 0 ? '' : '='.repeat(4 - remainder);
	try {
		const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + padding);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			const codePoint = binary.codePointAt(index);
			if (codePoint === undefined) return undefined;
			bytes[index] = codePoint;
		}
		return bytes;
	} catch {
		return undefined;
	}
}

async function hmacKey(secretKey: string): Promise<CryptoKey> {
	if (hmacKeyCache?.secretKey === secretKey) return hmacKeyCache.key;
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secretKey),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
	hmacKeyCache = { secretKey, key };
	return key;
}

export async function issueTurnstilePass(secretKey: string): Promise<string | undefined> {
	const expiresAt = Math.floor(Date.now() / 1000) + TURNSTILE_PASS_SECONDS;
	const message = `${PASS_PREFIX}.${expiresAt}`;
	try {
		const signature = await crypto.subtle.sign(
			'HMAC',
			await hmacKey(secretKey),
			new TextEncoder().encode(message)
		);
		return `${message}.${bytesToBase64Url(new Uint8Array(signature))}`;
	} catch (error) {
		console.error('Turnstile pass could not be signed', error);
		return undefined;
	}
}

export async function isTurnstilePassValid(cookie: string | undefined): Promise<boolean> {
	const keys = readTurnstileKeys();
	if (!keys || !cookie) return false;

	const parts = cookie.split('.');
	if (parts.length !== 3 || parts[0] !== PASS_PREFIX) return false;
	const expiresText = parts[1];
	const signatureText = parts[2];
	if (!expiresText || !signatureText || !/^\d{10,12}$/.test(expiresText)) return false;

	const expiresAt = Number(expiresText);
	const now = Math.floor(Date.now() / 1000);
	if (
		!Number.isSafeInteger(expiresAt) ||
		expiresAt <= now ||
		expiresAt > now + TURNSTILE_PASS_SECONDS + 60
	)
		return false;

	const signature = base64UrlToBytes(signatureText);
	if (!signature || signature.byteLength !== 32) return false;

	try {
		return await crypto.subtle.verify(
			'HMAC',
			await hmacKey(keys.secretKey),
			arrayBufferFrom(signature),
			new TextEncoder().encode(`${PASS_PREFIX}.${expiresText}`)
		);
	} catch (error) {
		console.error('Turnstile pass could not be checked', error);
		return false;
	}
}

function visitorAddress(header: string | undefined): string | undefined {
	if (!header || header.length > 64) return undefined;
	return /^[\da-f:.]+$/i.test(header) ? header : undefined;
}

function isSiteverifyBody(value: unknown): value is SiteverifyBody {
	return typeof value === 'object' && value !== null;
}

export async function isTurnstileTokenValid(
	keys: TurnstileKeys,
	token: string,
	requestHostname: string,
	connectingIp: string | undefined
): Promise<boolean> {
	if (token.length === 0 || token.length > 2048) return false;

	const body = new URLSearchParams({ secret: keys.secretKey, response: token });
	const remoteAddress = visitorAddress(connectingIp);
	if (remoteAddress) body.set('remoteip', remoteAddress);

	let payload: SiteverifyBody;
	try {
		const response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
			cache: 'no-store'
		});
		if (!response.ok) {
			console.error('Turnstile siteverify HTTP', response.status);
			return false;
		}
		const parsed: unknown = await response.json();
		if (!isSiteverifyBody(parsed)) return false;
		payload = parsed;
	} catch (error) {
		console.error('Turnstile siteverify request failed', error);
		return false;
	}

	if (payload.success !== true) {
		console.error('Turnstile siteverify rejected', payload['error-codes'] ?? []);
		return false;
	}

	if (isDummySiteKey(keys.siteKey)) return true;

	if (typeof payload.hostname !== 'string') return false;
	if (payload.hostname.toLowerCase() !== requestHostname.toLowerCase()) {
		console.error('Turnstile hostname did not match this site');
		return false;
	}
	if (typeof payload.action === 'string' && payload.action !== 'enter') {
		console.error('Turnstile action did not match');
		return false;
	}
	return true;
}
