import { gql } from '@apollo/client/core';
import { ERC20ABI, SavingsGatewayV2ABI, SavingsV3ABI } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import { ADDR, isDeployed, VIEM_CONFIG } from 'api.config';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { Address, formatUnits, zeroAddress } from 'viem';
import { ApiSavingsInfo, ApiSavingsUserLeaderboard, ApiSavingsUserTable } from './savings.core.types';
import { SavingsLeadrateService } from './savings.leadrate.service';

@Injectable()
export class SavingsCoreService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedSavingsUserLeaderboard: ApiSavingsUserLeaderboard[] = [];
	private fetchedSavingsBalances: { v2: bigint; v3: bigint } = { v2: 0n, v3: 0n };

	constructor(
		private readonly fc: EcosystemStablecoinService,
		private readonly lead: SavingsLeadrateService
	) {}

	getInfo(): ApiSavingsInfo {
		const totalSavedRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalSaved']?.amount || 0n;
		const totalInterestRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalInterestCollected']?.amount || 0n;
		const totalWithdrawnRaw = this.fc.getEcosystemStablecoinKeyValues()?.['Savings:TotalWithdrawn']?.amount || 0n;
		const info = this.lead.getInfo();
		const { v2: v2BalanceRaw, v3: v3BalanceRaw } = this.fetchedSavingsBalances;

		const totalSaved: number = parseFloat(formatUnits(totalSavedRaw, 18));
		const totalInterest: number = parseFloat(formatUnits(totalInterestRaw, 18));
		const totalWithdrawn: number = parseFloat(formatUnits(totalWithdrawnRaw, 18));
		const totalBalance: number = parseFloat(formatUnits(v2BalanceRaw + v3BalanceRaw, 18));

		const totalSupply: number = this.fc.getEcosystemStablecoinInfo()?.total?.supply || 1;
		const ratioOfSupply: number = totalBalance / totalSupply;

		return {
			totalSaved,
			totalWithdrawn,
			totalBalance,
			totalInterest,
			rate: info.v3.rate || info.v2.rate,
			rateV2: info.v2.rate,
			rateV3: info.v3.rate,
			ratioOfSupply,
		};
	}

	async updateSavingsBalances(): Promise<void> {
		this.logger.debug('Updating SavingsBalances');
		const results = await Promise.allSettled([
			VIEM_CONFIG.readContract({
				address: ADDR.decentralizedEURO,
				abi: ERC20ABI,
				functionName: 'balanceOf',
				args: [ADDR.savingsGateway],
			}),
			isDeployed(ADDR.savings)
				? VIEM_CONFIG.readContract({
						address: ADDR.decentralizedEURO,
						abi: ERC20ABI,
						functionName: 'balanceOf',
						args: [ADDR.savings],
					})
				: Promise.resolve(0n),
		]);

		if (results[0].status === 'fulfilled') this.fetchedSavingsBalances.v2 = results[0].value;
		else this.logger.warn(`Failed to fetch V2 savings balance: ${results[0].reason}`);

		if (results[1].status === 'fulfilled') this.fetchedSavingsBalances.v3 = results[1].value;
		else this.logger.warn(`Failed to fetch V3 savings balance: ${results[1].reason}`);
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
				const results = await Promise.allSettled([
					VIEM_CONFIG.readContract({
						address: ADDR.savingsGateway,
						abi: SavingsGatewayV2ABI,
						functionName: 'accruedInterest',
						args: [item.id],
					}),
					isDeployed(ADDR.savings)
						? VIEM_CONFIG.readContract({
								address: ADDR.savings,
								abi: SavingsV3ABI,
								functionName: 'accruedInterest',
								args: [item.id],
							})
						: Promise.resolve(0n),
					isDeployed(ADDR.savings)
						? VIEM_CONFIG.readContract({
								address: ADDR.savings,
								abi: SavingsV3ABI,
								functionName: 'claimableInterest',
								args: [item.id],
							})
						: Promise.resolve(0n),
				]);

				const v2 = results[0].status === 'fulfilled' ? results[0].value : 0n;
				const v3Accrued = results[1].status === 'fulfilled' ? results[1].value : 0n;
				const v3Claimable = results[2].status === 'fulfilled' ? results[2].value : 0n;

				return {
					account: item.id,
					amountSaved: item.amountSaved,
					unrealizedInterest: (BigInt(v2) + BigInt(v3Accrued) + BigInt(v3Claimable)).toString(),
					interestReceived: item.interestReceived,
				};
			})
		);

		this.fetchedSavingsUserLeaderboard = mapped;
	}

	getSavingsUserLeaderboard(): ApiSavingsUserLeaderboard[] {
		return this.fetchedSavingsUserLeaderboard;
	}

	async getUserTables(userAddress: Address, limit: number = 15): Promise<ApiSavingsUserTable> {
		const user: Address = userAddress == zeroAddress ? zeroAddress : (userAddress.toLowerCase() as Address);
		const userWhere = user == zeroAddress ? '' : `where: { account: "${user}" }`;
		const ownerWhere = user == zeroAddress ? '' : `where: { owner: "${user}" }`;
		const savedFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsSaved {
					savingsSaveds(
						orderBy: "blockheight"
						orderDirection: "desc"
						${userWhere}
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
						${userWhere}
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
						${userWhere}
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

		const vaultDepositsFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsVaultDeposit {
					savingsVaultDeposits(
						orderBy: "blockheight"
						orderDirection: "desc"
						${ownerWhere}
						limit: ${limit}
					) {
						items {
							id
							vault
							owner
							assets
							blockheight
							timestamp
							txHash
						}
					}
				}
			`,
		});

		const vaultWithdrawsFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsVaultWithdraw {
					savingsVaultWithdraws(
						orderBy: "blockheight"
						orderDirection: "desc"
						${ownerWhere}
						limit: ${limit}
					) {
						items {
							id
							vault
							owner
							assets
							blockheight
							timestamp
							txHash
						}
					}
				}
			`,
		});

		return {
			save: savedFetched?.data?.savingsSaveds?.items ?? [],
			interest: interestFetched?.data?.savingsInterests?.items ?? [],
			withdraw: withdrawnFetched?.data?.savingsWithdrawns?.items ?? [],
			vaultSave: vaultDepositsFetched?.data?.savingsVaultDeposits?.items ?? [],
			vaultWithdraw: vaultWithdrawsFetched?.data?.savingsVaultWithdraws?.items ?? [],
		};
	}
}
