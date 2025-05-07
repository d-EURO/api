import { Injectable, Logger } from '@nestjs/common';
import { StablecoinEnum } from 'bridge/bridge.enum';
import { BridgeService } from 'bridge/bridge.service';
import { StablecoinBridgeQuery } from 'bridge/bridge.types';
import { EcosystemDepsService } from 'ecosystem/ecosystem.deps.service';
import { FrontendCodeService } from 'frontendcode/frontendcode.service';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import { TradesService } from 'trades/trade.service';
import { TradeQuery } from 'trades/trade.types';
import { SocialMediaState } from './socialmedia.types';

export interface SocialMediaFct {
	doSendUpdates(): Promise<void>;
	doSendSavingUpdates(savingSaved: FrontendCodeSavingsQuery): Promise<void>;
	doSendFrontendCodeUpdates(frontendCodeRegistered: FrontendCodeRegisteredQuery): Promise<void>;
	doSendTradeUpdates(trade: TradeQuery, depsMarketCap: number, totalShares: bigint): Promise<void>;
	doSendBridgeUpdates(bridge: StablecoinBridgeQuery, stablecoin: string): Promise<void>;
}

@Injectable()
export class SocialMediaService {
	private readonly logger = new Logger(this.constructor.name);

	private readonly socialMediaRegister: Map<string, SocialMediaFct>;

	private readonly socialMediaState: SocialMediaState;

	constructor(
		private readonly frontendCode: FrontendCodeService,
		private readonly deps: EcosystemDepsService,
		private readonly trades: TradesService,
		private readonly bridges: BridgeService
	) {
		this.socialMediaRegister = new Map();

		const time: number = Date.now();

		this.socialMediaState = {
			savingUpdates: time,
			frontendCodeUpdates: time,
			tradeUpdates: time,
			bridgeUpdates: time,
		};
	}

	register(type: string, socialMedia: SocialMediaFct) {
		this.logger.debug(`${type} registered`);
		this.socialMediaRegister.set(type, socialMedia);
	}

	async update(): Promise<void> {
		this.logger.debug(`Updating Social Media: ${Array.from(this.socialMediaRegister.keys())}`);

		await this.sendUpdates();
		await this.sendSavingUpdates();
		await this.sendFrontendCodeUpdates();
		await this.sendTradeUpdates();
		await this.sendBridgeUpdates();
	}

	private async sendUpdates(): Promise<void> {
		try {
			for (const value of this.socialMediaRegister.values()) {
				await value.doSendUpdates();
			}
		} catch (e) {
			this.logger.error('Error while sending updates:', e);
		}
	}

	private async sendSavingUpdates(): Promise<void> {
		try {
			const checkDate = new Date(this.socialMediaState.savingUpdates);
			const requestedSavingsSaveds = await this.frontendCode.getSavingsSaveds(checkDate);

			if (requestedSavingsSaveds.length > 0) {
				this.socialMediaState.savingUpdates = Date.now();

				for (const savingSaved of requestedSavingsSaveds) {
					for (const value of this.socialMediaRegister.values()) {
						await value.doSendSavingUpdates(savingSaved);
					}
				}
			}
		} catch (e) {
			this.logger.error('Error while sending saving updates:', e);
		}
	}

	private async sendFrontendCodeUpdates(): Promise<void> {
		try {
			const checkDate = new Date(this.socialMediaState.frontendCodeUpdates);
			const requestedFrontendCodeRegistereds = await this.frontendCode.getFrontendCodeRegistereds(checkDate);

			if (requestedFrontendCodeRegistereds.length > 0) {
				this.socialMediaState.frontendCodeUpdates = Date.now();

				for (const frontendCodeRegistered of requestedFrontendCodeRegistereds) {
					for (const value of this.socialMediaRegister.values()) {
						await value.doSendFrontendCodeUpdates(frontendCodeRegistered);
					}
				}
			}
		} catch (e) {
			this.logger.error('Error while sending frontend code updates:', e);
		}
	}

	private async sendTradeUpdates(): Promise<void> {
		try {
			const checkDate = new Date(this.socialMediaState.tradeUpdates);
			const requestedTrades = await this.trades.getTrades(checkDate);

			if (requestedTrades.length > 0) {
				this.socialMediaState.tradeUpdates = Date.now();

				const depsInfo = this.deps.getEcosystemDepsInfo();
				const depsMarketCap = depsInfo.values.depsMarketCapInChf;

				for (const trade of requestedTrades) {
					const totalShares = await this.trades.getTotalShares(trade.trader);

					for (const value of this.socialMediaRegister.values()) {
						await value.doSendTradeUpdates(trade, depsMarketCap, totalShares);
					}
				}
			}
		} catch (e) {
			this.logger.error('Error while sending trade updates:', e);
		}
	}

	private async sendBridgeUpdates(): Promise<void> {
		try {
			const checkDate = new Date(this.socialMediaState.bridgeUpdates);

			for (const stablecoin in StablecoinEnum) {
				const requestedBridged = await this.bridges.getBridgedStables(stablecoin, checkDate);

				if (requestedBridged.length > 0) {
					this.socialMediaState.bridgeUpdates = Date.now();

					for (const bridge of requestedBridged) {
						for (const value of this.socialMediaRegister.values()) {
							await value.doSendBridgeUpdates(bridge, stablecoin);
						}
					}
				}
			}
		} catch (e) {
			this.logger.error('Error while sending bridge updates:', e);
		}
	}
}
