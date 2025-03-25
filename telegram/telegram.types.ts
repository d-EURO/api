import { SubscriptionGroups } from './dtos/groups.dto';

// @dev: timestamps of last trigger emits
export type TelegramState = {
	minterApplied: number;
	minterVetoed: number;
	leadrateProposal: number;
	leadrateChanged: number;
	positions: number;
	mintingUpdates: number;
	challenges: number;
	bids: number;
};

export type TelegramGroupState = {
	apiVersion: string;
	createdAt: number;
	updatedAt: number;
	groups: string[];
	ignore: string[];
	subscription: {
		[key: string]: SubscriptionGroups;
	};
};
