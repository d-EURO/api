import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types
export type ChallengesQueryItem = {
	version: number;

	id: ChallengesId;
	position: Address;
	number: bigint;

	challenger: Address;
	start: bigint;
	created: bigint;
	duration: bigint;
	size: bigint;
	liqPrice: bigint;

	bids: bigint;
	filledSize: bigint;
	acquiredCollateral: bigint;
	status: ChallengesStatus;
};

export type BidsQueryItem = {
	version: number;

	id: BidsId;
	position: Address;
	number: bigint;
	numberBid: bigint;

	bidder: Address;
	created: bigint;
	bidType: BidsType;
	bid: bigint;
	price: bigint;

	filledSize: bigint;
	acquiredCollateral: bigint;
	challengeSize: bigint;
};

// --------------------------------------------------------------------------
// Service Challenges
export enum ChallengesQueryStatus {
	Active = 'Active',
	Success = 'Success',
}
export type ChallengesStatus = ChallengesQueryStatus;
export type ChallengesId = `${Address}-challenge-${bigint}`;

export type ChallengesQueryItemMapping = {
	[key: ChallengesId]: ChallengesQueryItem;
};

export type ChallengesChallengersMapping = { [key: Address]: ChallengesQueryItem[] };
export type ChallengesPositionsMapping = { [key: Address]: ChallengesQueryItem[] };
export type ChallengesPricesMapping = { [key: ChallengesId]: string };

// Service Bids
export enum BidsQueryType {
	Averted = 'Averted',
	Succeeded = 'Succeeded',
}
export type BidsType = BidsQueryType;
export type BidsId = `${Address}-challenge-${bigint}-bid-${bigint}`;

export type BidsQueryItemMapping = {
	[key: BidsId]: BidsQueryItem;
};

export type BidsBidderMapping = { [key: Address]: BidsQueryItem[] };
export type BidsChallengesMapping = { [key: Address]: BidsQueryItem[] };
export type BidsPositionsMapping = { [key: Address]: BidsQueryItem[] };

// --------------------------------------------------------------------------
// Api Challenges

export type ApiChallengesListing = {
	num: number;
	list: ChallengesQueryItem[];
};

export type ApiChallengesMapping = {
	num: number;
	challenges: ChallengesId[];
	map: ChallengesQueryItemMapping;
};

export type ApiChallengesChallengers = {
	num: number;
	challengers: Address[];
	map: ChallengesChallengersMapping;
};

export type ApiChallengesPositions = {
	num: number;
	positions: Address[];
	map: ChallengesPositionsMapping;
};

// Api Bids
export type ApiBidsListing = {
	num: number;
	list: BidsQueryItem[];
};

export type ApiBidsMapping = {
	num: number;
	bidIds: BidsId[];
	map: BidsQueryItemMapping;
};

export type ApiBidsBidders = {
	num: number;
	bidders: Address[];
	map: BidsBidderMapping;
};

export type ApiBidsChallenges = {
	num: number;
	challenges: Address[];
	map: BidsChallengesMapping;
};

export type ApiBidsPositions = {
	num: number;
	positions: Address[];
	map: BidsPositionsMapping;
};

// Api ChallengePrices
export type ApiChallengesPrices = {
	num: number;
	ids: ChallengesId[];
	map: ChallengesPricesMapping;
};
