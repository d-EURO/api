import { PositionQuery } from 'positions/positions.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function PositionMiniLifetimeMessage(position: PositionQuery): string {
	const lifetimeSeconds = position.expiration - position.created;
	const bal: number = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const min: number = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price: number = parseInt(formatUnits(BigInt(position.price), 36 - position.collateralDecimals - 2)) / 100;

	return `
*Suspicious clone detected*

Position: ${position.position} (v${position.version})
Owner: ${position.owner}

Lifetime: ${lifetimeSeconds} seconds
Principal: ${formatCurrency(formatUnits(BigInt(position.principal), 18), 2, 2)} dEURO
Retained Reserve: ${formatCurrency(position.reserveContribution / 10000, 1, 1)}%
Auction Duration: ${Math.floor(position.challengePeriod / 60 / 60)} hours

Collateral: ${position.collateralName} (${position.collateralSymbol})
At: ${position.collateral}
Balance: ${formatCurrency(bal, 2, 2)} ${position.collateralSymbol}
Bal. min.: ${formatCurrency(min, 2, 2)} ${position.collateralSymbol}
Price: ${formatCurrency(price, 2, 2)} dEURO

This pattern matches the WFPS forced-sale attack vector — a clone with
sub-day lifetime, set up to be drained via expiredPurchasePrice decay.
Mitigation: open a challenge or call buyExpiredCollateral once the
position enters phase 2.

[Overview Position](${AppUrl(`/monitoring/${position.position}`)})

[Explorer Position](${ExplorerAddressUrl(position.position)})
[Explorer Owner](${ExplorerAddressUrl(position.owner)})
[Explorer Collateral](${ExplorerAddressUrl(position.collateral)})
                        `;
}
