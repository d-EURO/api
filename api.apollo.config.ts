import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

// Fallback URL management
let fallbackUntil: number | null = null;
const FALLBACK_URL = 'https://dev.ponder.deuro.com/';

function getIndexerUrl(): string {
	if (fallbackUntil && Date.now() < fallbackUntil) return FALLBACK_URL;
	if (fallbackUntil) fallbackUntil = null; // Reset expired fallback
	return CONFIG.indexer;
}

function activateFallback(): void {
	if (!fallbackUntil) {
		fallbackUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
		console.log('[Ponder] Switching to fallback for 10min:', FALLBACK_URL);
	}
}

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			console.error(`[GraphQL error in operation: ${operation?.operationName || 'unknown'}]`, {
				message: error.message,
				locations: error.locations,
				path: error.path,
			});
		});
	}
	if (networkError) {
		console.error(`[Network error in operation: ${operation?.operationName || 'unknown'}]`, {
			message: networkError.message,
			name: networkError.name,
			stack: networkError.stack,
		});
		
		// Activate fallback on network errors
		if (getIndexerUrl() === CONFIG.indexer) activateFallback();
	}
});

const httpLink = createHttpLink({
	uri: getIndexerUrl,
	fetch: (uri: RequestInfo | URL, options?: RequestInit) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, 10000); // 10 second timeout

		return fetch(uri, {
			...options,
			signal: controller.signal,
		}).catch((error) => {
			if (getIndexerUrl() === CONFIG.indexer) activateFallback();
			throw error;
		}).finally(() => {
			clearTimeout(timeout);
		});
	},
});

const link = ApolloLink.from([errorLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
