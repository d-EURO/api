import { Address } from 'viem';

export type TradeQuery = {
	txHash: string;
	trader: Address;
	amount: string;
	shares: string;
	frontendCode: string;
};
