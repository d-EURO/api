import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
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

// Stamps each attempt with its target URL so errors are attributed to the URL
// the request was actually sent to, not the routing state at error time.
const routingLink = new ApolloLink((operation, forward) => {
	operation.setContext({ targetUrl: getIndexerUrl() });
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
		const sentToFallback = !!CONFIG.indexerFallback && operation.getContext().targetUrl === CONFIG.indexerFallback;

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

// Retries transport-level failures (e.g. a stale keep-alive socket closing
// mid-response) before they reach errorLink, so a one-off blip self-heals
// instead of tripping the fallback/error path.
const retryLink = new RetryLink({
	delay: { initial: 200, max: 2000, jitter: true },
	attempts: { max: 3, retryIf: (error) => !!error },
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

const link = ApolloLink.from([errorLink, routingLink, retryLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
