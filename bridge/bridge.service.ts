import { gql } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import { StablecoinBridgeQuery } from './bridge.types';

import { StablecoinEnum } from './bridge.enum';

@Injectable()
export class BridgeService {
	async getBridgedStables(stablecoin: StablecoinEnum, timestamp: Date, minAmount: bigint): Promise<StablecoinBridgeQuery[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const bridgeFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
                query GetBridge${stablecoin} {
                    bridge${stablecoin}s(
                        orderBy: "timestamp", orderDirection: "desc"
                        where: {
                            timestamp_gt: "${checkTimestamp}"
                            amount_gte: "${minAmount}"
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
