import { gql } from '@apollo/client/core';
import { ADDRESS } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import { CONFIG } from 'api.config';
import { PricesService } from 'prices/prices.service';
import { Address } from 'viem';
import { EcosystemCollateralService } from './ecosystem.collateral.service';
import { EcosystemDepsService } from './ecosystem.deps.service';
import {
	ApiEcosystemMintBurnMapping,
	ApiEcosystemStablecoinInfo,
	ApiEcosystemStablecoinKeyValues,
	EcosystemQueryItem,
	EcosystemMintQueryItem,
	MintBurnAddressMapperQueryItem,
	ServiceEcosystemMintBurnMapping,
	ServiceEcosystemStablecoin,
	ServiceEcosystemStablecoinKeyValues,
} from './ecosystem.stablecoin.types';

@Injectable()
export class EcosystemStablecoinService {
	private readonly logger = new Logger(this.constructor.name);
	private ecosystemStablecoinKeyValues: ServiceEcosystemStablecoinKeyValues;
	private ecosystemStablecoin: ServiceEcosystemStablecoin;
	private ecosystemMintBurnMapping: ServiceEcosystemMintBurnMapping = {};

	constructor(
		private readonly depsService: EcosystemDepsService,
		private readonly collService: EcosystemCollateralService,
		private readonly pricesService: PricesService
	) {}

	getEcosystemStablecoinKeyValues(): ApiEcosystemStablecoinKeyValues {
		return this.ecosystemStablecoinKeyValues;
	}

	getEcosystemStablecoinInfo(): ApiEcosystemStablecoinInfo {
		return {
			erc20: {
				name: 'Decentralized Euro',
				address: ADDRESS[CONFIG.chain.id as number].decentralizedEURO,
				symbol: 'dEURO',
				decimals: 18,
			},
			chain: {
				name: CONFIG.chain.name,
				id: CONFIG.chain.id,
			},
			price: {
				usd: Object.values(this.pricesService.getPrices()).find((p) => p.symbol === 'dEURO')?.price?.usd || 1,
			},
			deps: this.depsService.getEcosystemDepsInfo()?.values,
			tvl: this.collService.getCollateralStats()?.totalValueLocked ?? {},
			...this.ecosystemStablecoin,
		};
	}

	getTotalSupply(): number {
		return this.ecosystemStablecoin.total.supply;
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
				query GetEcosystems {
					ecosystems(orderBy: "id", limit: 1000) {
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

		this.ecosystemStablecoinKeyValues = { ...mappingKeyValues };

		// mint burn mapping
		const mint: number = parseInt(getItem('Stablecoin:Mint')?.amount.toString() ?? '0') / 10 ** 18;
		const burn: number = parseInt(getItem('Stablecoin:Burn')?.amount.toString() ?? '0') / 10 ** 18;
		const supply: number = mint - burn;

		this.ecosystemStablecoin = {
			total: {
				mint: mint,
				burn: burn,
				supply: supply,
			},
			raw: {
				mint: getItem('Stablecoin:Mint')?.amount.toString() ?? '0',
				burn: getItem('Stablecoin:Burn')?.amount.toString() ?? '0',
			},
			counter: {
				mint: parseInt(getItem('Stablecoin:MintCounter')?.amount.toString() ?? '0'),
				burn: parseInt(getItem('Stablecoin:BurnCounter')?.amount.toString() ?? '0'),
			},
		};
	}

	async updateEcosystemMintBurnMapping() {
		this.logger.debug('Updating EcosystemMintBurnMapping');

		// FIXME: build a fetcher... with start and offset. (first:2 offset:2)
		const response = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetMintBurnAddressMappers {
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

	async getRecentMints(since: Date): Promise<EcosystemMintQueryItem[]> {
		const timestamp = Math.floor(since.getTime() / 1000);
		
		const response = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetRecentMints {
					mints(
						orderBy: "timestamp",
						orderDirection: "desc",
						limit: 100
					) {
						items {
							id
							to
							value
							blockheight
							timestamp
							txHash
						}
					}
				}
			`
		});

		if (!response.data || !response.data.mints?.items) {
			return [];
		}

		// Filter mints by timestamp
		const filteredMints = response.data.mints.items.filter((item: any) => 
			BigInt(item.timestamp) > BigInt(timestamp)
		);

		return filteredMints.map((item: any) => ({
			id: item.id,
			to: item.to,
			value: BigInt(item.value),
			blockheight: BigInt(item.blockheight),
			timestamp: BigInt(item.timestamp),
			txHash: item.txHash
		}));
	}
}
