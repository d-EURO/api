import { Address, getAddress, zeroAddress } from 'viem';

/** Lowercase 0x address for Ponder GraphQL filters (indexed storage is lowercase). */
export function addressForPonderFilter(addr: Address): Address {
	if (addr === zeroAddress) return zeroAddress;
	return getAddress(addr).toLowerCase() as Address;
}

/** Validates with getAddress, returns lowercase hex for keys and API fields. */
export function normalizedAddress(addr: string): Address {
	return getAddress(addr as `0x${string}`).toLowerCase() as Address;
}
