import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'api.config';
import {
	ApiLeadrateInfo,
	ApiLeadrateProposed,
	ApiLeadrateRate,
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
		return {
			created: h[0].created,
			blockheight: h[0].blockheight,
			rate: h[0].approvedRate,
			num: l.length,
			list: l,
		};
	}

	getProposals(): ApiLeadrateProposed {
		const l = Object.values(this.fetchedProposals);
		const h = l.sort((a, b) => b.blockheight - a.blockheight);
		return {
			created: h[0]?.created || 0,
			blockheight: h[0]?.blockheight || 0,
			nextRate: h[0]?.nextRate,
			nextchange: h[0]?.nextChange,
			num: l.length,
			list: l,
		};
	}

	getInfo(): ApiLeadrateInfo {
		const r = this.getRates();
		const p = this.getProposals();
		const isDiff = r.rate != p.nextRate;
		const isPending = p.nextchange >= Date.now();
		return {
			rate: r.rate,
			nextRate: p.nextRate,
			nextchange: p.nextchange,
			isProposal: isDiff && isPending,
		};
	}

	async updateLeadrateRates() {
		this.logger.debug('Updating leadrate rates');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					savingsRateChangeds(orderBy: "blockheight", orderDirection: "desc") {
						items {
							id
							created
							blockheight
							approvedRate
						}
					}
				}
			`,
		});

		if (!data || !data.savingsRateChangeds) {
			this.logger.warn('No leadrates rates found.');
			return;
		}

		const list: LeadrateRateObjectArray = {};
		for (const r of data.savingsRateChangeds.items as LeadrateRateQuery[]) {
			list[r.id] = {
				id: parseInt(r.id as any),
				created: parseInt(r.created as any),
				blockheight: parseInt(r.blockheight as any),
				approvedRate: r.approvedRate,
			};
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
				query {
					savingsRateProposeds(orderBy: "blockheight", orderDirection: "desc") {
						items {
							id
							created
							blockheight
							txHash
							proposer
							nextRate
							nextChange
						}
					}
				}
			`,
		});

		if (!data || !data.savingsRateProposeds) {
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
			};
		}

		const a = Object.keys(list).length;
		const b = Object.keys(this.fetchedProposals).length;
		const isDiff = a !== b;

		if (isDiff) this.logger.log(`Leadrate Proposal merging, from ${b} to ${a} entries`);
		this.fetchedProposals = { ...this.fetchedProposals, ...list };
	}
}
