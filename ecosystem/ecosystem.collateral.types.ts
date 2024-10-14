import { PositionQuery } from './../positions/positions.types';
import { ERC20Info, ERC20InfoObjectArray, PriceQueryCurrencies } from './../prices/prices.types';
import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types

// --------------------------------------------------------------------------
// Service
export type EcosystemCollateralPositionsItem = ERC20Info & {
	num: number; // num of positions per collateral
	addresses: Address[]; // list of position addresses
};

export type EcosystemCollateralPositionsDetailsItem = ERC20Info & {
	num: number; // num of positions per collateral
	addresses: Address[]; // list of position addresses
	positions: PositionQuery[]; // list of position details
};

export type ApiEcosystemCollateralStatsItem = ERC20Info & {
	positions: {
		total: number;
		open: number;
		requested: number;
		closed: number;
		denied: number;
		originals: number;
		clones: number;
	};
	totalBalanceRaw: string;
	totalValueLocked: PriceQueryCurrencies;
	price: PriceQueryCurrencies;
};

// --------------------------------------------------------------------------
// Api
export type ApiEcosystemCollateralListArray = {
	num: number;
	list: ERC20Info[];
};

export type ApiEcosystemCollateralList = {
	num: number;
	addresses: Address[];
	map: ERC20InfoObjectArray;
};

export type ApiEcosystemCollateralPositions = {
	[key: Address]: EcosystemCollateralPositionsItem;
};

export type ApiEcosystemCollateralPositionsDetails = {
	[key: Address]: EcosystemCollateralPositionsDetailsItem;
};

export type ApiEcosystemCollateralStats = {
	num: number; // num of collateral contracts
	addresses: Address[]; // of collateral contracts, keys of map
	totalValueLocked: PriceQueryCurrencies;
	map: { [key: Address]: ApiEcosystemCollateralStatsItem };
};
