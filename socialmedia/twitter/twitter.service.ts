import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { StablecoinBridgeQuery } from 'bridge/bridge.types';
import { EcosystemMintQueryItem } from 'ecosystem/ecosystem.stablecoin.types';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import { existsSync, readFileSync } from 'fs';
import { resolveMediaPath } from 'socialmedia/socialmedia.helper';
import { SocialMediaFct, SocialMediaService } from 'socialmedia/socialmedia.service';
import { TradeQuery } from 'trades/trade.types';
import { SendTweetV2Params, TwitterApi } from 'twitter-api-v2';
import { TwitterAccessToken } from './dtos/twitter.dto';
import { FrontendCodeRegisteredMessage } from './messages/FrontendCodeRegistered.message';
import { MintingUpdateMessage } from './messages/MintingUpdate.message';
import { SavingUpdateMessage } from './messages/SavingUpdate.message';
import { StablecoinBridgeMessage } from './messages/StablecoinBridgeUpdate.message';
import { TradeMessage } from './messages/Trade.message';

@Injectable()
export class TwitterService implements OnModuleInit, SocialMediaFct {
	private readonly logger = new Logger(this.constructor.name);

	private client: TwitterApi;

	private readonly tokenFile: string = CONFIG.twitter.tokenJson;

	constructor(private readonly socialMediaService: SocialMediaService) {}

	async onModuleInit() {
		// Token bootstrap is a manual one-off (3-legged OAuth against @dEURO_com).
		// Without a valid token every uploadMedia/tweet call fails — skip registration
		// so the service stays quiet instead of erroring on every notification.
		const token = this.readToken();
		if (!token) {
			this.logger.warn(`Twitter access tokens missing — service disabled. Populate ${this.tokenFile} via the OAuth bootstrap.`);
			return;
		}

		this.socialMediaService.register(this.constructor.name, this);

		this.client = new TwitterApi({
			appKey: CONFIG.twitter.appKey,
			appSecret: CONFIG.twitter.appSecret,
			accessToken: token.access_token,
			accessSecret: token.access_secret,
		});
	}

	async doSendUpdates(): Promise<void> {
		// not implemented yet
		return;
	}

	async doSendSavingUpdates(savingSaved: FrontendCodeSavingsQuery): Promise<void> {
		if (BigInt(savingSaved.amount) === 0n) return;
		const messageInfo = SavingUpdateMessage(savingSaved);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendFrontendCodeUpdates(frontendCodeRegistered: FrontendCodeRegisteredQuery): Promise<void> {
		const messageInfo = FrontendCodeRegisteredMessage(frontendCodeRegistered);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendTradeUpdates(trade: TradeQuery, depsMarketCap: number, totalShares: bigint): Promise<void> {
		if (BigInt(trade.amount) === 0n) return;
		const messageInfo = TradeMessage(trade, depsMarketCap, totalShares);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendBridgeUpdates(bridge: StablecoinBridgeQuery, stablecoin: string): Promise<void> {
		if (BigInt(bridge.amount) === 0n) return;
		const messageInfo = StablecoinBridgeMessage(bridge, stablecoin);
		this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendMintUpdates(mint: EcosystemMintQueryItem): Promise<void> {
		if (BigInt(mint.value) === 0n) return;
		const messageInfo = MintingUpdateMessage(mint);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	private async sendPost(message: string, media?: string): Promise<string | undefined> {
		try {
			const tweetParams: Partial<SendTweetV2Params> = {
				text: message,
			};

			// Notification assets are best-effort — when the file is missing post text-only
			// rather than dropping the whole tweet.
			const mediaPath = resolveMediaPath(media);
			if (mediaPath) {
				const mediaId = await this.client.v1
					.uploadMedia(mediaPath)
					.catch((e) => this.logger.error(`uploadMedia failed: ${e?.message ?? e}`));
				if (mediaId) tweetParams.media = { media_ids: [mediaId] };
			} else if (media) {
				this.logger.debug(`Twitter media asset missing: ${media} — posting text-only`);
			}

			const result = await this.client.v2.tweet(tweetParams).catch((e) => this.logger.error(`tweet failed: ${e?.message ?? e}`));
			if (!result) return undefined;
			if (result.errors) {
				this.logger.error(`tweet returned errors: ${JSON.stringify(result.errors)}`);
				return undefined;
			}

			return result.data?.id;
		} catch (e) {
			this.logger.error(`sendPost failed: ${e?.message ?? e}`);
			return undefined;
		}
	}

	private readToken(): TwitterAccessToken | undefined {
		if (!this.tokenFile || !existsSync(this.tokenFile)) return undefined;
		try {
			const parsed = JSON.parse(readFileSync(this.tokenFile, 'utf-8')) as Partial<TwitterAccessToken>;
			if (!parsed?.access_token || !parsed?.access_secret) return undefined;
			return parsed as TwitterAccessToken;
		} catch (e) {
			this.logger.warn(`Failed to parse ${this.tokenFile}: ${e?.message ?? e}`);
			return undefined;
		}
	}
}
