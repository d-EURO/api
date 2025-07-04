import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

// Simply error logging
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach(() => {
			console.error(`[GraphQL error in operation: ${operation?.operationName || 'unknown'}]`);
		});
	}
	if (networkError) {
		console.error(`[Network error in operation: ${operation?.operationName || 'unknown'}]`);
	}
});

const retryLink = new RetryLink({
	delay: {
		initial: 1000,
		max: 5000,
		jitter: true,
	},
	attempts: {
		max: 3,
		retryIf: (error) => {
			// Retry on 5xx errors and network failures
			return !!error && (error.statusCode >= 500 || error.message?.includes('fetch failed'));
		},
	},
});

const httpLink = createHttpLink({
	uri: CONFIG.indexer,
	fetch: (uri: RequestInfo | URL, options?: RequestInit) => {
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			controller.abort();
		}, 60000); // 60 second timeout

		return fetch(uri, {
			...options,
			signal: controller.signal,
		}).finally(() => {
			clearTimeout(timeout);
		});
	},
});

const link = ApolloLink.from([errorLink, retryLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
