import { existsSync } from 'fs';
import { Hex, hexToString } from 'viem';

const DEURO_WALLET_FRONTEND_CODE = '0xe8d44050873dba865aa7c170ab4cce64d90839a34dcfd6cf71d14e0205443b1b';

// Returns the input path when the asset is readable on disk, otherwise undefined.
// Missing notification assets must not block posting — callers fall back to text-only.
export function resolveMediaPath(media: string | undefined): string | undefined {
	if (!media) return undefined;
	return existsSync(media) ? media : undefined;
}

export function createRefCode(frontendCode: string): string | undefined {
	if (frontendCode?.startsWith('0x00')) {
		return hexToString(frontendCode as Hex).replace(/[\x00-\x1f,\x7f]/g, '');
	}
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRefCodeLabelLink(frontendCode: string): string {
	if (!frontendCode) return '';

	if (frontendCode.toLowerCase() === DEURO_WALLET_FRONTEND_CODE.toLowerCase()) {
		return `dEURO Wallet`;
	}

	const refCode = createRefCode(frontendCode);
	if (!refCode) return '';

	// Special case for Cake Wallet
	if (refCode === 'Cake Wallet') {
		return `[${refCode}](https://cakewallet.com/)`;
	}

	return `[${refCode}](https://app.deuro.com?ref=${refCode})`;
}
