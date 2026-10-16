import { BadRequestException } from '@nestjs/common';
import { zeroAddress } from 'viem';
import { AddressPipe, parseAddress, ZERO_ADDRESS_KEYWORDS } from './address.pipe';

const MIXED_CASE = '0x75bEb37A3c86eE4C38931E2A9319e078da612979';
const LOWER = '0x75beb37a3c86ee4c38931e2a9319e078da612979';

describe('parseAddress', () => {
	it('lowercases a valid mixed-case address without checksum check', () => {
		expect(parseAddress(MIXED_CASE, 'address')).toBe(LOWER);
	});

	it('keeps a lowercase address', () => {
		expect(parseAddress(LOWER, 'address')).toBe(LOWER);
	});

	it.each(['x"', '0x1234" OR "1"="1', '0x1234', `${LOWER}0`, 'all', 'abc'])('rejects %p', (value) => {
		expect(() => parseAddress(value, 'address')).toThrow(BadRequestException);
	});

	it('rejects arrays and objects', () => {
		expect(() => parseAddress([LOWER, LOWER], 'collateral')).toThrow(BadRequestException);
		expect(() => parseAddress({ a: LOWER }, 'collateral')).toThrow(BadRequestException);
	});

	it.each(ZERO_ADDRESS_KEYWORDS)('maps keyword %p to zeroAddress when allowed', (keyword) => {
		expect(parseAddress(keyword, 'address', { allowKeywords: true })).toBe(zeroAddress);
	});

	it('rejects a missing value unless optional', () => {
		expect(() => parseAddress(undefined, 'collateral')).toThrow(BadRequestException);
		expect(() => parseAddress('', 'collateral')).toThrow(BadRequestException);
		expect(parseAddress(undefined, 'mintingHubAddress', { optional: true })).toBeUndefined();
	});

	it('still rejects an invalid optional value', () => {
		expect(() => parseAddress('nope', 'mintingHubAddress', { optional: true })).toThrow(BadRequestException);
	});
});

describe('AddressPipe', () => {
	it('names the parameter in the error message', () => {
		const pipe = new AddressPipe();
		expect(() => pipe.transform('nope', { type: 'query', data: 'collateral' })).toThrow('collateral is not a valid address');
	});
});
