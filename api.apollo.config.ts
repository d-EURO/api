import { ApolloClient, ApolloError, ApolloLink, createHttpLink, InMemoryCache, Observable } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { Logger } from '@nestjs/common';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

const logger = new Logger('ApiApolloConfig');

const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
let fallbackUntil: number | null = null;

// A fallback only exists if it points to a different indexer. The deployment
// environments set it equal to the primary when no second indexer exists.
const normalizeUrl = (url: string): string => url.replace(/\/+$/, '');
const HAS_FALLBACK = !!CONFIG.indexerFallback && normalizeUrl(CONFIG.indexerFallback) !== normalizeUrl(CONFIG.indexer);

// Outage state: the first final network failure is logged as error, the
// following ones as warn, until the next successful response.
let outageSince: number | null = null;
let outageFailedOperations = 0;

function reportIndexerFailure(msg: string): void {
	outageFailedOperations += 1;
	if (outageSince === null) {
		outageSince = Date.now();
		logger.error(msg);
	} else {
		logger.warn(msg);
	}
}

function reportIndexerReachable(): void {
	if (outageSince === null) return;
	const seconds = Math.round((Date.now() - outageSince) / 1000);
	logger.log(`[Ponder] Indexer reachable again after ${seconds}s (${outageFailedOperations} failed operations)`);
	outageSince = null;
	outageFailedOperations = 0;
}

export function isIndexerNetworkError(err: unknown): boolean {
	return err instanceof ApolloError && !!err.networkError;
}

function isFallbackActive(): boolean {
	return fallbackUntil !== null && Date.now() < fallbackUntil;
}

function getIndexerUrl(): string {
	return isFallbackActive() ? CONFIG.indexerFallback : CONFIG.indexer;
}

function activateFallback(): void {
	if (!isFallbackActive() && HAS_FALLBACK) {
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

	// Without a distinct fallback there is nothing more to try: the failure is
	// final and reported by outageLink.
	if (networkError && HAS_FALLBACK && operation.getContext().targetUrl !== CONFIG.indexerFallback) {
		// Primary failed and a fallback exists — log at warn so transparent
		// retries don't inflate error-rate panels.
		logger.warn(`[Network error in operation: ${opName}] ${networkError.message}`);
		activateFallback();
		return forward(operation);
	}
});

// Outermost link: sees each operation's final outcome once, after retries and
// a possible fallback attempt. Errors reaching it are network errors; a result
// (even one carrying GraphQL errors) means the indexer is reachable.
const outageLink = new ApolloLink(
	(operation, forward) =>
		new Observable((observer) => {
			const sub = forward(operation).subscribe({
				next: (result) => {
					reportIndexerReachable();
					observer.next(result);
				},
				error: (err) => {
					reportIndexerFailure(`[Network error in operation: ${operation.operationName || 'unknown'}] ${err?.message ?? err}`);
					observer.error(err);
				},
				complete: () => observer.complete(),
			});
			return () => sub.unsubscribe();
		})
);

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

const link = ApolloLink.from([outageLink, errorLink, routingLink, retryLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
