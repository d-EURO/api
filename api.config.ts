import { Address, Chain, createPublicClient, http, zeroAddress } from 'viem';
import { ADDRESS } from '@deuro/eurocoin';
import { mainnet, polygon } from 'viem/chains';

import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

// Verify environment
if (process.env.RPC_URL_MAINNET === undefined) throw new Error('RPC_URL_MAINNET not available');
if (process.env.RPC_URL_POLYGON === undefined) throw new Error('RPC_URL_POLYGON not available');
// Either a key for direct Pro access OR a base URL for a fronting pricing proxy
// must be set; otherwise the upstream CoinGecko calls are anonymous and fail
// under load.
if (!process.env.COINGECKO_API_KEY && !process.env.COINGECKO_BASE_URL) {
	throw new Error('CoinGecko is not configured: set COINGECKO_BASE_URL or COINGECKO_API_KEY');
}

// Config type
export type ConfigType = {
	app: string;
	indexer: string;
	indexerFallback: string;
	coingeckoApiKey: string | undefined;
	coingeckoBaseUrl: string | undefined;
	chain: Chain;
	network: {
		mainnet: string;
		polygon: string;
	};
	telegram: {
		botToken: string;
		groupsJson: string;
		imagesDir: string;
	};
	twitter: {
		clientId: string;
		clientSecret: string;
		appKey: string;
		appSecret: string;
		tokenJson: string;
		imagesDir: string;
	};
};

// Create config
export const CONFIG: ConfigType = {
	app: process.env.CONFIG_APP_URL || 'https://app.deuro.com',
	indexer: process.env.CONFIG_INDEXER_URL || 'https://ponder.deuro.com/',
	indexerFallback: process.env.CONFIG_INDEXER_FALLBACK_URL || 'https://dev.ponder.deuro.com/',
	coingeckoApiKey: process.env.COINGECKO_API_KEY || undefined,
	coingeckoBaseUrl: process.env.COINGECKO_BASE_URL || undefined,
	chain: process.env.CONFIG_CHAIN === 'polygon' ? polygon : mainnet, // @dev: default mainnet
	network: {
		mainnet: process.env.RPC_URL_MAINNET,
		polygon: process.env.RPC_URL_POLYGON,
	},
	telegram: {
		botToken: process.env.TELEGRAM_BOT_TOKEN,
		groupsJson: process.env.TELEGRAM_GROUPS_JSON,
		imagesDir: process.env.TELEGRAM_IMAGES_DIR,
	},
	twitter: {
		clientId: process.env.TWITTER_CLIENT_ID,
		clientSecret: process.env.TWITTER_CLIENT_SECRET,
		appKey: process.env.TWITTER_CLIENT_APP_KEY,
		appSecret: process.env.TWITTER_CLIENT_APP_SECRET,
		tokenJson: process.env.TWITTER_TOKEN_JSON,
		imagesDir: process.env.TWITTER_IMAGES_DIR,
	},
};

const SENSITIVE_KEYS = new Set<string>([
	'coingeckoApiKey',
	'network.mainnet',
	'network.polygon',
	'telegram.botToken',
	'twitter.clientSecret',
	'twitter.appKey',
	'twitter.appSecret',
]);

function redactConfig<T>(config: T): T {
	return walkRedact(config, '') as T;
}

function walkRedact(value: unknown, path: string): unknown {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, val]) => {
				const childPath = path ? `${path}.${key}` : key;
				if (SENSITIVE_KEYS.has(childPath) && val) return [key, '***'];
				return [key, walkRedact(val, childPath)];
			})
		);
	}
	return value;
}

export function logConfig() {
	const logger = new Logger('ApiConfig');
	logger.log(`Starting API with this config:`);
	logger.log(JSON.stringify(redactConfig(CONFIG)));
}

// Refer to https://github.com/yagop/node-telegram-bot-api/blob/master/doc/usage.md#sending-files
process.env.NTBA_FIX_350 = 'true';

// VIEM CONFIG
export const VIEM_CHAIN = CONFIG.chain;
export const VIEM_CONFIG = createPublicClient({
	chain: VIEM_CHAIN,
	transport: http(process.env.CONFIG_CHAIN === 'polygon' ? CONFIG.network.polygon : CONFIG.network.mainnet),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

// COINGECKO CLIENT
//
// Resolution priority:
//  1. COINGECKO_BASE_URL set → trust the caller (typically a pricing proxy that
//     injects the upstream key itself); send no auth.
//  2. COINGECKO_API_KEY set → Pro tier: pro-api.coingecko.com with the
//     `x-cg-pro-api-key` header. The earlier query-string form is supported by
//     CoinGecko but cache-poisons proxies that key on the URL.
export const COINGECKO_CLIENT = (query: string) => {
	if (CONFIG.coingeckoBaseUrl) {
		return fetch(`${CONFIG.coingeckoBaseUrl}${query}`);
	}
	// Bootstrap above guarantees one of the two is set, so reaching this
	// branch means coingeckoApiKey is defined. Hard-fail anyway instead of
	// using a `?? ''` default — sending an empty auth header would silently
	// turn into 401 at the upstream and look like a CoinGecko outage rather
	// than the misconfiguration it actually is.
	if (!CONFIG.coingeckoApiKey) {
		throw new Error('CoinGecko is not configured: set COINGECKO_BASE_URL or COINGECKO_API_KEY');
	}
	const uri: string = `https://pro-api.coingecko.com${query}`;
	return fetch(uri, {
		headers: { 'x-cg-pro-api-key': CONFIG.coingeckoApiKey },
	});
};

// Contract addresses for the active chain
export const ADDR = ADDRESS[CONFIG.chain.id];

export function isDeployed(addr: string | undefined): addr is Address {
	return !!addr && addr !== zeroAddress;
}

export function isV3Hub(hubAddress: Address): boolean {
	return isDeployed(ADDR.mintingHub) && hubAddress.toLowerCase() === ADDR.mintingHub.toLowerCase();
}
