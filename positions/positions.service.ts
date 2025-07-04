import { gql } from '@apollo/client/core';
import { ADDRESS, PositionV2ABI, SavingsABI } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { FIVEDAYS_MS } from 'utils/const-helper';
import { Address, erc20Abi, getAddress } from 'viem';
import { CONFIG, VIEM_CONFIG } from '../api.config';
import { PONDER_CLIENT } from '../api.apollo.config';
import {
	ApiMintingUpdateListing,
	ApiMintingUpdateMapping,
	ApiPositionsListing,
	ApiPositionsMapping,
	ApiPositionsOwners,
	MintingUpdateQuery,
	MintingUpdateQueryObjectArray,
	OwnersPositionsObjectArray,
	PositionQuery,
	PositionsQueryObjectArray,
} from './positions.types';

@Injectable()
export class PositionsService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedPositionV2s: PositionQuery[] = [];
	private fetchedPositions: PositionsQueryObjectArray = {};
	private fetchedMintingUpdates: MintingUpdateQueryObjectArray = {};

	constructor() {}

	getPositionsList(): ApiPositionsListing {
		const pos = Object.values(this.fetchedPositions) as PositionQuery[];
		return {
			num: pos.length,
			list: pos,
		};
	}

	getPositionsMapping(): ApiPositionsMapping {
		const pos = this.fetchedPositions;
		return { num: Object.keys(pos).length, addresses: Object.keys(pos) as Address[], map: pos };
	}

	getPositionsOpen(): ApiPositionsMapping {
		const pos = this.getPositionsList().list;
		const open = pos.filter((p) => !p.closed && !p.denied);
		const mapped: PositionsQueryObjectArray = {};
		for (const p of open) {
			mapped[p.position] = p;
		}
		return { num: Object.keys(mapped).length, addresses: Object.keys(mapped) as Address[], map: mapped };
	}

	getPositionsRequests(): ApiPositionsMapping {
		const pos = this.getPositionsList().list;
		// FIXME: make time diff flexable, changeable between chains/SC
		const request = pos.filter((p) => p.start * 1000 + FIVEDAYS_MS > Date.now());
		const mapped: PositionsQueryObjectArray = {};
		for (const p of request) {
			mapped[p.position] = p;
		}
		return { num: Object.keys(mapped).length, addresses: Object.keys(mapped) as Address[], map: mapped };
	}

	getPositionsOwners(): ApiPositionsOwners {
		const ow: OwnersPositionsObjectArray = {};
		for (const p of Object.values(this.fetchedPositions)) {
			const owner = p.owner.toLowerCase();
			if (!ow[owner]) ow[owner] = [];
			ow[owner].push(p);
		}
		return {
			num: Object.keys(ow).length,
			owners: Object.keys(ow) as Address[],
			map: ow,
		};
	}

	async updatePositonV2s() {
		this.logger.debug('Updating Positions V2');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					positionV2s(orderBy: "availableForClones", orderDirection: "desc", limit: 1000) {
						items {
							position
							owner
							deuro
							collateral
							price

							created
							isOriginal
							isClone
							denied
							closed
							original

							minimumCollateral
							riskPremiumPPM
							reserveContribution
							start
							cooldown
							expiration
							challengePeriod

							deuroName
							deuroSymbol
							deuroDecimals

							collateralName
							collateralSymbol
							collateralDecimals
							collateralBalance

							limitForClones
							availableForClones
							availableForMinting

							fixedAnnualRatePPM
							principal
						}
					}
				}
			`,
		});

		if (!data || !data?.positionV2s?.items?.length) {
			this.logger.warn('No Positions V2 found.');
			return;
		}

		const items: PositionQuery[] = data.positionV2s.items as PositionQuery[];
		const list: PositionsQueryObjectArray = {};
		const balanceOfDataPromises: Promise<bigint>[] = [];
		const virtualPriceDataPromises: Promise<bigint>[] = [];
		const interestPromises: Promise<bigint>[] = [];

		const leadrate = await VIEM_CONFIG.readContract({
			address: ADDRESS[CONFIG.chain.id].savingsGateway,
			abi: SavingsABI,
			functionName: 'currentRatePPM',
		});

		for (const p of items) {
			// Forces the collateral balance to be overwritten with the latest blockchain state, instead of the ponder state.
			// This ensures that collateral transfers can be made without using the smart contract or application directly,
			// and the API will be aware of the updated state.
			balanceOfDataPromises.push(
				VIEM_CONFIG.readContract({
					address: p.collateral,
					abi: erc20Abi,
					functionName: 'balanceOf',
					args: [p.position],
				})
			);

			virtualPriceDataPromises.push(
				VIEM_CONFIG.readContract({
					address: p.position,
					abi: PositionV2ABI,
					functionName: 'virtualPrice',
				})
			);

			interestPromises.push(
				VIEM_CONFIG.readContract({
					address: p.position,
					abi: PositionV2ABI,
					functionName: 'getInterest',
				})
			);

			// TODO: is this solved in V2?
			// fetch minted - See issue #11
			// https://github.com/Frankencoin-ZCHF/frankencoin-api/issues/
			/*
			mintedDataPromises.push(
				VIEM_CONFIG.readContract({
					address: p.position,
					abi: PositionV2ABI,
					functionName: 'minted',
				})
			);
			*/
		}

		// await for contract calls
		const balanceOfData = await Promise.allSettled(balanceOfDataPromises);
		const virtualPriceData = await Promise.allSettled(virtualPriceDataPromises);
		const interestData = await Promise.allSettled(interestPromises);

		for (let idx = 0; idx < items.length; idx++) {
			const p = items[idx] as PositionQuery;
			const b = (balanceOfData[idx] as PromiseFulfilledResult<bigint>).value;
			const v = (virtualPriceData[idx] as PromiseFulfilledResult<bigint>).value;
			const i = (interestData[idx] as PromiseFulfilledResult<bigint>).value;

			const entry: PositionQuery = {
				version: 2,

				position: getAddress(p.position),
				owner: getAddress(p.owner),
				deuro: getAddress(p.deuro),
				collateral: getAddress(p.collateral),
				price: p.price,

				created: p.created,
				isOriginal: p.isOriginal,
				isClone: p.isClone,
				denied: p.denied,
				closed: p.closed,
				original: getAddress(p.original),

				minimumCollateral: p.minimumCollateral,
				annualInterestPPM: leadrate + p.riskPremiumPPM,
				riskPremiumPPM: p.riskPremiumPPM,
				reserveContribution: p.reserveContribution,
				start: p.start,
				cooldown: p.cooldown,
				expiration: p.expiration,
				challengePeriod: p.challengePeriod,

				deuroName: p.deuroName,
				deuroSymbol: p.deuroSymbol,
				deuroDecimals: p.deuroDecimals,

				collateralName: p.collateralName,
				collateralSymbol: p.collateralSymbol,
				collateralDecimals: p.collateralDecimals,
				collateralBalance: typeof b === 'bigint' ? b.toString() : p.collateralBalance,

				limitForClones: p.limitForClones,
				availableForClones: p.availableForClones,
				availableForMinting: p.availableForMinting,
				principal: p.principal,
				fixedAnnualRatePPM: p.fixedAnnualRatePPM,
				virtualPrice: typeof v === 'bigint' ? v.toString() : p.virtualPrice,
				interest: typeof i === 'bigint' ? i.toString() : '0',
			};

			list[p.position.toLowerCase() as Address] = entry;
		}

		const a = Object.keys(list).length;
		const b = this.fetchedPositionV2s.length;
		const isDiff = a > b;

		if (isDiff) this.logger.log(`Positions V2 merging, from ${b} to ${a} positions`);
		this.fetchedPositionV2s = Object.values(list) as PositionQuery[];
		this.fetchedPositions = { ...this.fetchedPositions, ...list };

		return list;
	}

	getMintingUpdatesList(): ApiMintingUpdateListing {
		const m = Object.values(this.fetchedMintingUpdates).flat(1) as MintingUpdateQuery[];
		return {
			num: m.length,
			list: m,
		};
	}

	getMintingUpdatesMapping(): ApiMintingUpdateMapping {
		const m = this.fetchedMintingUpdates;
		return { num: Object.keys(m).length, positions: Object.keys(m) as Address[], map: m };
	}

	async updateMintingUpdateV2s() {
		this.logger.debug('Updating Positions MintingUpdates V2');
		const { data } = await PONDER_CLIENT.query({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					mintingUpdateV2s(orderBy: "created", orderDirection: "desc", limit: 1000) {
						items {
							id
							txHash
							created
							position
							owner
							isClone
							collateral
							collateralName
							collateralSymbol
							collateralDecimals
							size
							price
							minted
							sizeAdjusted
							priceAdjusted
							mintedAdjusted
							annualInterestPPM
							basePremiumPPM
							riskPremiumPPM
							reserveContribution
							feeTimeframe
							feePPM
							feePaid
						}
					}
				}
			`,
		});

		if (!data || !data?.mintingUpdateV2s?.items?.length) {
			this.logger.warn('No MintingUpdates V2 found.');
			return;
		}

		const items: MintingUpdateQuery[] = data.mintingUpdateV2s.items;
		const list: MintingUpdateQueryObjectArray = {};

		for (let idx = 0; idx < items.length; idx++) {
			const m = items[idx] as MintingUpdateQuery;
			const k = m.position.toLowerCase() as Address;

			if (list[k] === undefined) list[k] = [];

			const entry: MintingUpdateQuery = {
				version: 2,

				id: m.id,
				txHash: m.txHash,
				created: parseInt(m.created as any),
				position: getAddress(m.position),
				owner: getAddress(m.owner),
				isClone: m.isClone,
				collateral: getAddress(m.collateral),
				collateralName: m.collateralName,
				collateralSymbol: m.collateralSymbol,
				collateralDecimals: m.collateralDecimals,
				size: m.size,
				price: m.price,
				minted: m.minted,
				sizeAdjusted: m.sizeAdjusted,
				priceAdjusted: m.priceAdjusted,
				mintedAdjusted: m.mintedAdjusted,
				annualInterestPPM: m.annualInterestPPM,
				basePremiumPPM: m.basePremiumPPM,
				riskPremiumPPM: m.riskPremiumPPM,
				reserveContribution: m.reserveContribution,
				feeTimeframe: m.feeTimeframe,
				feePPM: m.feePPM,
				feePaid: m.feePaid,
			};

			list[k].push(entry);
		}

		const a = Object.values(list).flat(1).length;
		const b = Object.values(this.fetchedMintingUpdates).flat(1).length;
		const isDiff = a > b;

		if (isDiff) this.logger.log(`MintingUpdates V2 merging, from ${b} to ${a} entries`);
		this.fetchedMintingUpdates = { ...this.fetchedMintingUpdates, ...list };

		return list;
	}
}
