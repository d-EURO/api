import { gql } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import { TradeQuery } from './trade.types';

@Injectable()
export class TradesService {
	async getTrades(timestamp: Date): Promise<TradeQuery[]> {
		const checkTimestamp = Math.trunc(timestamp.getTime() / 1000);

		const tradeFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
                query GetTrades {
                    trades(
                        orderBy: "time", orderDirection: "desc"
                        where: {
                            time_gt: "${checkTimestamp}",
                            shares_gt: "0"
                        }
                    ) {
                        items {
                            txHash
                            trader
                            amount
                            shares
                            frontendCode
                        }
                    }
                }
            `,
		});

		return tradeFetched?.data?.trades?.items ?? [];
	}

	async getTotalShares(trader: string): Promise<bigint> {
		const tradeFetched = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
                query GetTraderShares {
                    trades(
                        where: { 
                            trader: "${trader}"
                        }
                    ) {
                        items {
                            shares
                        }
                    }
                }
            `,
		});

		const items = tradeFetched?.data?.trades?.items ?? [];
		return items.map((i) => i.shares).reduce((prev, curr) => BigInt(prev) + BigInt(curr), BigInt(0));
	}
}
