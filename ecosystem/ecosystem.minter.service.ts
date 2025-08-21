import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { Address } from 'viem';
import { PONDER_CLIENT } from '../api.apollo.config';
import { ApiMinterListing, ApiMinterMapping, MinterQuery, MinterQueryObjectArray } from './ecosystem.minter.types';
import { EcosystemMintQueryItem } from './ecosystem.stablecoin.types';

@Injectable()
export class EcosystemMinterService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedMinters: MinterQueryObjectArray = {};

	getMintersList(): ApiMinterListing {
		const m = Object.values(this.fetchedMinters) as MinterQuery[];
		return {
			num: m.length,
			list: m,
		};
	}

	getMintersMapping(): ApiMinterMapping {
		const m = this.fetchedMinters;
		return {
			num: Object.keys(m).length,
			addresses: Object.keys(m) as Address[],
			map: m,
		};
	}

	async updateMinters() {
		this.logger.debug('Updating minters');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetMinters {
					minters(orderBy: "id", limit: 1000) {
						items {
							id
							txHash
							minter
							applicationPeriod
							applicationFee
							applyMessage
							applyDate
							suggestor
							denyMessage
							denyDate
							denyTxHash
							vetor
						}
					}
				}
			`,
		});

		if (!data || !data.minters) {
			this.logger.warn('No minters found.');
			return;
		}

		const list: MinterQueryObjectArray = {};
		for (const m of data.minters.items as MinterQuery[]) {
			list[m.id.toLowerCase() as Address] = {
				id: m.id,
				txHash: m.txHash,
				minter: m.minter,
				applicationPeriod: parseInt(m.applicationPeriod as any),
				applicationFee: m.applicationFee,
				applyMessage: m.applyMessage,
				applyDate: parseInt(m.applyDate as any),
				suggestor: m.suggestor,
				denyMessage: m.denyMessage,
				denyDate: parseInt(m.denyDate as any),
				denyTxHash: m.denyTxHash,
				vetor: m.vetor,
			};
		}

		const a = Object.keys(list).length;
		const b = Object.keys(this.fetchedMinters).length;
		const isDiff = a !== b;

		if (isDiff) this.logger.log(`Minters merging, from ${b} to ${a} entries`);
		this.fetchedMinters = { ...this.fetchedMinters, ...list };

		return list;
	}

	async getRecentMints(timestamp: Date, minValue: bigint): Promise<EcosystemMintQueryItem[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const mintsFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					mints(
					orderBy: "timestamp", orderDirection: "desc"
					where: {
							timestamp_gt: "${checkTimestamp}"
							value_gte: "${minValue}"
						}
					) {
						items {
							txHash
							blockheight
							to
							value
							timestamp
						}
					}
				}
			`,
		});
		return mintsFetched?.data?.mints?.items ?? [];
	}
}
