import { gql } from '@apollo/client/core';
import { ADDRESS, DecentralizedEUROABI, EquityABI } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { VIEM_CONFIG } from 'api.config';
import { PONDER_CLIENT } from 'api.apollo.config';
import { PositionsService } from 'positions/positions.service';
import { formatUnits } from 'viem';
import { ApiEcosystemDepsInfo } from './ecosystem.deps.types';
@Injectable()
export class EcosystemDepsService {
	private readonly logger = new Logger(this.constructor.name);
	private depsInfo: ApiEcosystemDepsInfo;

	constructor(private readonly positionsService: PositionsService) {}

	getEcosystemDepsInfo(): ApiEcosystemDepsInfo {
		return this.depsInfo;
	}

	async updateDepsInfo() {
		this.logger.debug('Updating EcosystemDepsInfo');

		const chainId = VIEM_CONFIG.chain.id;
		const addr = ADDRESS[chainId].equity;

		const fetchedPrice = await VIEM_CONFIG.readContract({
			address: addr,
			abi: EquityABI,
			functionName: 'price',
		});
		const fetchedTotalSupply = await VIEM_CONFIG.readContract({
			address: addr,
			abi: EquityABI,
			functionName: 'totalSupply',
		});

		const minterReserveRaw = await VIEM_CONFIG.readContract({
			address: ADDRESS[VIEM_CONFIG.chain.id].decentralizedEURO,
			abi: DecentralizedEUROABI,
			functionName: 'minterReserve',
		});

		const balanceReserveRaw = await VIEM_CONFIG.readContract({
			address: ADDRESS[VIEM_CONFIG.chain.id].decentralizedEURO,
			abi: DecentralizedEUROABI,
			functionName: 'balanceOf',
			args: [ADDRESS[VIEM_CONFIG.chain.id].equity],
		});

		const p = parseInt(fetchedPrice.toString()) / 1e18;
		const s = parseInt(fetchedTotalSupply.toString()) / 1e18;

		const profitLossPonder = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetDEPS {
					dEPSs(orderBy: "id", limit: 1000) {
						items {
							id
							profits
							loss
						}
					}
				}
			`,
		});

		if (!profitLossPonder.data || !profitLossPonder.data.dEPSs.items.length) {
			this.logger.warn('No profitLossPonder data found.');
			return;
		}

		const d = profitLossPonder.data.dEPSs.items.at(0);
		const unrealizedProfit = this.getUnrealizedProfit();
		const directTransfers = await this.getDirectTransfersToEquity();
		const earningsData: ApiEcosystemDepsInfo['earnings'] = {
			profit: parseFloat(formatUnits(d.profits, 18)),
			loss: parseFloat(formatUnits(d.loss, 18)),
			unrealizedProfit: parseFloat(formatUnits(unrealizedProfit, 18)),
			directTransfers: parseFloat(formatUnits(directTransfers, 18)),
		};

		const equityInReserveRaw = balanceReserveRaw - minterReserveRaw;

		const balanceReserve = parseFloat(formatUnits(balanceReserveRaw, 18));
		const equityInReserve = parseFloat(formatUnits(equityInReserveRaw, 18));
		const minterReserve = parseFloat(formatUnits(minterReserveRaw, 18));

		this.depsInfo = {
			earnings: earningsData,
			values: {
				price: p,
				totalSupply: s,
				depsMarketCapInChf: p * s,
			},
			reserve: {
				balance: balanceReserve,
				equity: equityInReserve,
				minter: minterReserve,
			},
		};
	}

	private getUnrealizedProfit(): bigint {
		const positions = this.positionsService.getPositionsList().list;
		const openPositions = positions.filter((p) => !p.closed && !p.denied);

		const unrealizedProfit = openPositions.reduce((acc, p) => {
			return acc + BigInt(p.interest);
		}, 0n);

		return unrealizedProfit;
	}

	private async getDirectTransfersToEquity(): Promise<bigint> {
		const chainId = VIEM_CONFIG.chain.id;
		const equityAddress = ADDRESS[chainId].equity.toLowerCase();

		try {
			const transfersQuery = await PONDER_CLIENT.query({
				fetchPolicy: 'no-cache',
				query: gql`
					query GetDirectTransfers($equityAddress: String!) {
						stablecoinTransferHistories(
							where: { to: $equityAddress }
							orderBy: "timestamp"
							limit: 10000
						) {
							items {
								amount
								from
								to
							}
						}
					}
				`,
				variables: {
					equityAddress,
				},
			});

			if (!transfersQuery.data || !transfersQuery.data.stablecoinTransferHistories.items.length) {
				this.logger.debug('No direct transfers to Equity found.');
				return 0n;
			}

			const totalTransfers = transfersQuery.data.stablecoinTransferHistories.items.reduce((acc, transfer) => {
				return acc + BigInt(transfer.amount);
			}, 0n);

			this.logger.debug(`Total direct transfers to Equity: ${formatUnits(totalTransfers, 18)} dEURO`);
			return totalTransfers;
		} catch (error) {
			this.logger.error('Error fetching direct transfers to Equity', error);
			return 0n;
		}
	}

	getTotalSupply(): number {
		return this.depsInfo?.values?.totalSupply ?? 0;
	}
}
