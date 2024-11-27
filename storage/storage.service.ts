import { Injectable, ValidationError } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Injectable()
export class StorageService {
	// TODO: write to file system
	private readonly cache = new Map<string, string>();

	async write(key: string, data: any): Promise<void> {
		this.cache.set(key, JSON.stringify(data));
	}

	async read<T extends object>(
		key: string,
		dtoClassConstructor?: ClassConstructor<T>
	): Promise<{ data: T; validationError: ValidationError[]; messageError: string }> {
		try {
			const body = JSON.parse(this.cache.get(key));
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
