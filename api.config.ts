import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { http, createPublicClient, Chain } from 'viem';
import { mainnet, polygon } from 'viem/chains';

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
	coingeckoApiKey: string;
	chain: Chain;
	network: {
		mainnet: string;
		polygon: string;
	};
};

// Create config
export const CONFIG: ConfigType = {
	app: process.env.CONFIG_APP_URL || 'https://app.frankencoin.com',
	indexer: process.env.CONFIG_INDEXER_URL || 'https://ponder.frankencoin.com',
	coingeckoApiKey: process.env.COINGECKO_API_KEY,
	chain: process.env.CONFIG_CHAIN === 'polygon' ? polygon : mainnet, // @dev: default mainnet
	network: {
		mainnet: process.env.RPC_URL_MAINNET,
		polygon: process.env.RPC_URL_POLYGON,
	},
};

// Start up message
console.log(`Starting API with this config:`);
console.log(CONFIG);

// PONDER CLIENT REQUEST
export const PONDER_CLIENT = new ApolloClient({
	uri: CONFIG.indexer,
	cache: new InMemoryCache(),
});

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
	const uri: string = `https://api.coingecko.com${query}`;
	return fetch(`${uri}${hasParams ? '&' : '?'}${CONFIG.coingeckoApiKey}`);
};
