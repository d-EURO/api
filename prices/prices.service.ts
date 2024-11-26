import { Injectable, Logger } from '@nestjs/common';
import {
	ApiPriceERC20,
	ApiPriceERC20Mapping,
	ApiPriceListing,
	ApiPriceMapping,
	ERC20Info,
	ERC20InfoObjectArray,
	PriceQueryCurrencies,
	PriceQueryObjectArray,
} from './prices.types';
import { PositionsService } from 'positions/positions.service';
import { COINGECKO_CLIENT, VIEM_CHAIN } from 'api.config';
import { Address } from 'viem';
import { EcosystemFpsService } from 'ecosystem/ecosystem.fps.service';
import { ADDRESS } from '@frankencoin/zchf';

const randRef: number = Math.random() * 0.4 + 0.8;

@Injectable()
export class PricesService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedPrices: PriceQueryObjectArray = {};

	constructor(
		private readonly positionsService: PositionsService,
		private readonly fps: EcosystemFpsService
	) {}

	getPrices(): ApiPriceListing {
		return Object.values(this.fetchedPrices);
	}

	getPricesMapping(): ApiPriceMapping {
		return this.fetchedPrices;
	}

	getMint(): ApiPriceERC20 {
		const p = Object.values(this.positionsService.getPositionsList().list)[0];
		if (!p) return null;
		return {
			address: p.zchf,
			name: p.zchfName,
			symbol: p.zchfSymbol,
			decimals: p.zchfDecimals,
		};
	}

	getFps(): ApiPriceERC20 {
		return {
			address: ADDRESS[VIEM_CHAIN.id].equity,
			name: 'Frankencoin Pool Share',
			symbol: 'FPS',
			decimals: 18,
		};
	}

	getCollateral(): ApiPriceERC20Mapping {
		const pos = Object.values(this.positionsService.getPositionsList().list);
		const c: ERC20InfoObjectArray = {};

		for (const p of pos) {
			c[p.collateral.toLowerCase()] = {
				address: p.collateral,
				name: p.collateralName,
				symbol: p.collateralSymbol,
				decimals: p.collateralDecimals,
			};
		}

		return c;
	}

	async fetchSourcesCoingecko(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		// override for Frankencoin Pool Share
		if (erc.address.toLowerCase() === ADDRESS[VIEM_CHAIN.id].equity.toLowerCase()) {
			const priceInChf = this.fps.getEcosystemFpsInfo()?.values?.price;
			const zchfAddress = ADDRESS[VIEM_CHAIN.id].frankenCoin.toLowerCase();
			const zchfPrice: number = this.fetchedPrices[zchfAddress]?.price?.usd;
			if (!zchfPrice) return null;
			return { usd: priceInChf * zchfPrice };
		}

		// all mainnet addresses
		if ((VIEM_CHAIN.id as number) === 1) {
			const url = `/api/v3/simple/token_price/ethereum?contract_addresses=${erc.address}&vs_currencies=usd`;
			const data = await (await COINGECKO_CLIENT(url)).json();
			if (data.status) {
				this.logger.debug(data.status?.error_message || 'Error fetching price from coingecko');
				return null;
			}
			return Object.values(data)[0] as { usd: number };
		} else {
			// all other chain addresses (test deployments)
			const calc = (value: number) => {
				const ref: number = 1718033809979;
				return value * randRef * (1 + ((Date.now() - ref) / (3600 * 24 * 365)) * 0.001 + Math.random() * 0.01);
			};

			// @dev: this is just for testnet soft price mapping
			let price = { usd: calc(1) };
			if (erc.symbol === 'ZCHF') price = { usd: calc(1.12) };
			if (erc.symbol === 'BTC') price = { usd: calc(69000) };
			if (erc.symbol === 'WBTC') price = { usd: calc(69000) };
			if (erc.symbol === 'ETH') price = { usd: calc(3800) };
			if (erc.symbol === 'WETH') price = { usd: calc(3800) };
			if (erc.symbol === 'UNI') price = { usd: calc(10.54) };
			if (erc.symbol === 'SUP') price = { usd: calc(12453) };
			if (erc.symbol === 'BOSS') price = { usd: calc(11.54) };
			if (erc.symbol === 'BEES') price = { usd: calc(16) };
			if (erc.symbol === 'CRV') price = { usd: calc(500) };
			if (erc.symbol === 'FLOKI') price = { usd: calc(1400) };
			return price;
		}
	}

	async updatePrices() {
		this.logger.debug('Updating Prices');

		const fps = this.getFps();
		const m = this.getMint();
		const c = this.getCollateral();

		if (!m || Object.values(c).length == 0) return;
		const a = [fps, m, ...Object.values(c)];

		const pricesQuery: PriceQueryObjectArray = {};
		let pricesQueryNewCount: number = 0;
		let pricesQueryNewCountFailed: number = 0;
		let pricesQueryUpdateCount: number = 0;
		let pricesQueryUpdateCountFailed: number = 0;

		const zchfPrice: number = this.fetchedPrices[ADDRESS[VIEM_CHAIN.id].frankenCoin.toLowerCase()]?.price?.usd;

		for (const erc of a) {
			const addr = erc.address.toLowerCase() as Address;
			const oldEntry = this.fetchedPrices[addr];

			if (!oldEntry) {
				pricesQueryNewCount += 1;
				this.logger.debug(`Price for ${erc.name} not available, trying to fetch from coingecko`);
				const price = await this.fetchSourcesCoingecko(erc);
				if (!price) pricesQueryNewCountFailed += 1;

				pricesQuery[addr] = {
					...erc,
					timestamp: price === null ? 0 : Date.now(),
					price: price === null ? { usd: 1 } : price,
				};

				continue;
			}

			// needs to update => try to fetch
			if (oldEntry.timestamp + 300_000 < Date.now()) {
				pricesQueryUpdateCount += 1;
				this.logger.debug(`Price for ${erc.name} out of date, trying to fetch from coingecko`);
				const price = await this.fetchSourcesCoingecko(erc);

				if (!price) {
					pricesQueryUpdateCountFailed += 1;
				} else {
					pricesQuery[addr] = {
						...erc,
						timestamp: Date.now(),
						price,
					};
				}
			}

			if (zchfPrice) {
				const priceUsd = this.fetchedPrices[addr]?.price?.usd;
				if (priceUsd) {
					const priceChf = Math.round((priceUsd / zchfPrice) * 100) / 100;
					this.fetchedPrices[addr].price.chf = priceChf;
				}
			}
		}

		const updatesCnt = pricesQueryNewCount + pricesQueryUpdateCount;
		const fromNewStr = `from new ${pricesQueryNewCount - pricesQueryNewCountFailed} / ${pricesQueryNewCount}`;
		const fromUpdateStr = `from update ${pricesQueryUpdateCount - pricesQueryUpdateCountFailed} / ${pricesQueryUpdateCount}`;

		if (updatesCnt > 0) this.logger.log(`Prices merging, ${fromNewStr}, ${fromUpdateStr}`);
		this.fetchedPrices = { ...this.fetchedPrices, ...pricesQuery };
	}
}
