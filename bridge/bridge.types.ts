import { Address } from 'viem';

export type StablecoinBridgeQuery = {
	txHash: string;
	swapper: Address;
	amount: string;
	isMint: boolean;
};
