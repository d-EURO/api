import { MintingUpdateQuery } from 'positions/positions.types';
import { PriceQuery, PriceQueryObjectArray } from 'prices/prices.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';
import { AppUrl, ExplorerAddressUrl, ExplorerTxUrl } from 'utils/func-helper';

export function MintingUpdateMessage(minting: MintingUpdateQuery, prices: PriceQueryObjectArray): string {
	const marketPrice = (prices[minting.collateral.toLowerCase()] as PriceQuery).price?.chf || 1;

	const liqPrice = parseFloat(formatUnits(BigInt(minting.price), 36 - minting.collateralDecimals));
	// const liqPriceAdjusted = parseFloat(formatUnits(BigInt(minting.priceAdjusted), 36 - minting.collateralDecimals));

	const ratio = marketPrice / liqPrice;
	// const ratioAdjusted = marketPrice / liqPriceAdjusted;

	const minted = parseFloat(formatUnits(BigInt(minting.minted), 18));
	const mintedAdjusted = parseFloat(formatUnits(BigInt(minting.mintedAdjusted), 18));

	const timefram = Math.round(minting.feeTimeframe / 60 / 60 / 24);

	const absStr = (n: number) => (n >= 0 ? '+' : '-');

	return `
*New Minting Update*

Position: ${minting.position}
Owner: ${minting.owner}
[App Position](${AppUrl(`/monitoring/${minting.position}`)})

Collateral: ${minting.collateralName} (${minting.collateralSymbol})
Market Price: ${formatCurrency(marketPrice, 2)} ZCHF
Liq. Price: ${formatCurrency(liqPrice, 2)} ZCHF
*Ratio: ${formatCurrency(ratio * 100, 2)}%*

Minted: ${formatCurrency(minted, 2)} ZCHF
*Changed: ${absStr(mintedAdjusted)}${formatCurrency(mintedAdjusted, 2)} ZCHF*

Annual Interest: ${formatCurrency(minting.annualInterestPPM / 10000, 2)}%
Reserve: ${formatCurrency(minting.reserveContribution / 10000, 2)}%

FeeTimeframe: ${timefram} days
FeePct: ${formatCurrency(minting.feePPM / 10000, 2)}%
*FeePaid: ${formatCurrency(formatUnits(BigInt(minting.feePaid), 18), 2)} ZCHF*

[Explorer Position](${ExplorerAddressUrl(minting.position)})
[Explorer Owner](${ExplorerAddressUrl(minting.owner)})
[Explorer Collateral](${ExplorerAddressUrl(minting.collateral)})
[Explorer Transaction](${ExplorerTxUrl(minting.txHash)})
`;
}
