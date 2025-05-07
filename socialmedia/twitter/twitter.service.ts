import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { StablecoinBridgeQuery } from 'bridge/bridge.types';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import { readFileSync } from 'fs';
import { SocialMediaFct, SocialMediaService } from 'socialmedia/socialmedia.service';
import { TradeQuery } from 'trades/trade.types';
import { SendTweetV2Params, TwitterApi } from 'twitter-api-v2';
import { TwitterAccessToken } from './dtos/twitter.dto';
import { FrontendCodeRegisteredMessage } from './messages/FrontendCodeRegistered.message';
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
		this.socialMediaService.register(this.constructor.name, this);

		const token = await this.readToken();

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
		const messageInfo = SavingUpdateMessage(savingSaved);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendFrontendCodeUpdates(frontendCodeRegistered: FrontendCodeRegisteredQuery): Promise<void> {
		const messageInfo = FrontendCodeRegisteredMessage(frontendCodeRegistered);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendTradeUpdates(trade: TradeQuery, depsMarketCap: number, totalShares: bigint): Promise<void> {
		const messageInfo = TradeMessage(trade, depsMarketCap, totalShares);
		await this.sendPost(messageInfo[0], messageInfo[1]);
	}

	async doSendBridgeUpdates(bridge: StablecoinBridgeQuery, stablecoin: string): Promise<void> {
		const messageInfo = StablecoinBridgeMessage(bridge, stablecoin);
		this.sendPost(messageInfo[0], messageInfo[1]);
	}

	private async sendPost(message: string, media?: string): Promise<string> {
		try {
			const tweetParams: Partial<SendTweetV2Params> = {
				text: message,
			};

			if (media) {
				const mediaId = await this.client.v1.uploadMedia(media).catch((e) => this.logger.error('uploadMedia failed', e));
				if (mediaId) tweetParams.media = { media_ids: [mediaId] };
			}

			const result = await this.client.v2.tweet(tweetParams).catch((e) => this.logger.error('tweet failed', e));
			if (!result) throw new Error('sendPost failed');
			if (result.errors) throw new Error(`sendPost failed: ${JSON.stringify(result.errors)}`);

			if (result.data) {
				return result.data.id;
			}
		} catch (e) {
			this.logger.error('sendPost failed', e);
		}
	}

	private async readToken(): Promise<TwitterAccessToken> {
		return JSON.parse(readFileSync(this.tokenFile, 'utf-8')) as TwitterAccessToken;
	}
}
