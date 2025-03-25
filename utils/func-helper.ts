import { CONFIG } from 'api.config';

export function ExplorerAddressUrl(address: string): string {
	return CONFIG.chain.blockExplorers.default.url + `/address/${address}`;
}

export function ExplorerTxUrl(tx: string): string {
	return CONFIG.chain.blockExplorers.default.url + `/tx/${tx}`;
}

export function AppUrl(path: string): string {
	return `${CONFIG.chain.id == 1 ? 'https://app.deuro.com' : 'https://dev.app.deuro.com'}${path}`;
}
