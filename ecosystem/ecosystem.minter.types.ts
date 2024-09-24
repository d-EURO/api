import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types
export type MinterQuery = {
	id: Address;
	txHash: string;
	minter: Address;
	applicationPeriod: number;
	applicationFee: number;
	applyMessage: string;
	applyDate: number;
	suggestor: Address;
	denyMessage: string | null;
	denyDate: number | null;
	denyTxHash: string | null;
	vetor: Address | null;
};

// --------------------------------------------------------------------------
// Service
export type MinterQueryObjectArray = {
	[key: Address]: MinterQuery;
};

// --------------------------------------------------------------------------
// Api
export type ApiMinterListing = {
	num: number;
	list: MinterQuery[];
};

export type ApiMinterMapping = {
	num: number;
	addresses: Address[];
	map: MinterQueryObjectArray;
};
