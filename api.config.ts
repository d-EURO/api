import { Address, Chain, createPublicClient, http, zeroAddress } from 'viem';
import { ADDRESS } from '@deuro/eurocoin';
import { mainnet, polygon } from 'viem/chains';

import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

// Verify environment
if (process.env.RPC_URL_MAINNET === undefined) throw new Error('RPC_URL_MAINNET not available');
if (process.env.RPC_URL_POLYGON === undefined) throw new Error('RPC_URL_POLYGON not available');
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
	coingeckoApiKey: process.env.COINGECKO_API_KEY,
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
export const COINGECKO_CLIENT = (query: string) => {
	const hasParams = query.includes('?');
	const uri: string = `https://pro-api.coingecko.com${query}`;
	return fetch(`${uri}${hasParams ? '&' : '?'}x_cg_pro_api_key=${CONFIG.coingeckoApiKey}`);
};

// Contract addresses for the active chain
export const ADDR = ADDRESS[CONFIG.chain.id];

export function isDeployed(addr: string | undefined): addr is Address {
	return !!addr && addr !== zeroAddress;
}

export function isV3Hub(hubAddress: Address): boolean {
	return isDeployed(ADDR.mintingHub) && hubAddress.toLowerCase() === ADDR.mintingHub.toLowerCase();
}
