import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types
export type FrontendCodeRegisteredQuery = {
	txHash: string;
	owner: Address;
	frontendCode: string;
};

export type FrontendCodeSavingsQuery = {
	txHash: string;
	account: Address;
	amount: string;
	rate: number;
	frontendCode: string;
};
