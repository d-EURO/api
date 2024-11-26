import { ChallengesQueryItem } from 'challenges/challenges.types';
import { PositionQuery } from 'positions/positions.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function ChallengeStartedMessage(position: PositionQuery, challenge: ChallengesQueryItem): string {
	const size: number = parseInt(formatUnits(BigInt(challenge.size), position.collateralDecimals - 2)) / 100;
	const min: number = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price: number = parseInt(formatUnits(BigInt(challenge.liqPrice), 36 - position.collateralDecimals - 2)) / 100;
	const duration: number = parseInt(challenge.duration.toString()) * 1000;

	const startChallenge: number = parseInt(challenge.start.toString()) * 1000;
	const expirationChallengeVirtual: number = startChallenge + 2 * duration;
	const expirationPosition: number = position.expiration * 1000;
	const isQuickAuction: boolean = expirationChallengeVirtual > expirationPosition;
	const expirationChallenge: number = Math.min(expirationChallengeVirtual, expirationPosition);
	const expirationPhase1: number | undefined = isQuickAuction ? undefined : startChallenge + duration;

	return `
*New Challenge Started*

Id: ${challenge.id}
Challenger: ${challenge.challenger}
Position: ${position.position}
Owner: ${position.owner}

Collateral: ${position.collateralName} (${position.collateralSymbol})
At: ${position.collateral}
Size: ${formatCurrency(size, 2, 2)} ${position.collateralSymbol}
Min: ${formatCurrency(min, 2, 2)} ${position.collateralSymbol}
Starting Price: ${formatCurrency(price, 2, 2)} ZCHF

Duration: ${formatCurrency(duration / 1000 / 60 / 60, 1, 1)} hours
Quick Auction: ${isQuickAuction}
Begin: ${new Date(startChallenge).toString().split(' ').slice(0, 5).join(' ')}
Phase1 End: ${new Date(expirationPhase1).toString().split(' ').slice(0, 5).join(' ')}
Phase2 End: ${new Date(expirationChallenge).toString().split(' ').slice(0, 5).join(' ')}

[Buy ${position.collateralSymbol} in Auction](${AppUrl(`/challenges/${challenge.id}/bid`)})
[Goto Position](${AppUrl(`/monitoring/${position.position}`)})

[Explorer Challenger](${ExplorerAddressUrl(challenge.challenger)}) 
[Explorer Position](${ExplorerAddressUrl(position.position)})
[Explorer Owner](${ExplorerAddressUrl(position.owner)}) 
[Explorer Collateral](${ExplorerAddressUrl(position.collateral)}) 
                        `;
}
