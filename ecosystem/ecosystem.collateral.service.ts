import { Injectable, Logger } from '@nestjs/common';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import {
	ApiEcosystemCollateralList,
	ApiEcosystemCollateralListArray,
	ApiEcosystemCollateralPositions,
	ApiEcosystemCollateralPositionsDetails,
	ApiEcosystemCollateralStats,
	ApiEcosystemCollateralStatsItem,
} from './ecosystem.collateral.types';
import { PositionQuery } from 'positions/positions.types';
import { Address, formatUnits } from 'viem';
import { FIVEDAYS_MS } from 'utils/const-helper';
import { ERC20Info, PriceQueryCurrencies } from 'prices/prices.types';

@Injectable()
export class EcosystemCollateralService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(
		private readonly positionsService: PositionsService,
		private readonly pricesService: PricesService
	) {}

	getCollateralList(): ApiEcosystemCollateralListArray {
		const c = this.pricesService.getCollateral();
		return {
			num: Object.keys(c).length,
			list: Object.values(c) as ERC20Info[],
		};
	}

	getCollateralMapping(): ApiEcosystemCollateralList {
		const c = this.pricesService.getCollateral();
		return {
			num: Object.keys(c).length,
			addresses: Object.keys(c) as Address[],
			map: c,
		};
	}

	getCollateralPositions(): ApiEcosystemCollateralPositions {
		const positions = Object.values(this.positionsService.getPositionsList().list);
		const collaterals = this.pricesService.getCollateral();
		const collateralPositions: ApiEcosystemCollateralPositions = {};

		for (const c of Object.values(collaterals)) {
			const matchedPositions = positions.filter((p: PositionQuery) => p.collateral === c.address);
			if (!collateralPositions[c.address.toLowerCase()]) collateralPositions[c.address.toLowerCase()] = [];
			const addresses: Address[] = matchedPositions.map((p: PositionQuery) => p.position);
			collateralPositions[c.address.toLowerCase()] = {
				...c,
				num: addresses.length,
				addresses: addresses,
			};
		}

		return collateralPositions;
	}

	getCollateralPositionsDetails(): ApiEcosystemCollateralPositionsDetails {
		const positions = Object.values(this.positionsService.getPositionsList().list);
		const collaterals = this.pricesService.getCollateral();
		const collateralPositions: ApiEcosystemCollateralPositionsDetails = {};

		for (const c of Object.values(collaterals)) {
			const matchedPositions = positions.filter((p: PositionQuery) => p.collateral === c.address);
			if (!collateralPositions[c.address.toLowerCase()]) collateralPositions[c.address.toLowerCase()] = [];
			const addresses: Address[] = matchedPositions.map((p: PositionQuery) => p.position);
			collateralPositions[c.address.toLowerCase()] = {
				...c,
				num: addresses.length,
				addresses: addresses,
				positions: matchedPositions,
			};
		}

		return collateralPositions;
	}

	getCollateralStats(): ApiEcosystemCollateralStats {
		const collateralPositionsDetails = this.getCollateralPositionsDetails();
		const prices = this.pricesService.getPricesMapping();

		const deuroAddress = this.pricesService.getMint()?.address;
		if (!deuroAddress) return null;
		const deuroPrice = prices[deuroAddress.toLowerCase()]?.price?.usd as number;
		if (!deuroPrice) return null;

		const ecosystemTotalValueLocked: PriceQueryCurrencies = {};
		const map: { [key: Address]: ApiEcosystemCollateralStatsItem } = {};

		for (const c of Object.values(collateralPositionsDetails)) {
			const price = prices[c.address.toLowerCase()]?.price?.usd as number;
			if (!price) continue;

			const total = c.positions.length;
			const open = c.positions.filter((p: PositionQuery) => !p.closed && !p.denied).length;
			const requested = c.positions.filter((p: PositionQuery) => p.start * 1000 + FIVEDAYS_MS > Date.now()).length;
			const closed = c.positions.filter((p: PositionQuery) => p.closed).length;
			const denied = c.positions.filter((p: PositionQuery) => p.denied).length;
			const originals = c.positions.filter((p: PositionQuery) => p.isOriginal).length;
			const clones = c.positions.filter((p: PositionQuery) => p.isClone).length;
			const totalBalance = c.positions.reduce((a: bigint, b: PositionQuery) => a + BigInt(b.collateralBalance), 0n);
			const totalBalanceNumUsd = parseInt(formatUnits(totalBalance, c.decimals)) * price;
			const totalValueLocked: PriceQueryCurrencies = {
				usd: totalBalanceNumUsd,
				eur: totalBalanceNumUsd / deuroPrice,
			};

			// upsert ecosystemTotalValueLocked usd
			if (!ecosystemTotalValueLocked.usd) {
				ecosystemTotalValueLocked.usd = totalValueLocked.usd;
			} else {
				ecosystemTotalValueLocked.usd += totalValueLocked.usd;
			}

			// upsert ecosystemTotalValueLocked eur
			if (!ecosystemTotalValueLocked.eur) {
				ecosystemTotalValueLocked.eur = totalValueLocked.eur;
			} else {
				ecosystemTotalValueLocked.eur += totalValueLocked.eur;
			}

			// upsert map
			map[c.address.toLowerCase() as Address] = {
				address: c.address,
				name: c.name,
				symbol: c.symbol,
				decimals: c.decimals,
				positions: {
					total,
					open,
					requested,
					closed,
					denied,
					originals,
					clones,
				},
				totalBalanceRaw: totalBalance.toString(),
				totalValueLocked,
				price: {
					usd: price,
					eur: Math.round((price / deuroPrice) * 100) / 100,
				},
			};
		}

		return {
			num: Object.keys(collateralPositionsDetails).length,
			addresses: Object.keys(collateralPositionsDetails) as Address[],
			totalValueLocked: ecosystemTotalValueLocked,
			map,
		};
	}
}
