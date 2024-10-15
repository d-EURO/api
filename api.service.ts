import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CONFIG, CONFIG_PROFILE, VIEM_CONFIG } from 'api.config';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemFpsService } from 'ecosystem/ecosystem.fps.service';
import { EcosystemFrankencoinService } from 'ecosystem/ecosystem.frankencoin.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { TelegramService } from 'telegram/telegram.service';
import { Chain } from 'viem';
import { mainnet, polygon } from 'viem/chains';

export const INDEXING_TIMEOUT_COUNT: number = 5;
export const POLLING_DEPLAY: { [key: Chain['id']]: number } = {
	[mainnet.id]: 6_000, // blocktime: 12s
	[polygon.id]: 10_000, // blocktime: 2s, skip: 5blks
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
		private readonly frankencoin: EcosystemFrankencoinService,
		private readonly fps: EcosystemFpsService,
		private readonly challenges: ChallengesService,
		private readonly telegram: TelegramService,
		private readonly leadrate: SavingsLeadrateService
	) {
		setTimeout(() => this.updateBlockheight(), 100);
	}

	async updateWorkflow() {
		this.logger.log(`Fetched blockheight: ${this.fetchedBlockheight}`);
		const promises = [
			this.minter.updateMinters(),
			this.positions.updatePositons(),
			this.positions.updateMintingUpdates(),
			this.prices.updatePrices(),
			this.frankencoin.updateEcosystemKeyValues(),
			this.frankencoin.updateEcosystemMintBurnMapping(),
			this.fps.updateFpsInfo(),
			this.leadrate.updateLeadrateRates(),
			this.leadrate.updateLeadrateProposals(),
			this.challenges.updateChallenges(),
			this.challenges.updateBids(),
			this.challenges.updateChallengesPrices(),
			this.telegram.updateTelegram(),
		];

		return Promise.all(promises);
	}

	@Interval(POLLING_DEPLAY[CONFIG[CONFIG_PROFILE].chain.id])
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
