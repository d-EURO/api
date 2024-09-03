import { IsArray, IsString, IsNumber, IsOptional, IsObject, ValidateNested } from 'class-validator';

export class Groups {
	@IsString()
	apiVersion: string;

	@IsNumber()
	createdAt: number;

	@IsNumber()
	updatedAt: number;

	@IsArray()
	@IsString({ each: true })
	groups: string[];

	@IsOptional() // @dev: for backwards compatible states
	@IsArray()
	@IsString({ each: true })
	ignore?: string[];

	@IsOptional() // @dev: for backwards compatible states
	@IsObject()
	@ValidateNested({ each: true })
	subscription?: Subscription;
}

export type Subscription = {
	[key: string]: SubscriptionGroups;
};

export class SubscriptionGroups {
	constructor() {
		this.groups = [];
	}

	@IsArray()
	@IsString({ each: true })
	groups: string[];
}
