import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { SavingsLeadrateService } from './savings.leadrate.service';
import { Address, formatUnits, hexToString, zeroAddress } from 'viem';
import { ApiSavingsInfo, ApiSavingsUserTable, SavingsSavedQuery } from './savings.core.types';
import { PONDER_CLIENT } from 'api.config';

@Injectable()
export class SavingsCoreService {
	private readonly logger = new Logger(this.constructor.name);

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
						}
					}
				}
			`,
		});

		const savingSaveds = savedFetched?.data?.savingsSaveds?.items ?? [];

		for (const savingsSaved of savingSaveds) {
			savingsSaved.refCode = await this.getRefCode(savingsSaved.txHash);
		}

		return savingSaveds;
	}

	private async getRefCode(txHash: string): Promise<string | undefined> {
		const frontendFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
			query {
  					frontendBonusHistoryMappings(
						where: { txHash: "${txHash}" }
					) {
						items {
							id
							frontendCode
							payout
							source
							timestamp
							txHash
						}
					}
				}
			`,
		});

		const frontendBonusHistoryMappings = frontendFetched.data.frontendBonusHistoryMappings;

		if (frontendBonusHistoryMappings.items.length > 0) {
			const frontendCode = frontendBonusHistoryMappings.items[0].frontendCode ?? '0xff';

			if (frontendCode.toString().startsWith('0x00')) {
				return hexToString(frontendCode).replace(/\0/g, '');
			}
		}
	}
}
