// --------------------------------------------------------------------------
// Ponder return types

import { Address } from 'viem';

// --------------------------------------------------------------------------
// Service
export type AnalyticsExposureItem = {
	collateral: {
		address: Address;
		chainId: number;
		name: string;
		symbol: string;
	};
	positions: {
		open: number;
		originals: number;
		clones: number;
	};
	mint: {
		totalMinted: number;
		totalContribution: number;
		totalLimit: number;
		totalMintedRatio: number;
		interestAverage: number;
		totalTheta: number;
		thetaPerFpsToken: number;
	};
	reserveRiskWiped: {
		fpsPrice: number;
		riskRatio: number;
	};
};

// --------------------------------------------------------------------------
// Api
export type ApiAnalyticsCollateralExposure = {
	general: {
		balanceInReserve: number;
		mintersContribution: number;
		equityInReserve: number;
		fpsPrice: number;
		fpsTotalSupply: number;
		thetaFromPositions: number;
		thetaPerToken: number;
		earningsPerAnnum: number;
		earningsPerToken: number;
		priceToEarnings: number;
		priceToBookValue: number;
	};
	exposures: AnalyticsExposureItem[];
};

export type ApiAnalyticsFpsEarnings = {
	mintersFees: number;
	investFees: number;
	redeemFees: number;
	positionProposalFees: number;
	otherProfitClaims: number;
	otherContributions: number;
};
