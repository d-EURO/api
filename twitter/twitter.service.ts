import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { FrontendCodeService } from 'frontendcode/frontendcode.service';
import { readFileSync } from 'fs';
import { SendTweetV2Params, TwitterApi } from 'twitter-api-v2';
import { TwitterAccessToken, TwitterState } from './dtos/twitter.dto';
import { FrontendCodeRegisteredMessage } from './messages/FrontendCodeRegistered.message';
import { SavingUpdateMessage } from './messages/SavingUpdate.message';

@Injectable()
export class TwitterService implements OnModuleInit {
	private readonly logger = new Logger(this.constructor.name);

	private client: TwitterApi;

	private readonly tokenFile: string = CONFIG.twitter.tokenJson;

	private readonly twitterState: TwitterState;

	constructor(private readonly frontendCode: FrontendCodeService) {
		const time: number = Date.now();

		this.twitterState = {
			savingUpdates: time,
			frontendCodeUpdates: time,
		};
	}

	async onModuleInit() {
		const token = await this.readToken();

		this.client = new TwitterApi({
			appKey: CONFIG.twitter.appKey,
			appSecret: CONFIG.twitter.appSecret,
			accessToken: token.access_token,
			accessSecret: token.access_secret,
		});
	}

	async updateTwitter(): Promise<void> {
		this.logger.debug('Updating Twitter');

		void this.sendSavingUpdates();
		void this.sendFrontendCodeUpdates();
	}

	private async sendSavingUpdates(): Promise<void> {
		try {
			const requestedSavingsSaveds = await this.frontendCode.getSavingsSaveds(new Date(this.twitterState.savingUpdates));
			if (requestedSavingsSaveds.length > 0) {
				this.twitterState.savingUpdates = Date.now();

				for (const savingSaved of requestedSavingsSaveds) {
					const messageInfo = SavingUpdateMessage(savingSaved);
					void this.sendPost(messageInfo[0], messageInfo[1]);
				}
			}
		} catch (e) {
			this.logger.error('Error while sending saving updates:', e);
		}
	}

	private async sendFrontendCodeUpdates(): Promise<void> {
		try {
			const requestedFrontendCodeRegistereds = await this.frontendCode.getFrontendCodeRegistereds(
				new Date(this.twitterState.frontendCodeUpdates)
			);
			if (requestedFrontendCodeRegistereds.length > 0) {
				this.twitterState.frontendCodeUpdates = Date.now();

				for (const frontendCodeRegistered of requestedFrontendCodeRegistereds) {
					const messageInfo = FrontendCodeRegisteredMessage(frontendCodeRegistered);
					void this.sendPost(messageInfo[0], messageInfo[1]);
				}
			}
		} catch (e) {
			this.logger.error('Error while sending frontend code updates:', e);
		}
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
