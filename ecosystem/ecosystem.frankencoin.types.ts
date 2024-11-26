import { PriceQueryCurrencies } from '../prices/prices.types';
import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types
export type EcosystemQueryItem = {
	id: string;
	value: string;
	amount: bigint;
};

export type EcosystemMintQueryItem = {
	id: string;
	to: string;
	value: bigint;
	blockheight: bigint;
	timestamp: bigint;
};

export type EcosystemBurnQueryItem = {
	id: string;
	from: string;
	value: bigint;
	blockheight: bigint;
	timestamp: bigint;
};

export type MintBurnAddressMapperQueryItem = {
	id: Address;
	mint: number;
	burn: number;
};

// --------------------------------------------------------------------------
// Service
export type ServiceEcosystemFrankencoinKeyValues = {
	[key: string]: EcosystemQueryItem;
};

export type ServiceEcosystemFrankencoin = {
	raw: {
		mint: string;
		burn: string;
	};
	total: {
		mint: number;
		burn: number;
		supply: number;
	};
	counter: {
		mint: number;
		burn: number;
	};
};

export type ServiceEcosystemMintBurnMapping = {
	[key: Address]: { mint: number; burn: number };
};

// --------------------------------------------------------------------------
// Api
export type ApiEcosystemFrankencoinKeyValues = ServiceEcosystemFrankencoinKeyValues;

export type ApiEcosystemFrankencoinInfo = ServiceEcosystemFrankencoin & {
	erc20: {
		name: string;
		address: Address;
		symbol: string;
		decimals: number;
	};
	chain: {
		name: string;
		id: number;
	};
	price: {
		usd: number;
	};
	fps: {
		price: number;
		totalSupply: number;
		fpsMarketCapInChf: number;
	};
	tvl: PriceQueryCurrencies;
};

export type ApiEcosystemMintBurnMapping = {
	num: number;
	addresses: Address[];
	map: {
		[key: Address]: { mint: number; burn: number };
	};
};
