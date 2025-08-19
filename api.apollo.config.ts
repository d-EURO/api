import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

const logger = new Logger('ApiApolloConfig');

// Fallback URL management
let fallbackUntil: number | null = null;

function getIndexerUrl(): string {
	if (fallbackUntil && Date.now() < fallbackUntil) return CONFIG.indexerFallback;
	if (fallbackUntil) fallbackUntil = null; // Reset expired fallback
	return CONFIG.indexer;
}

function activateFallback(): void {
	if (!fallbackUntil) {
		fallbackUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
		logger.log(`[Ponder] Switching to fallback for 10min: ${CONFIG.indexerFallback}`);
	}
}

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			logger.error(`[GraphQL error in operation: ${operation?.operationName || 'unknown'}]`, {
				message: error.message,
				locations: error.locations,
				path: error.path,
			});
		});
	}
	if (networkError) {
		logger.error(`[Network error in operation: ${operation?.operationName || 'unknown'}]`, {
			message: networkError.message,
			name: networkError.name,
			stack: networkError.stack,
		});

		// Activate fallback on network errors
		if (getIndexerUrl() === CONFIG.indexer) activateFallback();
	}
});

const httpLink = createHttpLink({
	uri: getIndexerUrl(),
	fetch: (uri: RequestInfo | URL, options?: RequestInit) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, 10000); // 10 second timeout

		return fetch(uri, {
			...options,
			signal: controller.signal,
		})
			.catch((error) => {
				// Activate fallback on http errors
				if (getIndexerUrl() === CONFIG.indexer) activateFallback();
				throw error;
			})
			.finally(() => {
				clearTimeout(timeout);
			});
	},
});

const link = ApolloLink.from([errorLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
