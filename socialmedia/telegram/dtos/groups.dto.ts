import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class Groups {
	// @dev: react/nextjs/ts causes type error. (lint in yarn install, deployment)
	// Type error: Property 'apiVersion' has no initializer and is not definitely assigned in the constructor.
	constructor() {
		this.apiVersion = '';
		this.createdAt = 0;
		this.updatedAt = 0;
		this.groups = [];
		this.alertedMiniLifetime = [];
		this.alertedExpiringSoon = [];
		this.alertedExpired = [];
		this.alertedPhase2 = [];
	}

	@IsString()
	apiVersion: string;

	@IsNumber()
	createdAt: number;

	@IsNumber()
	updatedAt: number;

	@IsArray()
	@IsString({ each: true })
	groups: string[];

	// Per-address alert dedup. Persisting these means a service restart does not silently
	// drop alerts for positions that were actionable when the service went down, and a
	// telegram outage does not lose alerts (positions stay un-listed until delivery
	// confirms). @IsOptional so older backup files without these fields still validate.
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	alertedMiniLifetime: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	alertedExpiringSoon: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	alertedExpired: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	alertedPhase2: string[];
}
