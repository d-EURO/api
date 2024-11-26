import { BidsQueryItem, ChallengesQueryItem } from 'challenges/challenges.types';
import { PositionQuery } from 'positions/positions.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function BidTakenMessage(position: PositionQuery, challenge: ChallengesQueryItem, bid: BidsQueryItem): string {
	return `
*New Bid Taken*

Position: ${bid.position} 
Bidder: ${bid.bidder}
Challenge Index: ${bid.number}
Bid Index: ${bid.numberBid}
Bid Type: *${bid.bidType}*

Collateral: ${position.collateralName} (${position.collateralSymbol})
Challenge Size: ${formatCurrency(formatUnits(bid.challengeSize, position.collateralDecimals))} ${position.collateralSymbol}

Bid Amount: ${formatCurrency(formatUnits(bid.bid, 18))} ZCHF
Bid Filled: ${formatCurrency(formatUnits(bid.filledSize, position.collateralDecimals))} ${position.collateralSymbol}
Bid Price: ${formatCurrency(formatUnits(bid.price, 36 - position.collateralDecimals))} ZCHF/${position.collateralSymbol}

[Buy ${position.collateralSymbol} in Auction](${AppUrl(`/challenges/${challenge.id}/bid`)})
[Goto Position](${AppUrl(`/monitoring/${bid.position}`)})

[Explorer Bidder](${ExplorerAddressUrl(bid.bidder)}) 
[Explorer Position](${ExplorerAddressUrl(bid.position)})
                        `;
}
