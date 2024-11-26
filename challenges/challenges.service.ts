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
import { ADDRESS, MintingHubV1ABI, MintingHubV2ABI } from '@frankencoin/zchf';

@Injectable()
export class ChallengesService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedChallengesMapping: ChallengesQueryItemMapping = {};
	private fetchedBidsMapping: BidsQueryItemMapping = {};
	private fetchedPrices: ChallengesPricesMapping = {};

	constructor() {}

	getChallenges(): ApiChallengesListing {
		return {
			num: Object.keys(this.fetchedChallengesMapping).length,
			list: Object.values(this.fetchedChallengesMapping),
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
		for (const challenge of Object.values(this.fetchedChallengesMapping)) {
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
		for (const challenge of Object.values(this.fetchedChallengesMapping)) {
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
			num: Object.values(this.fetchedBidsMapping).length,
			list: Object.values(this.fetchedBidsMapping),
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
		for (const bid of Object.values(this.fetchedBidsMapping)) {
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
		for (const bid of Object.values(this.fetchedBidsMapping)) {
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
		for (const bid of Object.values(this.fetchedBidsMapping)) {
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
		const id = VIEM_CONFIG.chain.id;
		for (const c of active) {
			const price = await VIEM_CONFIG.readContract({
				abi: c.version === 1 ? MintingHubV1ABI : MintingHubV2ABI,
				address: c.version === 1 ? ADDRESS[id].mintingHubV1 : ADDRESS[id].mintingHubV2,
				functionName: 'price',
				args: [parseInt(c.number.toString())],
			});

			challengesPrices[c.id] = price.toString();
		}

		// upsert
		this.fetchedPrices = { ...this.fetchedPrices, ...challengesPrices };
	}

	// --------------------------------------------------------------------------
	async updateChallengeV1s() {
		this.logger.debug('Updating Challenges V1');
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

		if (!challenges.data || !challenges?.data?.challengeV1s?.items?.length) {
			this.logger.warn('No Challenge V1 found.');
			return;
		}

		// mapping
		const list = challenges.data.challengeV1s.items as ChallengesQueryItem[];
		const mapped: ChallengesQueryItemMapping = {};
		for (const i of list) {
			mapped[i.id] = i;
			mapped[i.id].version = 1;
		}

		// upsert
		this.fetchedChallengesMapping = { ...this.fetchedChallengesMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateBidV1s() {
		this.logger.debug('Updating Bids V1');
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

		if (!bids.data || !bids.data?.challengeBidV1s?.items?.length) {
			this.logger.warn('No Bids V1 found.');
			return;
		}

		// mapping
		const list = bids.data.challengeBidV1s.items as BidsQueryItem[];
		const mapped: BidsQueryItemMapping = {};
		for (const i of list) {
			mapped[i.id] = i;
			mapped[i.id].version = 1;
		}

		// upsert
		this.fetchedBidsMapping = { ...this.fetchedBidsMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateChallengeV2s() {
		this.logger.debug('Updating Challenges V2');
		const challenges = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					challengeV2s(orderBy: "status", orderDirection: "asc", limit: 1000) {
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

		if (!challenges.data || !challenges?.data?.challengeV2s?.items?.length) {
			this.logger.warn('No Challenge V2 found.');
			return;
		}

		// mapping
		const list = challenges.data.challengeV2s.items as ChallengesQueryItem[];
		const mapped: ChallengesQueryItemMapping = {};
		for (const i of list) {
			mapped[i.id] = i;
			mapped[i.id].version = 2;
		}

		// upsert
		this.fetchedChallengesMapping = { ...this.fetchedChallengesMapping, ...mapped };
	}

	// --------------------------------------------------------------------------
	async updateBidV2s() {
		this.logger.debug('Updating Bids V2');
		const bids = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					challengeBidV2s(orderBy: "created", orderDirection: "desc", limit: 1000) {
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

		if (!bids.data || !bids.data?.challengeBidV2s?.items?.length) {
			this.logger.warn('No Bids V2 found.');
			return;
		}

		// mapping
		const list = bids.data.challengeBidV2s.items as BidsQueryItem[];
		const mapped: BidsQueryItemMapping = {};
		for (const i of list) {
			mapped[i.id] = i;
			mapped[i.id].version = 2;
		}

		// upsert
		this.fetchedBidsMapping = { ...this.fetchedBidsMapping, ...mapped };
	}
}
