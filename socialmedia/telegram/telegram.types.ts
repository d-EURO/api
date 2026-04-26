// @dev: timestamps of last trigger emits. Position-lifecycle events use per-address
// dedup persisted in TelegramGroupState (alerted* arrays) instead of a single timestamp,
// because a single timestamp cannot correctly handle: service restart with already-
// actionable positions, telegram outage, ponder reorg/back-fill, or partial delivery.
export type TelegramState = {
	minterApplied: number;
	minterVetoed: number;
	leadrateProposal: number;
	leadrateChanged: number;
	positions: number;
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
	alertedMiniLifetime: string[];
	alertedExpiringSoon: string[];
	alertedExpired: string[];
	alertedPhase2: string[];
};
