import { PositionQuery } from 'positions/positions.types';
import { formatCurrency, safeMarkdown } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function PositionExpiredMessage(position: PositionQuery): string {
	const bal: number = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const min: number = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price: number = parseInt(formatUnits(BigInt(position.price), 36 - position.collateralDecimals - 2)) / 100;
	const duration: number = position.challengePeriod * 1000;
	const collateralName = safeMarkdown(position.collateralName);
	const collateralSymbol = safeMarkdown(position.collateralSymbol);

	const begin = new Date(position.expiration * 1000);
	const mid = new Date(position.expiration * 1000 + 1 * duration);
	const zero = new Date(position.expiration * 1000 + 2 * duration);

	const header = `
*Position is expired*

Position: ${position.position} (v${position.version})
Owner: ${position.owner}

Principal: ${formatCurrency(formatUnits(BigInt(position.principal), 18), 2, 2)} dEURO
Retained Reserve: ${formatCurrency(position.reserveContribution / 10000, 1, 1)}%
Auction Duration: ${Math.floor(position.challengePeriod / 60 / 60)} hours

Collateral: ${collateralName} (${collateralSymbol})
At: ${position.collateral}
Balance: ${formatCurrency(bal, 2, 2)} ${collateralSymbol}
Bal. min.: ${formatCurrency(min, 2, 2)} ${collateralSymbol}
`;

	const body = `
*ForceSell is available*

Declines (10x -> 1x Price): ${begin.toUTCString()}
Price (10x): ${formatCurrency(price * 10, 2, 2)} dEURO per 1 ${collateralSymbol}

Continues (1x -> 0x Price): ${mid.toUTCString()}
Price (1x): ${formatCurrency(price, 2, 2)} dEURO per 1 ${collateralSymbol}

Zero: ${zero.toUTCString()}
Price (0x): 0.00 dEURO per 1 ${collateralSymbol}
`;

	const footer = `

[Overview Position](${AppUrl(`/monitoring/${position.position}`)})
[Buy Collateral](${AppUrl(`/monitoring/${position.position}/forceSell`)})

[Explorer Position](${ExplorerAddressUrl(position.position)})
[Explorer Owner](${ExplorerAddressUrl(position.owner)})
[Explorer Collateral](${ExplorerAddressUrl(position.collateral)})
`;

	return header + body + footer;
}
