import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CONFIG, VIEM_CONFIG } from 'api.config';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemDepsService } from 'ecosystem/ecosystem.deps.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { SavingsCoreService } from 'savings/savings.core.service';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { SocialMediaService } from 'socialmedia/socialmedia.service';
import { Chain } from 'viem';
import { mainnet, polygon } from 'viem/chains';

export const INDEXING_TIMEOUT_COUNT: number = 3;
export const POLLING_DELAY: { [key: Chain['id']]: number } = {
	[mainnet.id]: 6_000, // blocktime: 12s
	[polygon.id]: 12_000, // blocktime: 2s, skip: 6 blks
};

@Injectable()
export class ApiService {
	private readonly logger = new Logger(this.constructor.name);
	private indexing: boolean = false;
	private indexingTimeoutCount: number = 0;
	private fetchedBlockheight: number = 0;
	private isUpdatingWorkflow: boolean = false;

	constructor(
		private readonly minter: EcosystemMinterService,
		private readonly positions: PositionsService,
		private readonly prices: PricesService,
		private readonly stablecoin: EcosystemStablecoinService,
		private readonly deps: EcosystemDepsService,
		private readonly challenges: ChallengesService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly savings: SavingsCoreService,
		private readonly socialMediaService: SocialMediaService
	) {
		setTimeout(() => this.updateBlockheight(), 100);
	}

	async updateWorkflow() {
		if (this.isUpdatingWorkflow) {
			this.logger.warn(`Skipping updateWorkflow - previous update still in progress at block ${this.fetchedBlockheight}`);
			return;
		}

		this.isUpdatingWorkflow = true;
		this.logger.log(`Fetched blockheight: ${this.fetchedBlockheight}`);

		try {
			const timeTask = async (name: string, fn: () => Promise<any>) => {
				const start = Date.now();
				try {
					await fn();
					this.logger.debug(`${name} completed in ${Date.now() - start}ms`);
				} catch (err) {
					this.logger.error(`Failed to update ${name} after ${Date.now() - start}ms:`, err);
					throw err;
				}
			};

			const batch1 = [
				timeTask('updateMinters', () => this.minter.updateMinters()).catch(() => {}),
				timeTask('updatePositonV2s', () => this.positions.updatePositonV2s()).catch(() => {}),
				timeTask('updateMintingUpdateV2s', () => this.positions.updateMintingUpdateV2s()).catch(() => {}),
				timeTask('updatePrices', () => this.prices.updatePrices()).catch(() => {}),
			];

			const batch2 = [
				timeTask('updateEcosystemKeyValues', () => this.stablecoin.updateEcosystemKeyValues()).catch(() => {}),
				timeTask('updateEcosystemMintBurnMapping', () => this.stablecoin.updateEcosystemMintBurnMapping()).catch(() => {}),
				timeTask('updateDepsInfo', () => this.deps.updateDepsInfo()).catch(() => {}),
				timeTask('updateLeadrateRates', () => this.leadrate.updateLeadrateRates()).catch(() => {}),
				timeTask('updateLeadrateProposals', () => this.leadrate.updateLeadrateProposals()).catch(() => {}),
			];

			const batch3 = [
				timeTask('updateChallenges', () => this.challenges.updateChallengeV2s()).catch(() => {}),
				timeTask('updateBids', () => this.challenges.updateBidV2s()).catch(() => {}),
				timeTask('updateChallengesPrices', () => this.challenges.updateChallengesPrices()).catch(() => {}),
				timeTask('updateSavingsUserLeaderboard', () => this.savings.updateSavingsUserLeaderboard()).catch(() => {}),
			];

			await Promise.all(batch1);
			await new Promise((resolve) => setTimeout(resolve, 50));
			await Promise.all(batch2);
			await new Promise((resolve) => setTimeout(resolve, 50));
			await Promise.all(batch3);
		} finally {
			this.isUpdatingWorkflow = false;
		}
	}

	async updateSocialMedia() {
		this.socialMediaService.update().catch((err) => this.logger.error('Failed to update social media:', err));
	}

	@Interval(POLLING_DELAY[CONFIG.chain.id])
	async updateBlockheight() {
		try {
			const tmp: number = parseInt((await VIEM_CONFIG.getBlockNumber()).toString());
			this.indexingTimeoutCount += 1;
			if (tmp > this.fetchedBlockheight && !this.indexing) {
				this.indexing = true;
				try {
					await this.updateWorkflow();
					await this.updateSocialMedia();
					this.indexingTimeoutCount = 0;
					this.fetchedBlockheight = tmp;
				} catch (error) {
					this.logger.error('Error in updateWorkflow:', error);
				} finally {
					this.indexing = false;
				}
			}
			if (this.indexingTimeoutCount >= INDEXING_TIMEOUT_COUNT && this.indexing) {
				this.logger.warn(`Indexing timeout reached after ${INDEXING_TIMEOUT_COUNT} attempts`);
				this.indexingTimeoutCount = 0;
				this.indexing = false;
			}
		} catch (error) {
			this.logger.error('Error getting block number:', error);
		}
	}
}
