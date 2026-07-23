import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

const logger = new Logger('ApiApolloConfig');

const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
let fallbackUntil: number | null = null;

function isFallbackActive(): boolean {
	return fallbackUntil !== null && Date.now() < fallbackUntil;
}

function getIndexerUrl(): string {
	return isFallbackActive() ? CONFIG.indexerFallback : CONFIG.indexer;
}

function activateFallback(): void {
	if (!isFallbackActive() && CONFIG.indexerFallback) {
		fallbackUntil = Date.now() + FALLBACK_WINDOW_MS;
		logger.warn(`[Ponder] Switching to fallback for ${FALLBACK_WINDOW_MS / 60000}min: ${CONFIG.indexerFallback}`);
	}
}

// Stamps each attempt with the URL it was sent to and whether that was the
// fallback, so errors are attributed to the routing state at SEND time, not
// re-derived from the URL at error time — a bare URL comparison can't tell
// primary from fallback once an operator points the fallback at the same
// host as the primary (the standard way to disable cross-environment
// failover; see CONFIG_INDEXER_FALLBACK_URL in this repo's own deploy config).
const routingLink = new ApolloLink((operation, forward) => {
	operation.setContext({ targetUrl: getIndexerUrl(), usedFallback: isFallbackActive() });
	return forward(operation);
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
	const opName = operation?.operationName || 'unknown';

	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			logger.error(`[GraphQL error in operation: ${opName}] ${error.message}`);
		});
	}

	if (networkError) {
		const msg = `[Network error in operation: ${opName}] ${networkError.message}`;
		const sentToFallback = !!operation.getContext().usedFallback;

		if (CONFIG.indexerFallback && !sentToFallback) {
			// Primary failed and a fallback exists — log at warn so transparent
			// retries don't inflate error-rate panels.
			logger.warn(msg);
			activateFallback();
			return forward(operation);
		}

		// No fallback configured, or the fallback itself failed — nothing more to try.
		logger.error(msg);
	}
});

const httpLink = createHttpLink({
	uri: (operation) => operation.getContext().targetUrl ?? getIndexerUrl(),
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

const link = ApolloLink.from([errorLink, routingLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
