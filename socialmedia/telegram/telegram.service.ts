import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CONFIG } from 'api.config';
import { StablecoinBridgeQuery } from 'bridge/bridge.types';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { EcosystemStablecoinService } from 'ecosystem/ecosystem.stablecoin.service';
import { FrontendCodeRegisteredQuery, FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import TelegramBot from 'node-telegram-bot-api';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
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
import { PositionProposalMessage } from './messages/PositionProposal.message';
import { SavingUpdateMessage } from './messages/SavingUpdate.message';
import { StablecoinBridgeMessage } from './messages/StablecoinBridgeUpdate.message';
import { TradeMessage } from './messages/Trade.message';
import { TelegramGroupState, TelegramState } from './telegram.types';

@Injectable()
export class TelegramService implements OnModuleInit, SocialMediaFct {
	private readonly logger = new Logger(this.constructor.name);
	private readonly bot = new TelegramBot(CONFIG.telegram.botToken, { polling: true });
	private readonly telegramHandles: string[] = ['/subscribe', '/unsubscribe', '/help'];
	private readonly telegramState: TelegramState;
	private telegramGroupState: TelegramGroupState;

	constructor(
		private readonly socialMediaService: SocialMediaService,
		private readonly storage: StorageService,
		private readonly minter: EcosystemMinterService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly position: PositionsService,
		private readonly prices: PricesService,
		private readonly challenge: ChallengesService,
		private readonly stablecoin: EcosystemStablecoinService
	) {
		const time: number = Date.now() + 365 * 24 * 60 * 60 * 1000;
		// Start tracking from 1 hour ago to avoid spam on restart but still catch recent mints
		const startTime: number = Date.now() - 60 * 60 * 1000; // 1 hour ago

		this.telegramState = {
			minterApplied: time,
			minterVetoed: time,
			leadrateProposal: time,
			leadrateChanged: time,
			positions: time,
			challenges: time,
			bids: time,
			mintingUpdates: startTime, // Start from 1 hour ago
			generalMints: startTime,    // Start from 1 hour ago
		};

		this.telegramGroupState = {
			apiVersion: process.env.npm_package_version,
			createdAt: time,
			updatedAt: time,
			groups: [],
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

		// Minting updates (from MintingUpdateV2 events - position-based mints)
		const requestedMintingUpdates = this.position
			.getMintingUpdatesList()
			.list.filter((m) => m.created * 1000 > this.telegramState.mintingUpdates && BigInt(m.mintedAdjusted) > 0n);

		// Track which transactions have been notified via MintingUpdateV2
		const notifiedTxHashes = new Set<string>();

		if (requestedMintingUpdates.length > 0) {
			this.telegramState.mintingUpdates = Date.now();

			for (const mintingUpdate of requestedMintingUpdates) {
				const prices = this.prices.getPricesMapping();
				this.sendMessageAll(MintingUpdateMessage(mintingUpdate, prices));
				// Track this transaction as already notified
				if (mintingUpdate.txHash) {
					notifiedTxHashes.add(mintingUpdate.txHash);
				}
			}
		}

		// General mints (including CoW Protocol and other mints without MintingUpdateV2 events)
		// Only send notifications for mints that weren't already sent via MintingUpdateV2
		try {
			const checkDate = new Date(this.telegramState.generalMints);
			const recentMints = await this.stablecoin.getRecentMints(checkDate);
			
			// Filter for significant mints (> 1000 dEURO) that haven't been notified yet
			const MIN_MINT_AMOUNT = BigInt(1000 * 10 ** 18);
			const significantMints = recentMints.filter(mint => {
				// Skip if no txHash
				if (!mint.txHash) return false;
				// Skip if already notified via MintingUpdateV2
				if (notifiedTxHashes.has(mint.txHash)) return false;
				// Only include significant amounts
				return mint.value >= MIN_MINT_AMOUNT;
			});
			
			if (significantMints.length > 0) {
				// Update timestamp AFTER processing to avoid missing mints
				this.telegramState.generalMints = Date.now();
				
				// Limit notifications to avoid spam (max 10 per update cycle)
				const MAX_NOTIFICATIONS = 10;
				const mintsToNotify = significantMints.slice(0, MAX_NOTIFICATIONS);
				
				if (significantMints.length > MAX_NOTIFICATIONS) {
					this.logger.warn(`Limiting notifications: ${significantMints.length} mints found, sending first ${MAX_NOTIFICATIONS}`);
				}
				
				for (const mint of mintsToNotify) {
					const amount = Number(mint.value / BigInt(10 ** 18));
					const explorerUrl = CONFIG.chain.id === 137 
						? `https://polygonscan.com/tx/${mint.txHash}`
						: `https://etherscan.io/tx/${mint.txHash}`;
					
					const message = `🏦 *dEURO Mint*\n\n` +
						`Amount: ${amount.toLocaleString('de-CH')} dEURO\n` +
						`To: \`${mint.to.slice(0, 6)}...${mint.to.slice(-4)}\`\n` +
						`[View Transaction](${explorerUrl})`;
					
					this.sendMessageAll(message);
				}
			}
		} catch (error) {
			this.logger.error('Error fetching general mints:', error);
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

	private async sendMessageAll(message: string, video?: string) {
		if (this.telegramGroupState.groups.length == 0) return;
		for (const group of this.telegramGroupState.groups) {
			await this.sendMessage(group, message, video);
		}
	}

	private async sendMessage(group: string | number, message: string, video?: string) {
		try {
			this.logger.log(`Sending message to group id: ${group}`);
			video ? await this.doSendVideo(group, message, video) : await this.doSendMessage(group, message);
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
		if (isSubscribed) return;

		this.telegramGroupState.groups.push(group);
		this.sendMessage(group, `You are now subscribed.`);

		this.writeBackupGroups();
	}

	private async sendUnsubscribeMessage(msg: TelegramBot.Message): Promise<void> {
		const group = msg.chat.id.toString();
		const isSubscribed = this.telegramGroupState.groups.find((g) => g === group);
		if (!isSubscribed) return;

		const newGroups = this.telegramGroupState.groups.filter((g) => g != group);
		this.telegramGroupState.groups = newGroups;
		this.sendMessage(group, `You are not subscribed anymore.`);

		this.writeBackupGroups();
	}
}
