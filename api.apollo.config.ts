import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

const logger = new Logger('ApiApolloConfig');

const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
let fallbackUntil: number | null = null;

function getIndexerUrl(): string {
	return fallbackUntil && Date.now() < fallbackUntil ? CONFIG.indexerFallback : CONFIG.indexer;
}

function activateFallback(): void {
	// Re-arm when the previous window has expired so a sustained outage
	// keeps the fallback engaged instead of silently flipping back to primary.
	if ((!fallbackUntil || Date.now() >= fallbackUntil) && CONFIG.indexerFallback) {
		fallbackUntil = Date.now() + FALLBACK_WINDOW_MS;
		logger.log(`[Ponder] Switching to fallback for 10min: ${CONFIG.indexerFallback}`);
	}
}

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
	const opName = operation?.operationName || 'unknown';

	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			logger.error(`[GraphQL error in operation: ${opName}] ${error.message}`);
		});
	}

	if (networkError) {
		const hasFallback = !!CONFIG.indexerFallback;
		const onFallback = getIndexerUrl() !== CONFIG.indexer;
		const willRecover = hasFallback && !onFallback;
		const msg = `[Network error in operation: ${opName}] ${networkError.message}`;

		if (willRecover) {
			// Primary failed, fallback hasn't been engaged this window — log
			// at warn so transparent retries don't inflate error-rate panels.
			logger.warn(msg);
			activateFallback();
			return forward(operation);
		}

		// No fallback configured, or already on fallback — nothing more to try.
		logger.error(msg);
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
