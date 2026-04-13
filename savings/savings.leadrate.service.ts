import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.apollo.config';
import {
	ApiLeadrateInfo,
	ApiLeadrateProposed,
	ApiLeadrateRate,
	ApiLeadrateVersionInfo,
	LeadrateProposed,
	LeadrateRateObjectArray,
	LeadrateRateProposedObjectArray,
	LeadrateRateQuery,
} from './savings.leadrate.types';
import { Address } from 'viem';

@Injectable()
export class SavingsLeadrateService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedRates: LeadrateRateObjectArray = {};
	private fetchedProposals: LeadrateRateProposedObjectArray = {};

	getRates(): ApiLeadrateRate {
		const l = Object.values(this.fetchedRates);
		const h = l.sort((a, b) => b.blockheight - a.blockheight);
		const n = h.length === 0;
		return {
			created: n ? 0 : h[0].created,
			blockheight: n ? 0 : h[0].blockheight,
			rate: n ? 0 : h[0].approvedRate,
			num: l.length,
			list: l,
		};
	}

	getProposals(): ApiLeadrateProposed {
		const l = Object.values(this.fetchedProposals);
		const h = l.sort((a, b) => b.blockheight - a.blockheight);
		const n = h.length === 0;
		return {
			created: n ? 0 : h[0]?.created || 0,
			blockheight: n ? 0 : h[0]?.blockheight || 0,
			nextRate: n ? 0 : h[0]?.nextRate,
			nextchange: n ? 0 : h[0]?.nextChange,
			num: l.length,
			list: l,
		};
	}

	getInfo(): ApiLeadrateInfo {
		return {
			v2: this.getVersionInfo('v2'),
			v3: this.getVersionInfo('v3'),
		};
	}

	private getVersionInfo(source: string): ApiLeadrateVersionInfo {
		const rates = Object.values(this.fetchedRates)
			.filter((r) => r.source === source)
			.sort((a, b) => b.blockheight - a.blockheight);
		const proposals = Object.values(this.fetchedProposals)
			.filter((p) => p.source === source)
			.sort((a, b) => b.blockheight - a.blockheight);

		const rate = rates.length > 0 ? rates[0].approvedRate : 0;
		const latestProposal = proposals.length > 0 ? proposals[0] : null;

		const isProposal = latestProposal != null && rate != latestProposal.nextRate;
		const isPending = latestProposal != null && latestProposal.nextChange * 1000 >= Date.now();

		return {
			rate,
			nextRate: isProposal ? latestProposal!.nextRate : undefined,
			nextchange: isProposal ? latestProposal!.nextChange : undefined,
			isProposal,
			isPending,
		};
	}

	async updateLeadrateRates() {
		this.logger.debug('Updating leadrate rates');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsRateChanged {
					savingsRateChangeds(orderBy: "blockheight", orderDirection: "desc") {
						items {
							id
							created
							blockheight
							txHash
							approvedRate
							source
						}
					}
				}
			`,
		});

		if (!data || !data?.savingsRateChangeds?.items) {
			this.logger.warn('No leadrates rates found.');
			return;
		}

		const list: LeadrateRateObjectArray = {};
		for (const r of data.savingsRateChangeds.items as LeadrateRateQuery[]) {
			list[r.id] = {
				id: r.id,
				created: parseInt(r.created as any),
				blockheight: parseInt(r.blockheight as any),
				txHash: r.txHash,
				approvedRate: r.approvedRate,
				source: r.source,
			} as LeadrateRateQuery;
		}

		const a = Object.keys(list).length;
		const b = Object.keys(this.fetchedRates).length;
		const isDiff = a !== b;

		if (isDiff) this.logger.log(`Leadrate Rates merging, from ${b} to ${a} entries`);
		this.fetchedRates = { ...this.fetchedRates, ...list };
	}

	async updateLeadrateProposals() {
		this.logger.debug('Updating leadrate proposals');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query GetSavingsRateProposed {
					savingsRateProposeds(orderBy: "blockheight", orderDirection: "desc") {
						items {
							id
							created
							blockheight
							txHash
							proposer
							nextRate
							nextChange
							source
						}
					}
				}
			`,
		});

		if (!data || !data?.savingsRateProposeds?.items) {
			this.logger.warn('No leadrates proposals found.');
			return;
		}

		const list: LeadrateRateProposedObjectArray = {};
		for (const r of data.savingsRateProposeds.items as LeadrateProposed[]) {
			list[r.id] = {
				id: r.id,
				created: parseInt(r.created as any),
				blockheight: parseInt(r.blockheight as any),
				txHash: r.txHash,
				proposer: r.proposer as Address,
				nextRate: r.nextRate,
				nextChange: r.nextChange,
				source: r.source,
			} as LeadrateProposed;
		}

		const a = Object.keys(list).length;
		const b = Object.keys(this.fetchedProposals).length;
		const isDiff = a !== b;

		if (isDiff) this.logger.log(`Leadrate Proposal merging, from ${b} to ${a} entries`);
		this.fetchedProposals = { ...this.fetchedProposals, ...list };
	}
}
