import { Injectable, Logger } from '@nestjs/common';
import { gql } from '@apollo/client/core';
import { PONDER_CLIENT, VIEM_CONFIG } from 'api.config';
import {
	ApiBidsBidders,
	ApiBidsChallenges,
	ApiBidsListing,
	ApiBidsMapping,
	ApiBidsPositions,
	ApiChallengesChallengers,
	ApiChallengesListing,
	ApiChallengesMapping,
	ApiChallengesPositions,
	ApiChallengesPrices,
	BidsBidderMapping,
	BidsChallengesMapping,
	BidsId,
	BidsPositionsMapping,
	BidsQueryItem,
	BidsQueryItemMapping,
	ChallengesChallengersMapping,
	ChallengesId,
	ChallengesPositionsMapping,
	ChallengesPricesMapping,
	ChallengesQueryItem,
	ChallengesQueryItemMapping,
	ChallengesQueryStatus,
} from './challenges.types';
import { Address } from 'viem';
import { ADDRESS } from '@frankencoin/zchf';
import { MintingHubV1ABI } from '@frankencoin/zchf';

@Injectable()
export class ChallengesService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedChallenges: ChallengesQueryItem[] = [];
	private fetchedChallengesMapping: ChallengesQueryItemMapping = {};
	private fetchedBids: BidsQueryItem[] = [];
	private fetchedBidsMapping: BidsQueryItemMapping = {};
	private fetchedPrices: ChallengesPricesMapping = {};

	constructor() {}

	getChallenges(): ApiChallengesListing {
		return {
			num: this.fetchedChallenges.length,
			list: this.fetchedChallenges,
		};
	}

	getChallengesMapping(): ApiChallengesMapping {
		const c = this.fetchedChallengesMapping;
		return {
			num: Object.keys(c).length,
			challenges: Object.keys(c) as ChallengesId[],
			map: c,
		};
	}

	getChallengersMapping(): ApiChallengesChallengers {
		const challengersMapping: ChallengesChallengersMapping = {};
		for (const challenge of Object.values(this.fetchedChallenges)) {
			if (!challengersMapping[challenge.challenger.toLowerCase()]) {
				challengersMapping[challenge.challenger.toLowerCase()] = [];
			}
			challengersMapping[challenge.challenger.toLowerCase()].push(challenge);
		}

		return {
			num: Object.keys(challengersMapping).length,
			challengers: Object.keys(challengersMapping) as Address[],
			map: challengersMapping,
		};
	}

	getChallengesPositions(): ApiChallengesPositions {
		const positionsMapping: ChallengesPositionsMapping = {};
		for (const challenge of Object.values(this.fetchedChallenges)) {
			if (!positionsMapping[challenge.position.toLowerCase()]) {
				positionsMapping[challenge.position.toLowerCase()] = [];
			}
			positionsMapping[challenge.position.toLowerCase()].push(challenge);
		}

		return {
			num: Object.keys(positionsMapping).length,
			positions: Object.keys(positionsMapping) as Address[],
			map: positionsMapping,
		};
	}

	// challenges prices
	getChallengesPrices(): ApiChallengesPrices {
		const pr = this.fetchedPrices;
		return {
			num: Object.keys(pr).length,
			ids: Object.keys(pr) as ChallengesId[],
			map: pr,
		};
	}

	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	getBids(): ApiBidsListing {
		return {
			num: this.fetchedBids.length,
			list: this.fetchedBids,
		};
	}

	getBidsMapping(): ApiBidsMapping {
		const b = this.fetchedBidsMapping;
		return {
			num: Object.keys(b).length,
			bidIds: Object.keys(b) as BidsId[],
			map: b,
		};
	}

	// bids/bidders
	getBidsBiddersMapping(): ApiBidsBidders {
		const biddersMapping: BidsBidderMapping = {};
		for (const bid of Object.values(this.fetchedBids)) {
			if (!biddersMapping[bid.bidder.toLowerCase()]) {
				biddersMapping[bid.bidder.toLowerCase()] = [];
			}
			biddersMapping[bid.bidder.toLowerCase()].push(bid);
		}

		return {
			num: Object.keys(biddersMapping).length,
			bidders: Object.keys(biddersMapping) as Address[],
			map: biddersMapping,
		};
	}

	// bids/challenges
	getBidsChallengesMapping(): ApiBidsChallenges {
		const challengesMapping: BidsChallengesMapping = {};
		for (const bid of Object.values(this.fetchedBids)) {
			const challengeId = `${bid.position.toLowerCase()}-challenge-${bid.number}`;
			if (!challengesMapping[challengeId]) {
				challengesMapping[challengeId] = [];
			}
			challengesMapping[challengeId].push(bid);
		}

		return {
			num: Object.keys(challengesMapping).length,
			challenges: Object.keys(challengesMapping) as Address[],
			map: challengesMapping,
		};
	}

	// bids/positions
	getBidsPositionsMapping(): ApiBidsPositions {
		const positionsMapping: BidsPositionsMapping = {};
		for (const bid of Object.values(this.fetchedBids)) {
			const key = bid.position.toLowerCase();
			if (!positionsMapping[key]) {
				positionsMapping[key] = [];
			}
			positionsMapping[key].push(bid);
		}

		return {
			num: Object.keys(positionsMapping).length,
			positions: Object.keys(positionsMapping) as Address[],
			map: positionsMapping,
		};
	}

	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	// --------------------------------------------------------------------------
	async updateChallengesPrices() {
		this.logger.debug('Updating ChallengesPrices');
		const active = this.getChallenges().list.filter((c: ChallengesQueryItem) => c.status === ChallengesQueryStatus.Active);

		// mapping active challenge -> prices
		const challengesPrices: ChallengesPricesMapping = {};
		const mh: Address = ADDRESS[VIEM_CONFIG.chain.id].mintingHub;
		for (const c of active) {
			const price = await VIEM_CONFIG.readContract({
				abi: MintingHubV1ABI,
				address: mh,
				functionName: 'price',
				args: [parseInt(c.number.toString())],
			});

			challengesPrices[c.id] = price.toString();
		}

		// upsert
		this.fetchedPrices = { ...this.fetchedPrices, ...challengesPrices };
	}

	// --------------------------------------------------------------------------
	async updateChallenges() {
		this.logger.debug('Updating Challenges');
		const challenges = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					challengeV1s(orderBy: "status", orderDirection: "asc", limit: 1000) {
						items {
							id
							position
							number
							challenger
							start
							created
							duration
							size
							liqPrice
							bids
							filledSize
							acquiredCollateral
							status
						}
					}
				}
			`,
		});

		if (!challenges.data || !challenges.data.challenges) {
			this.logger.warn('No Challenge V1 found.');
			return;
		}

		// mapping
		this.fetchedChallenges = challenges.data.challenges.items as ChallengesQueryItem[];
		const mapped: ChallengesQueryItemMapping = {};
		for (const i of this.fetchedChallenges) {
			mapped[i.id] = i;
		}

		// upsert
		this.fetchedChallengesMapping = { ...this.fetchedChallengesMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateBids() {
		this.logger.debug('Updating Bids');
		const bids = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					challengeBidV1s(orderBy: "created", orderDirection: "desc", limit: 1000) {
						items {
							id
							position
							number
							numberBid
							bidder
							created
							bidType
							bid
							price
							filledSize
							acquiredCollateral
							challengeSize
						}
					}
				}
			`,
		});

		if (!bids.data || !bids.data.challengeBids) {
			this.logger.warn('No Bids V1 found.');
			return;
		}

		// mapping
		this.fetchedBids = bids.data.challengeBids.items as BidsQueryItem[];
		const mapped: BidsQueryItemMapping = {};
		for (const i of this.fetchedBids) {
			mapped[i.id] = i;
		}

		// upsert
		this.fetchedBidsMapping = { ...this.fetchedBidsMapping, ...mapped };
	}
}
