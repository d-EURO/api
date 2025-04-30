import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CONFIG } from 'api.config';
import { ChallengesService } from 'challenges/challenges.service';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { FrontendCodeService } from 'frontendcode/frontendcode.service';
import TelegramBot from 'node-telegram-bot-api';
import { PositionsService } from 'positions/positions.service';
import { PricesService } from 'prices/prices.service';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { StorageService } from 'storage/storage.service';
import { Groups, SubscriptionGroups } from './dtos/groups.dto';
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
import { WelcomeGroupMessage } from './messages/WelcomeGroup.message';
import { TelegramGroupState, TelegramState, TelegramSubscriptionState } from './telegram.types';

@Injectable()
export class TelegramService implements OnModuleInit {
	private readonly logger = new Logger(this.constructor.name);
	private readonly bot = new TelegramBot(CONFIG.telegram.botToken, { polling: true });
	private readonly telegramHandles: string[] = ['/MintingUpdates', '/SavingUpdates', '/FrontendCodeUpdates', '/help'];
	private readonly telegramState: TelegramState;
	private readonly telegramSubscriptionState: TelegramSubscriptionState;
	private telegramGroupState: TelegramGroupState;

	constructor(
		private readonly storage: StorageService,
		private readonly minter: EcosystemMinterService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly position: PositionsService,
		private readonly prices: PricesService,
		private readonly challenge: ChallengesService,
		private readonly frontendCode: FrontendCodeService
	) {
		const time: number = Date.now();

		this.telegramState = {
			minterApplied: time,
			minterVetoed: time,
			leadrateProposal: time,
			leadrateChanged: time,
			positions: time,
			challenges: time,
			bids: time,
		};

		this.telegramSubscriptionState = {
			mintingUpdates: time,
			savingUpdates: time,
			frontendCodeUpdates: time,
		};

		this.telegramGroupState = {
			apiVersion: process.env.npm_package_version,
			createdAt: time,
			updatedAt: time,
			groups: [],
			ignore: [],
			subscription: {},
		};
	}

	onModuleInit() {
		void this.readBackupGroups();
	}

	async readBackupGroups() {
		const response = await this.storage.read(Groups);

		if (response.messageError || response.validationError.length > 0) {
			this.logger.error(response.messageError);
			this.logger.log(`Telegram group state created...`);
		} else {
			this.telegramGroupState = { ...this.telegramGroupState, ...response.data };
			this.logger.log(`Telegram group state restored...`);
		}

		await this.applyListener();
	}

	async writeBackupGroups() {
		try {
			this.telegramGroupState.apiVersion = process.env.npm_package_version;
			this.telegramGroupState.updatedAt = Date.now();

			await this.storage.write(this.telegramGroupState);
			this.logger.log(`Telegram group backup stored`);
		} catch (e) {
			this.logger.error(`Telegram group backup failed`, e);
		}
	}

	async sendMessageAll(message: string) {
		if (this.telegramGroupState.groups.length == 0) return;
		for (const group of this.telegramGroupState.groups) {
			await this.sendMessage(group, message);
		}
	}

	async sendMessageGroup(groups: string[], message: string, video?: string) {
		if (groups.length == 0) return;
		for (const group of groups) {
			await this.sendMessage(group, message, video);
		}
	}

	async sendMessage(group: string | number, message: string, video?: string) {
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

	async updateTelegram() {
		this.logger.debug('Updating Telegram');

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

		// Subscriptions
		void this.updateSubscriptions();
	}

	private async updateSubscriptions(): Promise<void> {
		void this.sendMintingUpdates();
		void this.sendSavingUpdates();
		void this.sendFrontendCodeUpdates();
	}

	private async sendMintingUpdates(): Promise<void> {
		try {
			const requestedMintingUpdates = this.position
				.getMintingUpdatesList()
				.list.filter((m) => m.created * 1000 > this.telegramSubscriptionState.mintingUpdates && BigInt(m.mintedAdjusted) > 0n);
			if (requestedMintingUpdates.length > 0) {
				this.telegramSubscriptionState.mintingUpdates = Date.now();
				for (const mintingUpdate of requestedMintingUpdates) {
					const groups = this.telegramGroupState.subscription['/MintingUpdates']?.groups || [];
					const prices = this.prices.getPricesMapping();
					this.sendMessageGroup(groups, MintingUpdateMessage(mintingUpdate, prices));
				}
			}
		} catch (e) {
			this.logger.error('Error while sending minting updates:', e);
		}
	}

	private async sendSavingUpdates(): Promise<void> {
		try {
			const requestedSavingsSaveds = await this.frontendCode.getSavingsSaveds(new Date(this.telegramSubscriptionState.savingUpdates));
			if (requestedSavingsSaveds.length > 0) {
				this.telegramSubscriptionState.savingUpdates = Date.now();
				for (const savingSaved of requestedSavingsSaveds) {
					const groups = this.telegramGroupState.subscription['/SavingUpdates']?.groups || [];
					const messageInfo = SavingUpdateMessage(savingSaved);
					this.sendMessageGroup(groups, messageInfo[0], messageInfo[1]);
				}
			}
		} catch (e) {
			this.logger.error('Error while sending saving updates:', e);
		}
	}

	private async sendFrontendCodeUpdates(): Promise<void> {
		try {
			const requestedFrontendCodeRegistereds = await this.frontendCode.getFrontendCodeRegistereds(
				new Date(this.telegramSubscriptionState.frontendCodeUpdates)
			);
			if (requestedFrontendCodeRegistereds.length > 0) {
				this.telegramSubscriptionState.frontendCodeUpdates = Date.now();
				for (const frontendCodeRegistered of requestedFrontendCodeRegistereds) {
					const groups = this.telegramGroupState.subscription['/FrontendCodeUpdates']?.groups || [];
					const messageInfo = FrontendCodeRegisteredMessage(frontendCodeRegistered);
					this.sendMessageGroup(groups, messageInfo[0], messageInfo[1]);
				}
			}
		} catch (e) {
			this.logger.error('Error while sending frontend code updates:', e);
		}
	}

	upsertTelegramGroup(id: number | string): boolean {
		if (!id) return;
		if (this.telegramGroupState.ignore.includes(id.toString())) return false;
		if (this.telegramGroupState.groups.includes(id.toString())) return false;
		this.telegramGroupState.groups.push(id.toString());
		this.logger.log(`Upserted Telegram Group: ${id}`);
		this.sendMessage(id, WelcomeGroupMessage(id, this.telegramHandles));
		return true;
	}

	async removeTelegramGroup(id: number | string): Promise<boolean> {
		if (!id) return;
		const inGroup: boolean = this.telegramGroupState.groups.includes(id.toString());
		const inSubscription = Object.values(this.telegramGroupState.subscription)
			.map((s) => s.groups)
			.flat(1)
			.includes(id.toString());
		const update: boolean = inGroup || inSubscription;

		if (inGroup) {
			const newGroup: string[] = this.telegramGroupState.groups.filter((g) => g !== id.toString());
			this.telegramGroupState.groups = newGroup;
		}

		if (inSubscription) {
			const subs = this.telegramGroupState.subscription;
			for (const h of Object.keys(subs)) {
				subs[h].groups = subs[h].groups.filter((g) => g != id.toString());
			}
			this.telegramGroupState.subscription = subs;
		}

		if (update) {
			this.logger.log(`Removed Telegram Group: ${id}`);
			await this.writeBackupGroups();
		}

		return update;
	}

	@Cron(CronExpression.EVERY_WEEK)
	async clearIgnoreTelegramGroup(): Promise<boolean> {
		this.telegramGroupState.ignore = [];
		await this.writeBackupGroups();
		this.logger.warn('Weekly job done, cleared ignore telegram group array');
		return true;
	}

	async applyListener() {
		const toggle = (handle: string, msg: TelegramBot.Message) => {
			if (handle !== msg.text) return;
			const group = msg.chat.id.toString();
			const subs = this.telegramGroupState.subscription[handle];
			if (subs == undefined) this.telegramGroupState.subscription[handle] = new SubscriptionGroups();
			if (this.telegramGroupState.subscription[handle].groups.includes(group)) {
				const newSubs = this.telegramGroupState.subscription[handle].groups.filter((g) => g != group);
				this.telegramGroupState.subscription[handle].groups = newSubs;
				this.sendMessage(group, `Removed from subscription: \n${handle}`);
			} else {
				this.telegramGroupState.subscription[handle].groups.push(group);
				this.sendMessage(group, `Added to subscription: \n${handle}`);
			}
			this.writeBackupGroups();
		};

		this.bot.on('message', async (m) => {
			if (this.upsertTelegramGroup(m.chat.id) === true) await this.writeBackupGroups();
			if (m.text === '/help')
				this.sendMessage(m.chat.id, HelpMessage(m.chat.id.toString(), this.telegramHandles, this.telegramGroupState.subscription));
			else this.telegramHandles.forEach((h) => toggle(h, m));
		});
	}
}
