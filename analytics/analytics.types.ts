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
		totalMintedRaw: string;
		totalMinted: number;
		totalLimitRaw: string;
		totalLimit: number;
		totalMintedRatioPPM: number;
		totalMintedRatio: number;
		interestMultiplicationRaw: string;
		interestAveragePPM: number;
		interestAverage: number;
		totalTheta: number;
		thetaPerFpsToken: number;
	};
	reserveCurrent: {
		balanceInReserveRaw: string;
		mintersContributionRaw: string;
		equityInReserveRaw: string;
		positionsContributionRaw: string;
		positionsRiskRaw: string;
		fpsPrice: number;
		riskRatio: number;
	};
	reserveRiskWiped: {
		balanceInReserveRaw: string;
		mintersContributionRaw: string;
		equityInReserveRaw: string;
		positionsContributionRaw: string;
		positionsRiskRaw: string;
		fpsPrice: number;
		riskRatio: number;
	};
};

// --------------------------------------------------------------------------
// Api
export type ApiAnalyticsCollateralExposure = {
	general: {
		balanceInReserveRaw: string;
		balanceInReserve: number;
		mintersContributionRaw: string;
		mintersContribution: number;
		equityInReserveRaw: string;
		equityInReserve: number;
		fpsPrice: number;
		fpsTotalSupply: number;
		thetaAllPositions: number;
		thetaPerToken: number;
		earningsPerAnnual: number;
		earningsPerToken: number;
		earningsToPrice: number;
		priceToBookValue: number;
	};
	exposures: AnalyticsExposureItem[];
};
