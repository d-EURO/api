// @dev: timestamps of last trigger emits
export type TelegramState = {
	minterApplied: number;
	minterVetoed: number;
	leadrateProposal: number;
	leadrateChanged: number;
	positions: number;
	positionsMiniLifetime: number;
	positionsExpiringSoon: number;
	positionsExpired: number;
	positionsPhase2: number;
	challenges: number;
	bids: number;
};

export type TelegramSubscriptionState = {
	mintingUpdates: number;
	savingUpdates: number;
	frontendCodeUpdates: number;
	tradeUpdates: number;
};

export type TelegramGroupState = {
	apiVersion: string;
	createdAt: number;
	updatedAt: number;
	groups: string[];
};
