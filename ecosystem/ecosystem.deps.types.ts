// --------------------------------------------------------------------------
// Ponder return types

// --------------------------------------------------------------------------
// Service

// --------------------------------------------------------------------------
// Api
export type ApiEcosystemDepsInfo = {
	earnings: {
		profit: number;
		loss: number;
		unrealizedProfit: number;
		directTransfers: number;
	};
	values: {
		price: number;
		totalSupply: number;
		depsMarketCapInChf: number;
	};
	reserve: {
		balance: number;
		equity: number;
		minter: number;
	};
};
