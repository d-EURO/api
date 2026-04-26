import { PositionQuery } from 'positions/positions.types';
import { formatCurrency, safeMarkdown } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

/**
 * Fired once when an expired position enters phase 2 of the forced-sale decay
 * (price drops linearly from 1× to 0× liq-price over one challengePeriod).
 * Phase 2 is the actionable arbitrage window before the equity reserve absorbs
 * the loss via coverLoss.
 */
export function PositionPhase2Message(position: PositionQuery): string {
	const bal: number = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const min: number = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price: number = parseInt(formatUnits(BigInt(position.price), 36 - position.collateralDecimals - 2)) / 100;
	const collateralName = safeMarkdown(position.collateralName);
	const collateralSymbol = safeMarkdown(position.collateralSymbol);
	const phase2Start = new Date((position.expiration + position.challengePeriod) * 1000);
	const phase2End = new Date((position.expiration + position.challengePeriod * 2) * 1000);

	return `
*Forced-sale phase 2 entered*

Position: ${position.position} (v${position.version})
Owner: ${position.owner}

Principal: ${formatCurrency(formatUnits(BigInt(position.principal), 18), 2, 2)} dEURO
Retained Reserve: ${formatCurrency(position.reserveContribution / 10000, 1, 1)}%
Auction Duration: ${Math.floor(position.challengePeriod / 60 / 60)} hours
Liq. Price: ${formatCurrency(price, 2, 2)} dEURO per 1 ${collateralSymbol}

Phase 2 window:
Start: ${phase2Start.toUTCString()}  (price = 1× liq)
End:   ${phase2End.toUTCString()}  (price = 0)

Collateral: ${collateralName} (${collateralSymbol})
At: ${position.collateral}
Balance: ${formatCurrency(bal, 2, 2)} ${collateralSymbol}
Bal. min.: ${formatCurrency(min, 2, 2)} ${collateralSymbol}

This is the arbitrage window — call MintingHub.buyExpiredCollateral
to repay the debt at decay price before the equity reserve covers
the gap.

[Overview Position](${AppUrl(`/monitoring/${position.position}`)})
[Buy Collateral](${AppUrl(`/monitoring/${position.position}/forceSell`)})

[Explorer Position](${ExplorerAddressUrl(position.position)})
[Explorer Owner](${ExplorerAddressUrl(position.owner)})
[Explorer Collateral](${ExplorerAddressUrl(position.collateral)})
                        `;
}
