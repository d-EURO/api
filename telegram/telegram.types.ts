import { SubscriptionGroups } from './dtos/groups.dto';

export type TelegramState = {
	minterApplied: number;
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
