import { Address, Chain, createPublicClient, http, zeroAddress } from 'viem';
import { ADDRESS } from '@juicedollar/jusd';
import { Logger } from '@nestjs/common';
import { mainnet, testnet } from 'chains';
import * as dotenv from 'dotenv';
dotenv.config();

// Verify environment
const isMainnet = process.env.CONFIG_CHAIN === 'mainnet';
if (isMainnet && process.env.RPC_URL_MAINNET === undefined) throw new Error('RPC_URL_MAINNET not available');
if (!isMainnet && process.env.RPC_URL_TESTNET === undefined) throw new Error('RPC_URL_TESTNET not available');
if (process.env.COINGECKO_API_KEY === undefined) throw new Error('COINGECKO_API_KEY not available');

// Config type
export type ConfigType = {
	app: string;
	indexer: string;
	indexerFallback: string;
	coingeckoApiKey: string;
	chain: Chain;
	network: {
		mainnet: string;
		testnet: string;
	};
	telegram: {
		botToken: string;
		groupsJson: string;
		imagesDir: string;
	} | null;
	twitter: {
		accessToken: string;
		accessSecret: string;
		appKey: string;
		appSecret: string;
		imagesDir: string;
	} | null;
};

// Create config
export const CONFIG: ConfigType = {
	app: process.env.CONFIG_APP_URL,
	indexer: process.env.CONFIG_INDEXER_URL,
	indexerFallback: process.env.CONFIG_INDEXER_FALLBACK_URL,
	coingeckoApiKey: process.env.COINGECKO_API_KEY,
	chain: isMainnet ? mainnet : testnet,
	network: {
		mainnet: process.env.RPC_URL_MAINNET,
		testnet: process.env.RPC_URL_TESTNET,
	},
	telegram: process.env.TELEGRAM_BOT_TOKEN
		? {
				botToken: process.env.TELEGRAM_BOT_TOKEN,
				groupsJson: process.env.TELEGRAM_GROUPS_JSON,
				imagesDir: process.env.TELEGRAM_IMAGES_DIR,
			}
		: null,
	twitter: process.env.TWITTER_CLIENT_APP_KEY
		? {
				appKey: process.env.TWITTER_CLIENT_APP_KEY,
				appSecret: process.env.TWITTER_CLIENT_APP_SECRET,
				accessToken: process.env.TWITTER_ACCESS_TOKEN,
				accessSecret: process.env.TWITTER_ACCESS_SECRET,
				imagesDir: process.env.TWITTER_IMAGES_DIR,
			}
		: null,
};

const SENSITIVE_KEYS = new Set<string>([
	'coingeckoApiKey',
	'network.mainnet',
	'network.testnet',
	'telegram.botToken',
	'twitter.appKey',
	'twitter.appSecret',
	'twitter.accessToken',
	'twitter.accessSecret',
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
	transport: http(isMainnet ? CONFIG.network.mainnet : CONFIG.network.testnet),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

// COINGECKO CLIENT
export const COINGECKO_CLIENT = (query: string) => {
	const hasParams = query.includes('?');
	const uri: string = `https://pro-api.coingecko.com${query}`;
	return fetch(`${uri}${hasParams ? '&' : '?'}x_cg_pro_api_key=${CONFIG.coingeckoApiKey}`);
};

export const PROTOCOL_STABLECOIN_SYMBOL = 'JUSD';
export const PROTOCOL_STABLECOIN_NAME = 'Juice Dollar';
export const POOL_SHARES_SYMBOL = 'JUICE';

// Contract addresses for the active chain
export const ADDR = ADDRESS[CONFIG.chain.id];

export function isDeployed(addr: string | undefined): addr is Address {
	return !!addr && addr !== zeroAddress;
}

export function isV3Hub(hubAddress: Address): boolean {
	return isDeployed(ADDR.mintingHub) && hubAddress.toLowerCase() === ADDR.mintingHub.toLowerCase();
}
