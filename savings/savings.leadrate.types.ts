import { Address } from 'viem';
// --------------------------------------------------------------------------
// Ponder return types
export type LeadrateRateQuery = {
	id: string;
	created: number;
	blockheight: number;
	txHash: string;
	approvedRate: number;
};

export type LeadrateProposed = {
	id: string;
	created: number;
	blockheight: number;
	txHash: string;
	proposer: Address;
	nextRate: number;
	nextChange: number;
};

// --------------------------------------------------------------------------
// Service
export type LeadrateRateObjectArray = {
	[key: number]: LeadrateRateQuery;
};

export type LeadrateRateProposedObjectArray = {
	[key: string]: LeadrateProposed;
};

// --------------------------------------------------------------------------
// Api
export type ApiLeadrateInfo = {
	rate: number;
	nextRate: number;
	nextchange: number;
	isProposal: boolean;
	isPending: boolean;
};

export type ApiLeadrateRate = {
	created: number;
	blockheight: number;
	rate: number;
	num: number;
	list: LeadrateRateQuery[];
};

export type ApiLeadrateProposed = {
	created: number;
	blockheight: number;
	nextRate: number;
	nextchange: number;
	num: number;
	list: LeadrateProposed[];
};
