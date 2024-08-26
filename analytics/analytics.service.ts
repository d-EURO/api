import { Injectable, Logger } from '@nestjs/common';
import { VIEM_CONFIG } from 'api.config';
import { ADDRESS } from 'contracts';
import { FrankencoinABI } from 'contracts/abis/Frankencoin';
import { EcosystemFpsService } from 'ecosystem/ecosystem.fps.service';
import { PositionsService } from 'positions/positions.service';
import { uniqueValues } from 'utils/format-array';
import { formatUnits } from 'viem';
import { ApiAnalyticsCollateralExposure } from './analytics.types';

@Injectable()
export class AnalyticsService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(
		private readonly positions: PositionsService,
		private readonly fps: EcosystemFpsService
	) {}

	async getCollateralExposure(): Promise<ApiAnalyticsCollateralExposure> {
		const positions = this.positions.getPositionsOpen().map;
		const list = Object.values(positions);
		const collaterals = list.map((p) => p.collateral).filter(uniqueValues);
		const fps = this.fps.getEcosystemFpsInfo();

		let positionsTheta: number = 0;
		let positionsThetaPerToken: number = 0;

		const minterReserveRaw = await VIEM_CONFIG.readContract({
			address: ADDRESS[VIEM_CONFIG.chain.id].frankenCoin,
			abi: FrankencoinABI,
			functionName: 'minterReserve',
		});

		const balanceReserveRaw = await VIEM_CONFIG.readContract({
			address: ADDRESS[VIEM_CONFIG.chain.id].frankenCoin,
			abi: FrankencoinABI,
			functionName: 'balanceOf',
			args: [ADDRESS[VIEM_CONFIG.chain.id].equity],
		});

		const equityInReserveRaw = balanceReserveRaw - minterReserveRaw;

		const minterReserve = formatUnits(minterReserveRaw, 18);
		const balanceReserve = formatUnits(balanceReserveRaw, 18);
		const equityInReserve = formatUnits(equityInReserveRaw, 18);

		const returnData = [];

		for (const c of collaterals) {
			const pos = list.filter((p) => p.collateral === c);
			const originals = pos.filter((p) => p.isOriginal === true);
			const clones = pos.filter((p) => p.isClone === true);

			const totalMintedRaw = pos.reduce<bigint>((a, b) => a + BigInt(b.minted), 0n);
			const totalMinted = formatUnits(totalMintedRaw, 18);
			const totalLimitRaw = originals.reduce<bigint>((a, b) => a + BigInt(b.limitForClones), 0n);
			const totalLimit = formatUnits(totalLimitRaw, 18);
			const totalMintedRatioPPM = (totalMintedRaw * BigInt(1_000_000)) / totalLimitRaw;
			const totalMintedRatio = parseInt(totalMintedRatioPPM.toString()) / 1_000_000;

			const interestMulRaw = pos.reduce<bigint>((a, b) => {
				const effI = Math.floor((b.annualInterestPPM * 1_000_000) / (1_000_000 - b.reserveContribution));
				return a + BigInt(b.minted) * BigInt(effI);
			}, 0n);
			const interestAvgPPM = totalMintedRaw > 0 ? parseInt(interestMulRaw.toString()) / parseInt(totalMintedRaw.toString()) : 0;
			const interestAvg = parseInt(interestAvgPPM.toString()) / 1_000_000;

			const totalTheta = (interestAvg * parseFloat(totalMinted)) / 365;
			positionsTheta += totalTheta;
			const thetaPerToken = totalTheta / fps.values.totalSupply;
			positionsThetaPerToken += thetaPerToken;

			const totalContributionMul = pos.reduce<bigint>((a, b) => {
				return a + BigInt(b.minted) * BigInt(b.reserveContribution);
			}, 0n);

			const totalContributionRaw = BigInt(Math.floor(parseInt(formatUnits(totalContributionMul, 6))));
			const equityInReserveWipedRaw = equityInReserveRaw + totalContributionRaw - totalMintedRaw;
			const fpsPriceWiped = (parseFloat(formatUnits(equityInReserveWipedRaw, 18)) * 3) / fps.values.totalSupply;
			const riskRatioWiped = Math.round(1_000_000 * (1 - fpsPriceWiped / fps.values.price)) / 1_000_000;

			const data = {
				collateral: {
					address: c,
					chainId: VIEM_CONFIG.chain.id,
					name: pos.at(0).collateralName,
					symbol: pos.at(0).collateralSymbol,
				},
				positions: {
					open: pos.length,
					originals: originals.length,
					clones: clones.length,
				},
				mint: {
					totalMintedRaw: totalMintedRaw.toString(),
					totalMinted: parseFloat(totalMinted),
					totalLimitRaw: totalLimitRaw.toString(),
					totalLimit: parseFloat(totalLimit),
					totalMintedRatioPPM: totalMintedRatioPPM.toString(),
					totalMintedRatio: totalMintedRatio,
					interestMultiplicationRaw: interestMulRaw.toString(),
					interestAveragePPM: interestAvgPPM,
					interestAverage: interestAvg,
					totalTheta: totalTheta,
					thetaPerFpsToken: thetaPerToken,
				},
				reserveCurrent: {
					balanceInReserveRaw: balanceReserveRaw.toString(),
					mintersContributionRaw: minterReserveRaw.toString(),
					equityInReserveRaw: equityInReserveRaw.toString(),
					positionsContributionRaw: totalContributionRaw.toString(),
					positionsRiskRaw: totalMintedRaw.toString(),
					fpsPrice: fps.values.price,
					riskRatio: 0,
				},
				reserveRiskWiped: {
					balanceInReserveRaw: (balanceReserveRaw - totalMintedRaw).toString(),
					mintersContributionRaw: (minterReserveRaw - totalContributionRaw).toString(),
					equityInReserveRaw: equityInReserveWipedRaw.toString(),
					positionsContributionRaw: '0',
					positionsRiskRaw: '0',
					fpsPrice: fpsPriceWiped,
					riskRatio: riskRatioWiped,
				},
			};

			returnData.push(data);
		}

		return {
			general: {
				balanceInReserveRaw: balanceReserveRaw.toString(),
				balanceInReserve: parseFloat(balanceReserve),
				mintersContributionRaw: minterReserveRaw.toString(),
				mintersContribution: parseFloat(minterReserve),
				equityInReserveRaw: equityInReserveRaw.toString(),
				equityInReserve: parseFloat(equityInReserve),
				fpsPrice: fps.values.price,
				fpsTotalSupply: fps.values.totalSupply,
				thetaAllPositions: positionsTheta,
				thetaPerToken: positionsThetaPerToken,
				earningsPerToken: positionsThetaPerToken * 365,
				earningsToPrice: fps.values.price / (positionsThetaPerToken * 365),
				priceToBookValue: 3,
			},
			exposures: returnData,
		};
	}
}
