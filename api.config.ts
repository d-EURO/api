import { Chain, createPublicClient, http } from 'viem';
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

// Start up message
const logger = new Logger('ApiConfig');
logger.log(`Starting API with this config:`);
logger.log(CONFIG);

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
