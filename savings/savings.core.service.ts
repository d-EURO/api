import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { SavingsLeadrateService } from './savings.leadrate.service';
import { Address, formatUnits, zeroAddress } from 'viem';
import { ApiSavingsInfo, ApiSavingsUserTable, ApiSavingsUserLeaderboard, SavingsSavedQuery } from './savings.core.types';
import { PONDER_CLIENT, VIEM_CONFIG } from 'api.config';
import { ADDRESS, SavingsGatewayABI } from '@deuro/eurocoin';

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

	async getUserTables(userAddress: Address, limit: number = 8): Promise<ApiSavingsUserTable> {
		const user: Address = userAddress == zeroAddress ? zeroAddress : (userAddress.toLowerCase() as Address);
		const savedFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
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
				query {
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
				query {
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

	async getSavingsUpdatesList(timestamp: Date): Promise<SavingsSavedQuery[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const savedFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
			query {
				savingsSaveds(orderBy: "blockheight", orderDirection: "desc"
				where: { created_gt: "${checkTimestamp}" }
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
							frontendCode
						}
					}
				}
			`,
		});

		return savedFetched?.data?.savingsSaveds?.items ?? [];
	}
}
