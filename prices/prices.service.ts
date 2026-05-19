import { ADDRESS } from '@deuro/eurocoin';
import { Injectable, Logger } from '@nestjs/common';
import { COINGECKO_CLIENT, VIEM_CHAIN, VIEM_CONFIG } from 'api.config';
import { EcosystemDepsService } from 'ecosystem/ecosystem.deps.service';
import { PositionsService } from 'positions/positions.service';
import { Address, formatUnits } from 'viem';
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
	private euroPriceTimestamp: number = 0;
	private depsPrice: PriceQueryCurrencies = {};

	private static readonly EURO_PRICE_TTL = 60_000; // 60 seconds

	constructor(
		private readonly positionsService: PositionsService,
		private readonly deps: EcosystemDepsService
	) {}

	private isEuroPriceStale(): boolean {
		return !this.euroPrice?.usd || Date.now() - this.euroPriceTimestamp > PricesService.EURO_PRICE_TTL;
	}

	private async refreshEuroPriceIfStale(): Promise<void> {
		if (this.isEuroPriceStale()) {
			const fetched = await this.fetchEuroPrice();
			if (fetched) {
				this.euroPrice = fetched;
				this.euroPriceTimestamp = Date.now();
			}
		}
	}

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

	async getDepsPrice(): Promise<PriceQueryCurrencies> {
		if (!this.depsPrice?.usd) this.depsPrice = await this.fetchFromEcosystemDeps(this.getDeps());
		await this.refreshEuroPriceIfStale();

		return {
			usd: Number(this.depsPrice.usd.toFixed(4)),
			eur: Number(this.depsPrice.eur.toFixed(4)),
			btc: Number((this.depsPrice.eur * this.euroPrice.btc).toFixed(9)),
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

	async getEuroPrice(): Promise<PriceQueryCurrencies> {
		await this.refreshEuroPriceIfStale();

		return {
			usd: Number(this.euroPrice.usd.toFixed(4)),
			eur: Number(this.euroPrice.eur.toFixed(4)),
			btc: Number(this.euroPrice.btc.toFixed(9)),
		};
	}

	async fetchFromEcosystemDeps(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const price = this.deps.getEcosystemDepsInfo()?.values?.price;
		if (!price) return null;

		const deuroAddress = ADDRESS[VIEM_CHAIN.id].decentralizedEURO.toLowerCase();
		const quote = this.euroPrice?.usd || this.fetchedPrices[deuroAddress]?.price?.usd;
		const usdPrice = quote ? price * quote : price;

		this.depsPrice = { usd: usdPrice, eur: price };
		return this.depsPrice;
	}

	async fetchSourcesCoingecko(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		// all mainnet addresses
		if ((VIEM_CHAIN.id as number) === 1) {
			const batch = await this.fetchSourcesCoingeckoBatch([erc]);
			const price = batch[erc.address.toLowerCase()];
			return price === undefined ? null : price;
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

	// CoinGecko allows comma-separated contract_addresses to price up to
	// 100 ERC-20s in a single mainnet request. Caller is responsible for
	// chunking. Returned keys are lowercase addresses; missing addresses are
	// absent from the result.
	async fetchSourcesCoingeckoBatch(ercs: ERC20Info[]): Promise<{ [lowercaseAddr: string]: PriceQueryCurrencies }> {
		if (ercs.length === 0) return {};
		if ((VIEM_CHAIN.id as number) !== 1) {
			// testnet path: fall back to per-token soft mapping
			const out: { [lowercaseAddr: string]: PriceQueryCurrencies } = {};
			for (const erc of ercs) {
				const price = await this.fetchSourcesCoingecko(erc);
				if (price) out[erc.address.toLowerCase()] = price;
			}
			return out;
		}

		const joined = ercs.map((e) => e.address).join(',');
		const url = `/api/v3/simple/token_price/ethereum?contract_addresses=${joined}&vs_currencies=usd%2Ceur`;
		const data = await (await COINGECKO_CLIENT(url)).json();
		if (data.status) {
			this.logger.debug(data.status?.error_message || 'Error fetching prices from coingecko');
			return {};
		}

		// CoinGecko returns lowercased keys; build a deterministic map.
		const out: { [lowercaseAddr: string]: PriceQueryCurrencies } = {};
		for (const erc of ercs) {
			const key = erc.address.toLowerCase();
			const entry = data[key] as { usd?: number; eur?: number } | undefined;
			if (entry && typeof entry.usd === 'number') out[key] = entry;
		}
		return out;
	}

	async fetchEuroPrice(): Promise<PriceQueryCurrencies | null> {
		const url = `/api/v3/simple/price?ids=tether&vs_currencies=eur%2Cbtc`;
		const data = await (await COINGECKO_CLIENT(url)).json();
		if (data.status) {
			this.logger.debug(data.status?.error_message || 'Error fetching price from coingecko');
			return null;
		}

		return {
			eur: 1,
			usd: 1 / Number(data.tether.eur),
			btc: 1 / Number(data.tether.eur / data.tether.btc),
		};
	}

	// Derive the FPS/WFPS unit price from a known ZCHF spot price by
	// multiplying with the on-chain FPS.price(). Split out of the old
	// `fetchFromZchfSources` so updatePrices can pass in a single ZCHF
	// price fetched once per cycle (was previously a second CoinGecko call).
	async fetchFpsUsdFromZchf(zchfPriceUsd: number): Promise<number | null> {
		const priceWfps = await VIEM_CONFIG.readContract({
			address: ZchfEcosystem.FPS,
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
		return zchfPriceUsd * parseFloat(formatUnits(priceWfps, 18));
	}

	async updatePrices() {
		this.logger.debug('Updating Prices');

		await this.refreshEuroPriceIfStale();

		const deps = this.getDeps();
		const m = this.getMint();
		const c = this.getCollateral();

		if (!m || Object.values(c).length == 0) return;
		const a = [deps, m, ...Object.values(c)];

		const now = Date.now();
		const STALE_MS = 300_000;
		const equityLower = ADDRESS[VIEM_CHAIN.id].equity.toLowerCase();
		const wrapperLower = ADDRESS[VIEM_CHAIN.id].DEPSwrapper.toLowerCase();
		const fpsLower = ZchfEcosystem.FPS.toLowerCase();
		const wfpsLower = ZchfEcosystem.WFPS.toLowerCase();
		const zchfLower = ZchfEcosystem.ZCHF.toLowerCase();

		// Classify every token that needs a refresh by price source. The for-loop
		// below used to call `fetchPrice` per token, which produced N+1 CoinGecko
		// calls per cycle (one HTTP request per collateral). We now collect all
		// CoinGecko-priced addresses first and resolve them in a single batch
		// request below. ZCHF appears at most once even when it's both a
		// collateral and the basis for the FPS/WFPS derivative price.
		const cgBatch = new Map<string, ERC20Info>();
		let needZchfForFps = false;

		for (const erc of a) {
			const addr = erc.address.toLowerCase();
			const oldEntry = this.fetchedPrices[addr as Address];
			const isStale = !oldEntry || oldEntry.timestamp + STALE_MS < now;
			if (!isStale) continue;

			if (addr === equityLower || addr === wrapperLower) continue; // DEPS path, no CoinGecko
			if (addr === fpsLower || addr === wfpsLower) {
				needZchfForFps = true;
				continue;
			}
			cgBatch.set(addr, erc);
		}

		if (needZchfForFps && !cgBatch.has(zchfLower)) {
			// FPS/WFPS pricing needs the ZCHF spot, but ZCHF itself isn't a
			// collateral this cycle. Add it as a transient batch entry; we keep
			// track of it so we don't write it into pricesQuery below.
			cgBatch.set(zchfLower, { address: ZchfEcosystem.ZCHF, name: 'ZCHF', symbol: 'ZCHF', decimals: 18 });
		}

		const cgPrices = await this.fetchSourcesCoingeckoBatch(Array.from(cgBatch.values()));
		const zchfBatched = cgPrices[zchfLower];
		const fpsUsd =
			needZchfForFps && zchfBatched && typeof zchfBatched.usd === 'number' ? await this.fetchFpsUsdFromZchf(zchfBatched.usd) : null;

		const pricesQuery: PriceQueryObjectArray = {};
		let pricesQueryNewCount: number = 0;
		let pricesQueryNewCountFailed: number = 0;
		let pricesQueryUpdateCount: number = 0;
		let pricesQueryUpdateCountFailed: number = 0;

		const resolvePrice = async (erc: ERC20Info): Promise<PriceQueryCurrencies | null> => {
			const addr = erc.address.toLowerCase();
			if (addr === equityLower || addr === wrapperLower) {
				return this.fetchFromEcosystemDeps(erc);
			}
			if (addr === fpsLower || addr === wfpsLower) {
				return fpsUsd === null ? null : { usd: fpsUsd };
			}
			const batched = cgPrices[addr];
			return batched === undefined ? null : batched;
		};

		for (const erc of a) {
			const addr = erc.address.toLowerCase() as Address;
			const oldEntry = this.fetchedPrices[addr];

			if (!oldEntry) {
				pricesQueryNewCount += 1;
				this.logger.debug(`Price for ${erc.name} not available, trying to fetch...`);
				const price = await resolvePrice(erc);
				if (!price) pricesQueryNewCountFailed += 1;

				pricesQuery[addr] = {
					...erc,
					timestamp: price === null ? 0 : now,
					price: price === null ? { usd: 1 } : price,
				};
			} else if (oldEntry.timestamp + STALE_MS < now) {
				// needs to update => try to resolve
				pricesQueryUpdateCount += 1;
				this.logger.debug(`Price for ${erc.name} out of date, trying to fetch...`);
				const price = await resolvePrice(erc);

				if (!price) {
					pricesQueryUpdateCountFailed += 1;
					// bump timestamp on failure so we honour the 5-minute retry window
					// instead of refetching on every block tick when a token has no price source
					pricesQuery[addr] = { ...oldEntry, timestamp: now };
				} else {
					pricesQuery[addr] = {
						...erc,
						timestamp: now,
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
					pricesQuery[addr].price.eur = Math.round((priceUsd / deuroPrice) * 100) / 100;
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
