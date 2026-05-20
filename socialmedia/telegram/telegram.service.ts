import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { StablecoinBridgeQuery } from 'bridge/bridge.types';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { EcosystemMintQueryItem } from 'ecosystem/ecosystem.stablecoin.types';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import TelegramBot from 'node-telegram-bot-api';
import { PositionsService } from 'positions/positions.service';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { resolveMediaPath } from 'socialmedia/socialmedia.helper';
import { SocialMediaFct, SocialMediaService } from 'socialmedia/socialmedia.service';
import { StorageService } from 'storage/storage.service';
import { TradeQuery } from 'trades/trade.types';
import { Groups } from './dtos/groups.dto';
import { BidTakenMessage } from './messages/BidTaken.message';
import { ChallengeStartedMessage } from './messages/ChallengeStarted.message';
import { FrontendCodeRegisteredMessage } from './messages/FrontendCodeRegistered.message';
import { HelpMessage } from './messages/Help.message';
import { LeadrateChangedMessage } from './messages/LeadrateChanged.message';
import { LeadrateProposalMessage } from './messages/LeadrateProposal.message';
import { MinterProposalMessage } from './messages/MinterProposal.message';
import { MinterProposalVetoedMessage } from './messages/MinterProposalVetoed.message';
import { MintingUpdateMessage } from './messages/MintingUpdate.message';
import { PositionExpiredMessage } from './messages/PositionExpired.message';
import { PositionExpiringSoonMessage } from './messages/PositionExpiringSoon.message';
import { PositionMiniLifetimeMessage } from './messages/PositionMiniLifetime.message';
import { PositionPhase2Message } from './messages/PositionPhase2.message';
import { PositionProposalMessage } from './messages/PositionProposal.message';
import { SavingUpdateMessage } from './messages/SavingUpdate.message';
import { StablecoinBridgeMessage } from './messages/StablecoinBridgeUpdate.message';
import { TradeMessage } from './messages/Trade.message';
import { TelegramGroupState, TelegramState } from './telegram.types';

// Stay under telegram per-chat rate limit (~30 msg/s) when bursting position-lifecycle alerts.
const TELEGRAM_THROTTLE_MS = 100;

@Injectable()
export class TelegramService implements OnModuleInit, SocialMediaFct {
	private readonly logger = new Logger(this.constructor.name);
	private readonly bot = new TelegramBot(CONFIG.telegram.botToken, { polling: true });
	private readonly telegramHandles: string[] = ['/start', '/subscribe', '/unsubscribe', '/help'];
	private readonly telegramState: TelegramState;
	private telegramGroupState: TelegramGroupState;

	constructor(
		private readonly socialMediaService: SocialMediaService,
		private readonly storage: StorageService,
		private readonly minter: EcosystemMinterService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly position: PositionsService,
		private readonly challenge: ChallengesService
	) {
		const time: number = Date.now() + 365 * 24 * 60 * 60 * 1000;

		this.telegramState = {
			minterApplied: time,
			minterVetoed: time,
			leadrateProposal: time,
			leadrateChanged: time,
			positions: time,
			challenges: time,
			bids: time,
		};

		this.telegramGroupState = {
			apiVersion: process.env.npm_package_version,
			createdAt: time,
			updatedAt: time,
			groups: [],
			alertedMiniLifetime: [],
			alertedExpiringSoon: [],
			alertedExpired: [],
			alertedPhase2: [],
		};
	}

	onModuleInit() {
		this.socialMediaService.register(this.constructor.name, this);

		void this.readBackupGroups();
	}

	private async readBackupGroups() {
		const response = await this.storage.read(Groups);

		if (response.messageError || response.validationError.length > 0) {
			this.logger.error(response.messageError);
			this.logger.log(`Telegram group state created`);
		} else {
			this.telegramGroupState = { ...this.telegramGroupState, ...response.data };
			this.logger.log(`Telegram group state restored`);
		}

		await this.applyListener();
	}

	private async writeBackupGroups() {
		try {
			this.telegramGroupState.apiVersion = process.env.npm_package_version;
			this.telegramGroupState.updatedAt = Date.now();

			await this.storage.write(this.telegramGroupState);
			this.logger.log(`Telegram group backup stored`);
		} catch (e) {
			this.logger.error(`Telegram group backup failed`, e);
		}
	}

	private async removeTelegramGroup(id: number | string): Promise<boolean> {
		if (!id) return;
		const inGroup: boolean = this.telegramGroupState.groups.includes(id.toString());
		const update: boolean = inGroup;

		if (inGroup) {
			const newGroup: string[] = this.telegramGroupState.groups.filter((g) => g !== id.toString());
			this.telegramGroupState.groups = newGroup;
		}

		if (update) {
			this.logger.log(`Removed Telegram Group: ${id}`);
			await this.writeBackupGroups();
		}

		return update;
	}

	async doSendUpdates(): Promise<void> {
		// break if no groups are known
		if (this.telegramGroupState?.groups == undefined) return;
		if (this.telegramGroupState.groups.length == 0) return;

		// DEFAULT
		// Minter Proposal
		const mintersList = this.minter.getMintersList().list.filter((m) => m.applyDate * 1000 > this.telegramState.minterApplied);
		if (mintersList.length > 0) {
			this.telegramState.minterApplied = Date.now(); // do first, allows new income to handle next loop
			for (const minter of mintersList) {
				this.sendMessageAll(MinterProposalMessage(minter));
			}
		}

		// Minter Proposal Vetoed
		const mintersVetoed = this.minter
			.getMintersList()
			.list.filter((m) => m.denyDate > 0 && m.denyDate * 1000 > this.telegramState.minterVetoed);
		if (mintersVetoed.length > 0) {
			this.telegramState.minterVetoed = Date.now();
			for (const minter of mintersVetoed) {
				this.sendMessageAll(MinterProposalVetoedMessage(minter));
			}
		}

		// Leadrate Proposal
		const leadrateProposal = this.leadrate.getProposals().list.filter((p) => p.created * 1000 > this.telegramState.leadrateProposal);
		const leadrateRates = this.leadrate.getRates();
		if (leadrateProposal.length > 0) {
			this.telegramState.leadrateProposal = Date.now();
			this.sendMessageAll(LeadrateProposalMessage(leadrateProposal[0], leadrateRates));
		}

		// Leadrate Changed
		if (leadrateRates.created * 1000 > this.telegramState.leadrateChanged) {
			this.telegramState.leadrateChanged = Date.now();
			this.sendMessageAll(LeadrateChangedMessage(leadrateRates.list[0]));
		}

		// Positions requested
		const requestedPosition = Object.values(this.position.getPositionsRequests().map).filter(
			(r) => r.created * 1000 > this.telegramState.positions
		);
		if (requestedPosition.length > 0) {
			this.telegramState.positions = Date.now();
			for (const p of requestedPosition) {
				this.sendMessageAll(PositionProposalMessage(p));
			}
		}

		// Position-lifecycle alerts use per-address dedup (alerted* arrays in
		// telegramGroupState, persisted via writeBackupGroups). Compared to a single
		// stateDate timestamp this correctly handles: service restart with already-
		// actionable positions, telegram outage (positions stay un-listed until delivered),
		// ponder reorg/back-fill, and partial group delivery.
		const openPositions = Object.values(this.position.getPositionsOpen().map);
		const miniLifetimeThreshold = 24 * 60 * 60; // 1 day, in seconds (position timestamps are seconds)
		const warningWindowMs = 24 * 60 * 60 * 1000;

		// Mini-lifetime clones — sub-day (expiration - created) lifetime, the WFPS attack pattern.
		const miniLifetimePositions = openPositions.filter((p) => {
			if (this.telegramGroupState.alertedMiniLifetime.includes(p.position.toLowerCase())) return false;
			return p.expiration - p.created < miniLifetimeThreshold;
		});
		for (const p of miniLifetimePositions) {
			const delivered = await this.sendMessageAll(PositionMiniLifetimeMessage(p));
			if (delivered) {
				this.telegramGroupState.alertedMiniLifetime.push(p.position.toLowerCase());
				await this.writeBackupGroups();
			}
			await this.sleep(TELEGRAM_THROTTLE_MS);
		}

		// Positions expiring within the next warning window.
		const expiringSoonPositions = openPositions.filter((p) => {
			if (this.telegramGroupState.alertedExpiringSoon.includes(p.position.toLowerCase())) return false;
			return p.expiration * 1000 < Date.now() + warningWindowMs;
		});
		for (const p of expiringSoonPositions) {
			const delivered = await this.sendMessageAll(PositionExpiringSoonMessage(p));
			if (delivered) {
				this.telegramGroupState.alertedExpiringSoon.push(p.position.toLowerCase());
				await this.writeBackupGroups();
			}
			await this.sleep(TELEGRAM_THROTTLE_MS);
		}

		// Positions expired with outstanding principal — clean exits are not actionable.
		// Skip if already in phase 2: the phase-2 watcher fires for it instead.
		const expiredPositions = openPositions.filter((p) => {
			if (this.telegramGroupState.alertedExpired.includes(p.position.toLowerCase())) return false;
			if (BigInt(p.principal || '0') === 0n) return false;
			const isExpired = p.expiration * 1000 < Date.now();
			const alreadyInPhase2 = (p.expiration + p.challengePeriod) * 1000 <= Date.now();
			return isExpired && !alreadyInPhase2;
		});
		for (const p of expiredPositions) {
			const delivered = await this.sendMessageAll(PositionExpiredMessage(p));
			if (delivered) {
				this.telegramGroupState.alertedExpired.push(p.position.toLowerCase());
				await this.writeBackupGroups();
			}
			await this.sleep(TELEGRAM_THROTTLE_MS);
		}

		// Forced-sale phase 2 — actionable arbitrage window (1× → 0× liq-price). No upper
		// bound: post-decay (price = 0) is still actionable, anyone can take collateral for
		// free and trigger coverLoss; the operator should still be alerted.
		const phase2Positions = openPositions.filter((p) => {
			if (this.telegramGroupState.alertedPhase2.includes(p.position.toLowerCase())) return false;
			if (BigInt(p.principal || '0') === 0n) return false;
			const phase2EntryMs = (p.expiration + p.challengePeriod) * 1000;
			return phase2EntryMs <= Date.now(); // inclusive — match monitoring's `timePassed >= cP`
		});
		for (const p of phase2Positions) {
			const delivered = await this.sendMessageAll(PositionPhase2Message(p));
			if (delivered) {
				this.telegramGroupState.alertedPhase2.push(p.position.toLowerCase());
				await this.writeBackupGroups();
			}
			await this.sleep(TELEGRAM_THROTTLE_MS);
		}

		// Challenges started
		const challengesStarted = Object.values(this.challenge.getChallengesMapping().map).filter(
			(c) => parseInt(c.created.toString()) * 1000 > this.telegramState.challenges
		);
		if (challengesStarted.length > 0) {
			this.telegramState.challenges = Date.now();
			for (const c of challengesStarted) {
				const pos = this.position.getPositionsList().list.find((p) => p.position == c.position);
				if (pos == undefined) return;
				this.sendMessageAll(ChallengeStartedMessage(pos, c));
			}
		}

		// Bids taken
		const bidsTaken = Object.values(this.challenge.getBidsMapping().map).filter(
			(b) => parseInt(b.created.toString()) * 1000 > this.telegramState.bids
		);
		if (bidsTaken.length > 0) {
			this.telegramState.bids = Date.now();
			for (const b of bidsTaken) {
				const position = this.position.getPositionsList().list.find((p) => p.position.toLowerCase() == b.position.toLowerCase());
				const challenge = this.challenge
					.getChallenges()
					.list.find((c) => c.id == `${b.position.toLowerCase()}-challenge-${b.number}`);
				if (position == undefined || challenge == undefined) return;
				this.sendMessageAll(BidTakenMessage(position, challenge, b));
			}
		}
	}

	async doSendSavingUpdates(savingSaved: FrontendCodeSavingsQuery): Promise<void> {
		if (BigInt(savingSaved.amount) === 0n) return;
		const messageInfo = SavingUpdateMessage(savingSaved);
		this.sendMessageAll(messageInfo[0], messageInfo[1]);
	}

	async doSendFrontendCodeUpdates(frontendCodeRegistered: FrontendCodeRegisteredQuery): Promise<void> {
		const messageInfo = FrontendCodeRegisteredMessage(frontendCodeRegistered);
		this.sendMessageAll(messageInfo[0], messageInfo[1]);
	}

	async doSendTradeUpdates(trade: TradeQuery, depsMarketCap: number, totalShares: bigint): Promise<void> {
		if (BigInt(trade.amount) === 0n) return;
		const messageInfo = TradeMessage(trade, depsMarketCap, totalShares);
		this.sendMessageAll(messageInfo[0], messageInfo[1]);
	}

	async doSendBridgeUpdates(bridge: StablecoinBridgeQuery, stablecoin: string): Promise<void> {
		if (BigInt(bridge.amount) === 0n) return;
		const messageInfo = StablecoinBridgeMessage(bridge, stablecoin);
		this.sendMessageAll(messageInfo[0], messageInfo[1]);
	}

	async doSendMintUpdates(mint: EcosystemMintQueryItem): Promise<void> {
		if (BigInt(mint.value) === 0n) return;
		const messageInfo = MintingUpdateMessage(mint);
		this.sendMessageAll(messageInfo[0], messageInfo[1]);
	}

	/**
	 * Send to all groups. Returns true iff delivery succeeded to at least one group
	 * (or there are no groups configured — nothing to deliver to). Callers that need
	 * delivery confirmation (e.g. for per-address alert dedup) should check the return
	 * value before marking the alert as sent.
	 */
	private async sendMessageAll(message: string, video?: string): Promise<boolean> {
		if (this.telegramGroupState.groups.length == 0) return true;
		let anyDelivered = false;
		for (const group of this.telegramGroupState.groups) {
			const ok = await this.sendMessage(group, message, video);
			if (ok) anyDelivered = true;
		}
		return anyDelivered;
	}

	private async sendMessage(group: string | number, message: string, video?: string): Promise<boolean> {
		try {
			this.logger.log(`Sending message to group id: ${group}`);
			// Notification assets are best-effort — when the file is missing fall back to a
			// text-only message rather than letting node-telegram-bot-api reinterpret a missing
			// local path as a URL (which produces "URL host is empty" 400s on every send).
			const videoPath = resolveMediaPath(video);
			if (video && !videoPath) {
				this.logger.debug(`Telegram video asset missing: ${video} — sending text-only`);
			}
			videoPath ? await this.doSendVideo(group, message, videoPath) : await this.doSendMessage(group, message);
			return true;
		} catch (error) {
			const msg = {
				notFound: 'chat not found',
				deleted: 'the group chat was deleted',
				blocked: 'bot was blocked by the user',
			};

			if (typeof error === 'object') {
				if (error?.message.includes(msg.deleted)) {
					this.logger.warn(msg.deleted + `: ${group}`);
					this.removeTelegramGroup(group);
				} else if (error?.message.includes(msg.notFound)) {
					this.logger.warn(msg.notFound + `: ${group}`);
					this.removeTelegramGroup(group);
				} else if (error?.message.includes(msg.blocked)) {
					this.logger.warn(msg.blocked + `: ${group}`);
					this.removeTelegramGroup(group);
				} else {
					this.logger.warn(error?.message);
				}
			} else {
				this.logger.warn(error);
			}
			return false;
		}
	}

	private async doSendMessage(group: string | number, message: string): Promise<void> {
		await this.bot.sendMessage(group.toString(), message, { parse_mode: 'Markdown', disable_web_page_preview: true });
	}

	private async doSendVideo(group: string | number, message: string, video: string): Promise<void> {
		await this.bot.sendVideo(group.toString(), video, {
			caption: message,
			parse_mode: 'Markdown',
		});
	}

	private async applyListener() {
		this.bot.on('message', async (m) => {
			switch (m.text) {
				case '/help':
					this.sendHelpMessage(m);
					break;

				// Telegram's default first-contact button maps to /start, so accepting it as
				// a subscribe alias gives users a one-click onboarding path. /subscribe stays
				// as an explicit alias for users that already know the command.
				case '/start':
				case '/subscribe':
					this.sendSubscribeMessage(m);
					break;

				case '/unsubscribe':
					this.sendUnsubscribeMessage(m);
					break;
			}
		});
	}

	private async sendHelpMessage(msg: TelegramBot.Message): Promise<void> {
		this.sendMessage(msg.chat.id, HelpMessage(this.telegramGroupState.groups, msg.chat.id.toString(), this.telegramHandles));
	}

	private async sendSubscribeMessage(msg: TelegramBot.Message): Promise<void> {
		const group = msg.chat.id.toString();
		const isSubscribed = this.telegramGroupState.groups.find((g) => g === group);
		if (isSubscribed) {
			this.sendMessage(group, `You are already subscribed.`);
			return;
		}

		this.telegramGroupState.groups.push(group);
		this.sendMessage(group, `You are now subscribed. Use /unsubscribe to stop.`);

		this.writeBackupGroups();
	}

	private async sendUnsubscribeMessage(msg: TelegramBot.Message): Promise<void> {
		const group = msg.chat.id.toString();
		const isSubscribed = this.telegramGroupState.groups.find((g) => g === group);
		if (!isSubscribed) {
			this.sendMessage(group, `You are not subscribed.`);
			return;
		}

		const newGroups = this.telegramGroupState.groups.filter((g) => g != group);
		this.telegramGroupState.groups = newGroups;
		this.sendMessage(group, `You are not subscribed anymore.`);

		this.writeBackupGroups();
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
