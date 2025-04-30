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
import { TelegramService } from 'telegram/telegram.service';
import { TwitterService } from 'twitter/twitter.service';
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
		private readonly telegram: TelegramService,
		private readonly twitter: TwitterService
	) {
		setTimeout(() => this.updateBlockheight(), 100);
	}

	async updateWorkflow() {
		this.logger.log(`Fetched blockheight: ${this.fetchedBlockheight}`);
		const promises = [
			this.minter.updateMinters(),
			this.positions.updatePositonV2s(),
			this.positions.updateMintingUpdateV2s(),
			this.prices.updatePrices(),
			this.stablecoin.updateEcosystemKeyValues(),
			this.stablecoin.updateEcosystemMintBurnMapping(),
			this.deps.updateDepsInfo(),
			this.leadrate.updateLeadrateRates(),
			this.leadrate.updateLeadrateProposals(),
			this.challenges.updateChallengeV2s(),
			this.challenges.updateBidV2s(),
			this.challenges.updateChallengesPrices(),
			this.savings.updateSavingsUserLeaderboard(),
			this.telegram.updateTelegram(),
			this.twitter.updateTwitter(),
		];

		return Promise.all(promises);
	}

	@Interval(POLLING_DELAY[CONFIG.chain.id])
	async updateBlockheight() {
		const tmp: number = parseInt((await VIEM_CONFIG.getBlockNumber()).toString());
		this.indexingTimeoutCount += 1;
		if (tmp > this.fetchedBlockheight && !this.indexing) {
			this.indexing = true;
			await this.updateWorkflow();
			this.indexingTimeoutCount = 0;
			this.fetchedBlockheight = tmp;
			this.indexing = false;
		}
		if (this.indexingTimeoutCount >= INDEXING_TIMEOUT_COUNT && this.indexing) {
			this.indexingTimeoutCount = 0;
			this.indexing = false;
		}
	}
}
