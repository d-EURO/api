import { Address } from 'viem';
// ----------------------------------------------------------------------------------
// Ponder
export type PositionQueryV1 = {
	version: 1;

	position: Address;
	owner: Address;
	zchf: Address;
	collateral: Address;
	price: string;

	created: number;
	isOriginal: boolean;
	isClone: boolean;
	denied: boolean;
	closed: boolean;
	original: Address;

	minimumCollateral: string;
	annualInterestPPM: number;
	reserveContribution: number;
	start: number;
	cooldown: number;
	expiration: number;
	challengePeriod: number;

	zchfName: string;
	zchfSymbol: string;
	zchfDecimals: number;

	collateralName: string;
	collateralSymbol: string;
	collateralDecimals: number;
	collateralBalance: string;

	limitForPosition: string;
	limitForClones: string;
	availableForPosition: string;
	availableForClones: string;
	minted: string;
};

export type PositionQueryV2 = {
	version: 2;

	position: Address;
	owner: Address;
	zchf: Address;
	collateral: Address;
	price: string;

	created: number;
	isOriginal: boolean;
	isClone: boolean;
	denied: boolean;
	closed: boolean;
	original: Address;

	minimumCollateral: string;
	annualInterestPPM: number; // @dev: in V2, sum of leadrate and riskPremium
	riskPremiumPPM: number;
	reserveContribution: number;
	start: number;
	cooldown: number;
	expiration: number;
	challengePeriod: number;

	zchfName: string;
	zchfSymbol: string;
	zchfDecimals: number;

	collateralName: string;
	collateralSymbol: string;
	collateralDecimals: number;
	collateralBalance: string;

	limitForClones: string;
	availableForClones: string;
	availableForMinting: string;
	minted: string;
};

export type PositionQuery = PositionQueryV1 | PositionQueryV2;

export type MintingUpdateQueryId = `${Address}-${number}`;
export type MintingUpdateQuery = {
	id: MintingUpdateQueryId;
	txHash: string;
	created: number;
	position: Address;
	owner: Address;
	isClone: boolean;
	collateral: Address;
	collateralName: string;
	collateralSymbol: string;
	collateralDecimals: number;
	size: string;
	price: string;
	minted: string;
	sizeAdjusted: string;
	priceAdjusted: string;
	mintedAdjusted: string;
	annualInterestPPM: number;
	reserveContribution: number;
	feeTimeframe: number;
	feePPM: number;
	feePaid: string;
};

// ----------------------------------------------------------------------------------
// Service
export type PositionsQueryObjectArray = {
	[key: Address]: PositionQuery;
};

export type OwnersPositionsObjectArray = {
	[key: Address]: PositionQuery[];
};

export type MintingUpdateQueryObjectArray = {
	[key: Address]: MintingUpdateQuery[];
};

// ----------------------------------------------------------------------------------
// Api
export type ApiPositionsListing = {
	num: number;
	list: PositionQuery[];
};

export type ApiPositionsMapping = {
	num: number;
	addresses: Address[];
	map: PositionsQueryObjectArray;
};

export type ApiPositionsOwners = {
	num: number;
	owners: Address[];
	map: OwnersPositionsObjectArray;
};

export type ApiMintingUpdateListing = {
	num: number;
	list: MintingUpdateQuery[];
};

export type ApiMintingUpdateMapping = {
	num: number;
	positions: Address[];
	map: MintingUpdateQueryObjectArray;
};
