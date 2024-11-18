import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { EcosystemFrankencoinService } from 'ecosystem/ecosystem.frankencoin.service';
import { SavingsLeadrateService } from './savings.leadrate.service';
import { Address, formatUnits, zeroAddress } from 'viem';
import { ApiSavingsInfo, ApiSavingsUserTable } from './savings.core.types';
import { PONDER_CLIENT } from 'api.config';

@Injectable()
export class SavingsCoreService {
	private readonly logger = new Logger(this.constructor.name);

	constructor(
		private readonly fc: EcosystemFrankencoinService,
		private readonly lead: SavingsLeadrateService
	) {}

	getInfo(): ApiSavingsInfo {
		const totalSavedRaw = this.fc.getEcosystemFrankencoinKeyValues()['Savings:TotalSaved']?.amount || 0n;
		const totalInterestRaw = this.fc.getEcosystemFrankencoinKeyValues()['Savings:TotalInterestCollected']?.amount || 0n;
		const totalWithdrawnRaw = this.fc.getEcosystemFrankencoinKeyValues()['Savings:TotalWithdrawn']?.amount || 0n;
		const rate = this.lead.getInfo().rate;

		const totalSaved: number = parseFloat(formatUnits(totalSavedRaw, 18));
		const totalInterest: number = parseFloat(formatUnits(totalInterestRaw, 18));
		const totalWithdrawn: number = parseFloat(formatUnits(totalWithdrawnRaw, 18));

		const totalSupply: number = this.fc.getEcosystemFrankencoinInfo().total.supply;
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
}
