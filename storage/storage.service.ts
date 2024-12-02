import { Injectable, Logger, ValidationError } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync, writeFileSync } from 'fs';

@Injectable()
export class StorageService {
	private readonly logger = new Logger(this.constructor.name);

	private readonly groupsFile: string = CONFIG.telegramGroupsJson;

	async write(data: any): Promise<void> {
		writeFileSync(this.groupsFile, JSON.stringify(data));
	}

	async read<T extends object>(
		dtoClassConstructor?: ClassConstructor<T>
	): Promise<{ data: T; validationError: ValidationError[]; messageError: string }> {
		try {
			this.logger.log(`Reading backup groups from file ${this.groupsFile}`);

			const body = JSON.parse(readFileSync(this.groupsFile, 'utf-8'));
			const dto = plainToInstance<T, typeof body>(dtoClassConstructor, body);
			const validationError = dtoClassConstructor ? await validate(dto) : [];

			return {
				data: dto,
				validationError,
				messageError: '',
			};
		} catch (error) {
			return {
				data: new dtoClassConstructor(),
				validationError: [],
				messageError: error?.Code || error?.code || error?.message,
			};
		}
	}
}
