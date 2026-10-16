import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Address, isAddress, zeroAddress } from 'viem';

export const ZERO_ADDRESS_KEYWORDS: string[] = ['0', 'all', 'zero', 'zeroAddress', zeroAddress];

export interface AddressPipeOptions {
	// maps ZERO_ADDRESS_KEYWORDS to zeroAddress
	allowKeywords?: boolean;
	// missing value passes through as undefined
	optional?: boolean;
}

// Validates a request value as a single address and returns it lowercased.
// Mixed case is accepted without checksum check, as before.
export function parseAddress(value: unknown, name: string, options: AddressPipeOptions = {}): Address | undefined {
	if (value === undefined || value === '') {
		if (options.optional) return undefined;
		throw new BadRequestException(`${name} is required`);
	}

	if (typeof value !== 'string') {
		throw new BadRequestException(`${name} must be a single address`);
	}

	if (options.allowKeywords && ZERO_ADDRESS_KEYWORDS.includes(value)) return zeroAddress;

	if (!isAddress(value, { strict: false })) {
		throw new BadRequestException(`${name} is not a valid address`);
	}

	return value.toLowerCase() as Address;
}

@Injectable()
export class AddressPipe implements PipeTransform<unknown, Address | undefined> {
	constructor(private readonly options: AddressPipeOptions = {}) {}

	transform(value: unknown, metadata: ArgumentMetadata): Address | undefined {
		return parseAddress(value, metadata.data ?? 'address', this.options);
	}
}
