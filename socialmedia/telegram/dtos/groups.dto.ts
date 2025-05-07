import { IsArray, IsNumber, IsString } from 'class-validator';

export class Groups {
	// @dev: react/nextjs/ts causes type error. (lint in yarn install, deployment)
	// Type error: Property 'apiVersion' has no initializer and is not definitely assigned in the constructor.
	constructor() {
		this.apiVersion = '';
		this.createdAt = 0;
		this.updatedAt = 0;
		this.groups = [];
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
}
