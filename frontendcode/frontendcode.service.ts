import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.config';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from './frontendcode.types';

@Injectable()
export class FrontendCodeService {
	private readonly logger = new Logger(this.constructor.name);

	async getFrontendCodeRegistereds(timestamp: Date): Promise<FrontendCodeRegisteredQuery[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const frontendCodeFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					frontendCodeRegistereds(
						orderBy: "created", orderDirection: "desc"
						where: { created_gt: "${checkTimestamp}" }
					) {
						items {
							txHash
							frontendCode
						}
					}
				}
			`,
		});

		return frontendCodeFetched?.data?.frontendCodeRegistereds?.items ?? [];
	}

	async getSavingsSaveds(timestamp: Date): Promise<FrontendCodeSavingsQuery[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const savedFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					savingsSaveds(
						orderBy: "created", orderDirection: "desc"
						where: { created_gt: "${checkTimestamp}" }
					) {
						items {
							txHash
							account
							amount
							rate
							frontendCode
						}
					}
				}
			`,
		});

		return savedFetched?.data?.savingsSaveds?.items ?? [];
	}
}
