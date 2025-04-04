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
import { COINGECKO_CLIENT, VIEM_CHAIN, VIEM_CONFIG } from 'api.config';
import { Address } from 'viem';
import { EcosystemDepsService as EcosystemDepsService } from 'ecosystem/ecosystem.deps.service';
import { ADDRESS } from '@deuro/eurocoin';
import { formatUnits } from 'viem';

const randRef: number = Math.random() * 0.4 + 0.8;

enum ZchfEcosystem {
	WFPS = '0x5052D3Cc819f53116641e89b96Ff4cD1EE80B182',
	FPS = '0x1bA26788dfDe592fec8bcB0Eaff472a42BE341B2',
	ZCHF = '0xB58E61C3098d85632Df34EecfB899A1Ed80921cB',
}

@Injectable()
export class PricesService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedPrices: PriceQueryObjectArray = {};
	private euroPrice: PriceQueryCurrencies = {};

	constructor(
		private readonly positionsService: PositionsService,
		private readonly deps: EcosystemDepsService
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
			address: p.deuro,
			name: p.deuroName,
			symbol: p.deuroSymbol,
			decimals: p.deuroDecimals,
		};
	}

	getDeps(): ApiPriceERC20 {
		return {
			address: ADDRESS[VIEM_CHAIN.id].equity,
			name: 'Decentralized Euro Pool Share',
			symbol: 'DEPS',
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

	getEuroPrice(): PriceQueryCurrencies {
		return this.euroPrice;
	}

	async fetchFromEcosystemDeps(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const price = this.deps.getEcosystemDepsInfo()?.values?.price;
		if (!price) return null;

		const deuroAddress = ADDRESS[VIEM_CHAIN.id].decentralizedEURO.toLowerCase();
		const quote = this.euroPrice?.usd || this.fetchedPrices[deuroAddress]?.price?.usd;
		const usdPrice = quote ? price * quote : price;

		return { usd: usdPrice, eur: price };
	}

	async fetchSourcesCoingecko(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		// all mainnet addresses
		if ((VIEM_CHAIN.id as number) === 1) {
			const url = `/api/v3/simple/token_price/ethereum?contract_addresses=${erc.address}&vs_currencies=usd%2Ceur`;
			const data = await(await COINGECKO_CLIENT(url)).json();
			if (data.status) {
				this.logger.debug(data.status?.error_message || 'Error fetching price from coingecko');
				return null;
			}
			return Object.values(data)[0] as { usd: number; eur: number };
		} else {
			// all other chain addresses (test deployments)
			const calc = (value: number) => {
				const ref: number = 1718033809979;
				return value * randRef * (1 + ((Date.now() - ref) / (3600 * 24 * 365)) * 0.001 + Math.random() * 0.01);
			};

			// @dev: this is just for testnet soft price mapping
			let price = { usd: calc(1) };
			if (erc.symbol === 'dEURO') price = { usd: calc(1.12) };
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

	async fetchEuroPrice(): Promise<PriceQueryCurrencies | null> {
		const url = `/api/v3/simple/price?ids=usd&vs_currencies=eur`;
		const data = await (await COINGECKO_CLIENT(url)).json();
		if (data.status) {
			this.logger.debug(data.status?.error_message || 'Error fetching price from coingecko');
			return null;
		}
		return { eur: 1, usd: 1 / Number(data.usd.eur) };
	}

	async fetchFromZchfSources(): Promise<PriceQueryCurrencies | null> {
		const { FPS, ZCHF } = ZchfEcosystem;
		const priceZchf = await this.fetchSourcesCoingecko({ address: ZCHF, name: 'ZCHF', symbol: 'ZCHF', decimals: 18 });
		if (!priceZchf) return null;

		const priceWfps = await VIEM_CONFIG.readContract({
			address: FPS,
			abi: [
				{
					inputs: [],
					name: 'price',
					outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
					stateMutability: 'view',
					type: 'function',
				},
			],
			functionName: 'price',
			args: [],
		});
		if (!priceWfps) return null;

		return { usd: priceZchf.usd * parseFloat(formatUnits(priceWfps, 18)) };
	}

	async fetchPrice(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		if (
			erc.address.toLowerCase() === ADDRESS[VIEM_CHAIN.id].equity.toLowerCase() ||
			erc.address.toLowerCase() === ADDRESS[VIEM_CHAIN.id].DEPSwrapper.toLowerCase()
		) {
			return this.fetchFromEcosystemDeps(erc);
		} else if (
			erc.address.toLowerCase() === ZchfEcosystem.WFPS.toLowerCase() ||
			erc.address.toLowerCase() === ZchfEcosystem.FPS.toLowerCase()
		) {
			return this.fetchFromZchfSources();
		} else {
			return this.fetchSourcesCoingecko(erc);
		}
	}

	async updatePrices() {
		this.logger.debug('Updating Prices');

		const euroPrice = await this.fetchEuroPrice();
		if (euroPrice) this.euroPrice = euroPrice;

		const deps = this.getDeps();
		const m = this.getMint();
		const c = this.getCollateral();

		if (!m || Object.values(c).length == 0) return;
		const a = [deps, m, ...Object.values(c)];

		const pricesQuery: PriceQueryObjectArray = {};
		let pricesQueryNewCount: number = 0;
		let pricesQueryNewCountFailed: number = 0;
		let pricesQueryUpdateCount: number = 0;
		let pricesQueryUpdateCountFailed: number = 0;

		for (const erc of a) {
			const addr = erc.address.toLowerCase() as Address;
			const oldEntry = this.fetchedPrices[addr];

			if (!oldEntry) {
				pricesQueryNewCount += 1;
				this.logger.debug(`Price for ${erc.name} not available, trying to fetch...`);
				const price = await this.fetchPrice(erc);
				if (!price) pricesQueryNewCountFailed += 1;

				pricesQuery[addr] = {
					...erc,
					timestamp: price === null ? 0 : Date.now(),
					price: price === null ? { usd: 1 } : price,
				};
			} else if (oldEntry.timestamp + 300_000 < Date.now()) {
				// needs to update => try to fetch
				pricesQueryUpdateCount += 1;
				this.logger.debug(`Price for ${erc.name} out of date, trying to fetch...`);
				const price = await this.fetchPrice(erc);

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

			const deuroPrice: number =
				this.euroPrice?.usd || this.fetchedPrices[ADDRESS[VIEM_CHAIN.id].decentralizedEURO.toLowerCase()]?.price?.usd;

			if (deuroPrice) {
				const priceUsd = pricesQuery[addr]?.price?.usd;
				const priceEur = pricesQuery[addr]?.price?.eur;
				if (priceUsd && !priceEur) {
					const priceChf = Math.round((priceUsd / deuroPrice) * 100) / 100;
					pricesQuery[addr].price.eur = priceChf;
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
