import { Injectable, Logger } from '@nestjs/common';
import { VIEM_CONFIG } from 'api.config';
import { EcosystemFpsService } from 'ecosystem/ecosystem.fps.service';
import { PositionsService } from 'positions/positions.service';
import { uniqueValues } from 'utils/format-array';
import { formatUnits } from 'viem';
import { AnalyticsExposureItem, ApiAnalyticsCollateralExposure, ApiAnalyticsFpsEarnings } from './analytics.types';
import { EcosystemFrankencoinService } from 'ecosystem/ecosystem.frankencoin.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { ADDRESS } from '@frankencoin/zchf';
import { FrankencoinABI } from '@frankencoin/zchf';
import { SavingsCoreService } from 'savings/savings.core.service';

@Injectable()
export class AnalyticsService {
	private readonly logger = new Logger(this.constructor.name);
	private exposure: ApiAnalyticsCollateralExposure;

	constructor(
		private readonly positions: PositionsService,
		private readonly fps: EcosystemFpsService,
		private readonly fc: EcosystemFrankencoinService,
		private readonly minters: EcosystemMinterService,
		private readonly save: SavingsCoreService
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
			const totalLimitRaw = pos.reduce<bigint>((a, b) => a + BigInt(b.limitForClones), 0n);
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

			const data: AnalyticsExposureItem = {
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
					totalMinted: parseFloat(totalMinted),
					totalContribution: parseFloat(formatUnits(totalContributionRaw, 18)),
					totalLimit: parseFloat(totalLimit),
					totalMintedRatio: totalMintedRatio,
					interestAverage: interestAvg,
					totalTheta: totalTheta,
					thetaPerFpsToken: thetaPerToken,
				},
				reserveRiskWiped: {
					fpsPrice: fpsPriceWiped < 0 ? 0 : fpsPriceWiped,
					riskRatio: riskRatioWiped,
				},
			};

			returnData.push(data);
		}

		this.exposure = {
			general: {
				balanceInReserve: parseFloat(balanceReserve),
				mintersContribution: parseFloat(minterReserve),
				equityInReserve: parseFloat(equityInReserve),
				fpsPrice: fps.values.price,
				fpsTotalSupply: fps.values.totalSupply,
				thetaFromPositions: positionsTheta,
				thetaPerToken: positionsThetaPerToken,
				earningsPerAnnum: positionsTheta * 365,
				earningsPerToken: positionsThetaPerToken * 365,
				priceToEarnings: fps.values.price / (positionsThetaPerToken * 365),
				priceToBookValue: 3,
			},
			exposures: returnData,
		};

		return this.exposure;
	}

	async getFpsEarnings(): Promise<ApiAnalyticsFpsEarnings> {
		const num: number = this.positions.getPositionsList().list.filter((p) => p.isOriginal).length;
		const positionProposalFees: number = 1000 * num;
		const investFeeRaw = this.fc.getEcosystemFrankencoinKeyValues()['Equity:InvestedFeePaidPPM']?.amount || 0n;
		const investFees = parseFloat(formatUnits(investFeeRaw, 18 + 6));
		const redeemFeeRaw = this.fc.getEcosystemFrankencoinKeyValues()['Equity:RedeemedFeePaidPPM']?.amount || 0n;
		const redeemFees = parseFloat(formatUnits(redeemFeeRaw, 18 + 6));
		const minterProposalFees = this.minters
			.getMintersList()
			.list.reduce<number>((a, b) => a + parseFloat(formatUnits(BigInt(b.applicationFee), 18)), 0);
		const otherProfitClaims: number = this.fps.getEcosystemFpsInfo().earnings.profit - positionProposalFees - minterProposalFees;

		const expo = await this.getCollateralExposure();
		const equityAdjusted: number = expo.general.equityInReserve;
		const otherContributions: number =
			equityAdjusted - minterProposalFees - investFees - redeemFees - positionProposalFees - otherProfitClaims;

		return {
			minterProposalFees,
			investFees,
			redeemFees,
			positionProposalFees,
			otherProfitClaims,
			otherContributions,

			savingsInterestCosts: this.save.getInfo().totalInterest,
			otherLossClaims: this.fps.getEcosystemFpsInfo().earnings.loss,
		};
	}
}
