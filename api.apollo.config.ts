import { ApolloClient, ApolloLink, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import fetch from 'cross-fetch';
import { CONFIG } from './api.config';

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
	}
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

const link = ApolloLink.from([errorLink, httpLink]);

export const PONDER_CLIENT = new ApolloClient({
	link,
	cache: new InMemoryCache(),
});
