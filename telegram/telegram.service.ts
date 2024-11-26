import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { PositionsService } from 'positions/positions.service';
import { TelegramGroupState, TelegramState } from './telegram.types';
import { EcosystemMinterService } from 'ecosystem/ecosystem.minter.service';
import { MinterProposalMessage } from './messages/MinterProposal.message';
import { PositionProposalMessage } from './messages/PositionProposal.message';
import { Storj } from 'storj/storj.s3.service';
import { Groups, SubscriptionGroups } from './dtos/groups.dto';
import { WelcomeGroupMessage } from './messages/WelcomeGroup.message';
import { ChallengesService } from 'challenges/challenges.service';
import { ChallengeStartedMessage } from './messages/ChallengeStarted.message';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PricesService } from 'prices/prices.service';
import { MintingUpdateMessage } from './messages/MintingUpdate.message';
import { HelpMessage } from './messages/Help.message';
import { MinterProposalVetoedMessage } from './messages/MinterProposalVetoed.message';
import { SavingsLeadrateService } from 'savings/savings.leadrate.service';
import { LeadrateProposalMessage } from './messages/LeadrateProposal.message';
import { LeadrateChangedMessage } from './messages/LeadrateChanged.message';
import { BidTakenMessage } from './messages/BidTaken.message';

@Injectable()
export class TelegramService {
	private readonly logger = new Logger(this.constructor.name);
	private readonly bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
	private readonly storjPath: string = '/telegram.groups.json';
	private telegramHandles: string[] = ['/MintingUpdates', '/help'];
	private telegramState: TelegramState;
	private telegramGroupState: TelegramGroupState;

	constructor(
		private readonly storj: Storj,
		private readonly minter: EcosystemMinterService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly position: PositionsService,
		private readonly prices: PricesService,
		private readonly challenge: ChallengesService
	) {
		const time: number = Date.now();
		this.telegramState = {
			minterApplied: time,
			minterVetoed: time,
			leadrateProposal: time,
			leadrateChanged: time,
			positions: time,
			mintingUpdates: time,
			challenges: time,
			bids: time,
		};

		this.telegramGroupState = {
			apiVersion: process.env.npm_package_version,
			createdAt: time,
			updatedAt: time,
			groups: [],
			ignore: [],
			subscription: {},
		};

		this.readBackupGroups();
	}

	async readBackupGroups() {
		this.logger.log(`Reading backup groups from storj`);
		const response = await this.storj.read(this.storjPath, Groups);

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
		this.telegramGroupState.apiVersion = process.env.npm_package_version;
		this.telegramGroupState.updatedAt = Date.now();
		const response = await this.storj.write(this.storjPath, this.telegramGroupState);
		const httpStatusCode = response['$metadata'].httpStatusCode;
		if (httpStatusCode == 200) {
			this.logger.log(`Telegram group backup stored`);
		} else {
			this.logger.error(`Telegram group backup failed. httpStatusCode: ${httpStatusCode}`);
		}
	}

	async sendMessageAll(message: string) {
		if (this.telegramGroupState.groups.length == 0) return;
		for (const group of this.telegramGroupState.groups) {
			await this.sendMessage(group, message);
		}
	}

	async sendMessageGroup(groups: string[], message: string) {
		if (groups.length == 0) return;
		for (const group of groups) {
			await this.sendMessage(group, message);
		}
	}

	async sendMessage(group: string | number, message: string) {
		try {
			this.logger.log(`Sending message to group id: ${group}`);
			await this.bot.sendMessage(group.toString(), message, { parse_mode: 'Markdown', disable_web_page_preview: true });
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

		// SUPSCRIPTION
		// MintingUpdates
		const requestedMintingUpdates = this.position
			.getMintingUpdatesList()
			.list.filter((m) => m.created * 1000 > this.telegramState.mintingUpdates && BigInt(m.mintedAdjusted) > 0n);
		if (requestedMintingUpdates.length > 0) {
			this.telegramState.mintingUpdates = Date.now();
			for (const m of requestedMintingUpdates) {
				const groups = this.telegramGroupState.subscription['/MintingUpdates']?.groups || [];
				const prices = this.prices.getPricesMapping();
				this.sendMessageGroup(groups, MintingUpdateMessage(m, prices));
			}
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
			if (this.upsertTelegramGroup(m.chat.id) == true) await this.writeBackupGroups();
			if (m.text === '/help')
				this.sendMessage(m.chat.id, HelpMessage(m.chat.id.toString(), this.telegramHandles, this.telegramGroupState.subscription));
			else this.telegramHandles.forEach((h) => toggle(h, m));
		});
	}
}
