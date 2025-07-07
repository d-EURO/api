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
		this.logger.log(`Fetched blockheight: ${this.fetchedBlockheight}`);

		const batch1 = [
			this.minter.updateMinters().catch((err) => this.logger.error('Failed to update minters:', err)),
			this.positions.updatePositonV2s().catch((err) => this.logger.error('Failed to update positions:', err)),
			this.positions.updateMintingUpdateV2s().catch((err) => this.logger.error('Failed to update minting updates:', err)),
			this.prices.updatePrices().catch((err) => this.logger.error('Failed to update prices:', err)),
		];

		const batch2 = [
			this.stablecoin.updateEcosystemKeyValues().catch((err) => this.logger.error('Failed to update ecosystem key values:', err)),
			this.stablecoin.updateEcosystemMintBurnMapping().catch((err) => this.logger.error('Failed to update mint burn mapping:', err)),
			this.deps.updateDepsInfo().catch((err) => this.logger.error('Failed to update deps info:', err)),
			this.leadrate.updateLeadrateRates().catch((err) => this.logger.error('Failed to update leadrate rates:', err)),
			this.leadrate.updateLeadrateProposals().catch((err) => this.logger.error('Failed to update leadrate proposals:', err)),
		];

		const batch3 = [
			this.challenges.updateChallengeV2s().catch((err) => this.logger.error('Failed to update challenges:', err)),
			this.challenges.updateBidV2s().catch((err) => this.logger.error('Failed to update bids:', err)),
			this.challenges.updateChallengesPrices().catch((err) => this.logger.error('Failed to update challenge prices:', err)),
			this.savings.updateSavingsUserLeaderboard().catch((err) => this.logger.error('Failed to update savings leaderboard:', err)),
		];

		await Promise.all(batch1);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await Promise.all(batch2);
		await new Promise((resolve) => setTimeout(resolve, 50));
		await Promise.all(batch3);
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
