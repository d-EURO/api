import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

const logger = new Logger('ApiApolloConfig');

let fallbackUntil: number | null = null;

function getIndexerUrl(): string {
	return fallbackUntil && Date.now() < fallbackUntil 
		? CONFIG.indexerFallback 
		: CONFIG.indexer;
}

function activateFallback(): void {
	if (!fallbackUntil) {
		fallbackUntil = Date.now() + 10 * 60 * 1000;
		logger.log(`[Ponder] Switching to fallback for 10min: ${CONFIG.indexerFallback}`);
	}
}

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
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

		if (getIndexerUrl() === CONFIG.indexer) {
			const is503 =
				(networkError as any)?.response?.status === 503 ||
				(networkError as any)?.statusCode === 503 ||
				(networkError as any)?.result?.status === 503;

			if (is503) {
				logger.log('[Ponder] 503 Service Unavailable - Ponder is syncing, switching to fallback');
			} else {
				logger.log('[Ponder] Network error detected, activating fallback');
			}
			activateFallback();
			return forward(operation);
		}
	}
});

const httpLink = createHttpLink({
	uri: () => getIndexerUrl(),
	fetch: (uri: RequestInfo | URL, options?: RequestInit) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, 10000);

		return fetch(uri, {
			...options,
			signal: controller.signal,
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
