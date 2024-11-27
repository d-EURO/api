import { Injectable, Logger } from '@nestjs/common';
import { gql } from '@apollo/client/core';
import { CONFIG, PONDER_CLIENT } from 'api.config';
import {
	ServiceEcosystemFrankencoin,
	ServiceEcosystemMintBurnMapping,
	EcosystemQueryItem,
	MintBurnAddressMapperQueryItem,
	ApiEcosystemFrankencoinInfo,
	ApiEcosystemMintBurnMapping,
	ServiceEcosystemFrankencoinKeyValues,
	ApiEcosystemFrankencoinKeyValues,
} from './ecosystem.frankencoin.types';
import { PricesService } from 'prices/prices.service';
import { Address } from 'viem';
import { EcosystemFpsService } from './ecosystem.fps.service';
import { EcosystemCollateralService } from './ecosystem.collateral.service';
import { ADDRESS } from '@deuro/eurocoin';

@Injectable()
export class EcosystemFrankencoinService {
	private readonly logger = new Logger(this.constructor.name);
	private ecosystemFrankencoinKeyValues: ServiceEcosystemFrankencoinKeyValues;
	private ecosystemFrankencoin: ServiceEcosystemFrankencoin;
	private ecosystemMintBurnMapping: ServiceEcosystemMintBurnMapping = {};

	constructor(
		private readonly fpsService: EcosystemFpsService,
		private readonly collService: EcosystemCollateralService,
		private readonly pricesService: PricesService
	) {}

	getEcosystemFrankencoinKeyValues(): ApiEcosystemFrankencoinKeyValues {
		return this.ecosystemFrankencoinKeyValues;
	}

	getEcosystemFrankencoinInfo(): ApiEcosystemFrankencoinInfo {
		return {
			erc20: {
				name: 'Frankencoin',
				address: ADDRESS[CONFIG.chain.id as number].frankenCoin,
				symbol: 'ZCHF',
				decimals: 18,
			},
			chain: {
				name: CONFIG.chain.name,
				id: CONFIG.chain.id,
			},
			price: {
				usd: Object.values(this.pricesService.getPrices()).find((p) => p.symbol === 'ZCHF')?.price.usd,
			},
			fps: this.fpsService.getEcosystemFpsInfo().values,
			tvl: this.collService.getCollateralStats()?.totalValueLocked ?? {},
			...this.ecosystemFrankencoin,
		};
	}

	getEcosystemMintBurnMapping(): ApiEcosystemMintBurnMapping {
		return {
			num: Object.keys(this.ecosystemMintBurnMapping).length,
			addresses: Object.keys(this.ecosystemMintBurnMapping) as Address[],
			map: this.ecosystemMintBurnMapping,
		};
	}

	async updateEcosystemKeyValues() {
		this.logger.debug('Updating EcosystemKeyValues');
		const ecosystem = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					ecosystems(orderBy: "id") {
						items {
							id
							value
							amount
						}
					}
				}
			`,
		});

		if (!ecosystem.data || !ecosystem.data.ecosystems.items) {
			this.logger.warn('No ecosystem data found.');
			return;
		}

		const e = ecosystem.data.ecosystems.items as EcosystemQueryItem[];
		const getItem = (key: string) => e.find((i) => i.id === key);

		// key values mapping
		const mappingKeyValues: { [key: string]: EcosystemQueryItem } = {};
		for (const i of e) {
			mappingKeyValues[i.id] = i;
		}

		this.ecosystemFrankencoinKeyValues = { ...mappingKeyValues };

		// mint burn mapping
		const mint: number = parseInt(getItem('Frankencoin:Mint')?.amount.toString() ?? '0') / 10 ** 18;
		const burn: number = parseInt(getItem('Frankencoin:Burn')?.amount.toString() ?? '0') / 10 ** 18;
		const supply: number = mint - burn;

		this.ecosystemFrankencoin = {
			total: {
				mint: mint,
				burn: burn,
				supply: supply,
			},
			raw: {
				mint: getItem('Frankencoin:Mint')?.amount.toString() ?? '0',
				burn: getItem('Frankencoin:Burn')?.amount.toString() ?? '0',
			},
			counter: {
				mint: parseInt(getItem('Frankencoin:MintCounter')?.amount.toString() ?? '0'),
				burn: parseInt(getItem('Frankencoin:BurnCounter')?.amount.toString() ?? '0'),
			},
		};
	}

	async updateEcosystemMintBurnMapping() {
		this.logger.debug('Updating EcosystemMintBurnMapping');

		// FIXME: build a fetcher... with start and offset. (first:2 offset:2)
		const response = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					mintBurnAddressMappers(orderBy: "id", limit: 1000) {
						items {
							id
							mint
							burn
						}
					}
				}
			`,
		});

		if (!response.data || !response.data.mintBurnAddressMappers.items) {
			this.logger.warn('No mints data found.');
			return;
		}

		const e = response.data.mintBurnAddressMappers.items as MintBurnAddressMapperQueryItem[];

		for (const item of e) {
			this.ecosystemMintBurnMapping[item.id] = {
				mint: item.mint,
				burn: item.burn,
			};
		}
	}
}
