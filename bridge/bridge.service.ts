import { gql } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.config';
import { StablecoinBridgeQuery } from './bridge.types';

@Injectable()
export class BridgeService {
	async getBridgedStables(stablecoinParam: string, timestamp: Date): Promise<StablecoinBridgeQuery[]> {
		const stablecoin = stablecoinParam.toUpperCase();
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const bridgeFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
                query {
                    bridge${stablecoin}s(
                        orderBy: "timestamp", orderDirection: "desc"
                        where: {
                            timestamp_gt: "${checkTimestamp}"
                            isMint: true
                        }
                    ) {
                        items {
                            swapper
                            txHash
                            amount
                            isMint
                            timestamp
                        }
                    }
                }
            `,
		});

		return bridgeFetched?.data?.[`bridge${stablecoin}s`]?.items ?? [];
	}
}
