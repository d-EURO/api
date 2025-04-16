import { Hex, hexToString } from 'viem';

export function createRefCode(frontendCode: string): string | undefined {
	if (frontendCode?.startsWith('0x00')) {
		return hexToString(frontendCode as Hex).replace(/\0/g, '');
	}
}
