import { gql } from '@apollo/client/core';
import { ADDRESS, SavingsGatewayABI } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import { VIEM_CONFIG } from 'api.config';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { Address, formatUnits, zeroAddress } from 'viem';
import { ApiSavingsInfo, ApiSavingsUserLeaderboard, ApiSavingsUserTable } from './savings.core.types';
import { SavingsLeadrateService } from './savings.leadrate.service';

@Injectable()
export class SavingsCoreService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedSavingsUserLeaderboard: ApiSavingsUserLeaderboard[] = [];

	constructor(
		private readonly fc: EcosystemStablecoinService,
		private readonly lead: SavingsLeadrateService
	) {}

	getInfo(): ApiSavingsInfo {
		const totalSavedRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalSaved']?.amount || 0n;
		const totalInterestRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalInterestCollected']?.amount || 0n;
		const totalWithdrawnRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalWithdrawn']?.amount || 0n;
		const rate = this.lead.getInfo().rate;

		const totalSaved: number = parseFloat(formatUnits(totalSavedRaw, 18));
		const totalInterest: number = parseFloat(formatUnits(totalInterestRaw, 18));
		const totalWithdrawn: number = parseFloat(formatUnits(totalWithdrawnRaw, 18));

		const totalSupply: number = this.fc.getEcosystemStablecoinInfo()?.total?.supply || 1;
		const ratioOfSupply: number = totalSaved / totalSupply;

		return {
			totalSaved,
			totalWithdrawn,
			totalBalance: totalSaved - totalWithdrawn,
			totalInterest,
			rate,
			ratioOfSupply,
		};
	}

	async updateSavingsUserLeaderboard(): Promise<void> {
		this.logger.debug('Updating SavingsUserLeaderboard');

		const data = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				{
					savingsUserLeaderboards(orderBy: "amountSaved", orderDirection: "desc") {
						items {
							id
							amountSaved
							interestReceived
						}
					}
				}
			`,
		});

		const items = data?.data?.savingsUserLeaderboards?.items ?? [];

		const mapped = await Promise.all(
			items.map(async (item) => {
				const unrealizedInterest = await VIEM_CONFIG.readContract({
					address: ADDRESS[VIEM_CONFIG.chain.id].savingsGateway,
					abi: SavingsGatewayABI,
					functionName: 'accruedInterest',
					args: [item.id],
				});

				return {
					account: item.id,
					amountSaved: item.amountSaved,
					unrealizedInterest: unrealizedInterest.toString(),
					interestReceived: item.interestReceived,
				};
			})
		);

		this.fetchedSavingsUserLeaderboard = mapped;
	}

	getSavingsUserLeaderboard(): ApiSavingsUserLeaderboard[] {
		return this.fetchedSavingsUserLeaderboard;
	}

	async getTotalSavingsUsers(): Promise<{ totalUsers: number }> {
		this.logger.debug('Getting total savings users count');
		
		// Always query fresh data to ensure accuracy
		// Only fetch IDs to minimize data transfer
		const data = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				{
					savingsUserLeaderboards(limit: 100000) {
						items {
							id
						}
					}
				}
			`,
		});

		const totalUsers = data?.data?.savingsUserLeaderboards?.items?.length ?? 0;
		
		this.logger.debug(`Total savings users: ${totalUsers}`);
		return { totalUsers };
	}

	async getUserTables(userAddress: Address, limit: number = 15): Promise<ApiSavingsUserTable> {
		const user: Address = userAddress == zeroAddress ? zeroAddress : (userAddress.toLowerCase() as Address);
		const savedFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsSaved {
					savingsSaveds(
						orderBy: "blockheight"
						orderDirection: "desc"
						${user == zeroAddress ? '' : `where: { account: "${user}" }`}
						limit: ${limit}
					) {
						items {
							id
							created
							blockheight
							txHash
							account
							amount
							rate
							total
							balance
						}
					}
				}
			`,
		});

		const withdrawnFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsWithdrawn {
					savingsWithdrawns(
						orderBy: "blockheight"
						orderDirection: "desc"
						${user == zeroAddress ? '' : `where: { account: "${user}" }`}
						limit: ${limit}
					) {
						items {
							id
							created
							blockheight
							txHash
							account
							amount
							rate
							total
							balance
						}
					}
				}
			`,
		});

		const interestFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsInterest {
					savingsInterests(
						orderBy: "blockheight"
						orderDirection: "desc"
						${user == zeroAddress ? '' : `where: { account: "${user}" }`}
						limit: ${limit}
					) {
						items {
							id
							created
							blockheight
							txHash
							account
							amount
							rate
							total
							balance
						}
					}
				}
			`,
		});

		return {
			save: savedFetched?.data?.savingsSaveds?.items ?? [],
			interest: interestFetched?.data?.savingsInterests?.items ?? [],
			withdraw: withdrawnFetched?.data?.savingsWithdrawns?.items ?? [],
		};
	}
}
