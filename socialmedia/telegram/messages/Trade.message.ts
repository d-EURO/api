import { CONFIG } from 'api.config';
import { createRefCodeLabelLink } from 'socialmedia/socialmedia.helper';
import { TradeQuery } from 'trades/trade.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function TradeMessage(trade: TradeQuery, marketCap: number, totalShares: bigint): string[] {
	const refCodeLabelLink = createRefCodeLabelLink(trade.frontendCode);
	const usedRef = refCodeLabelLink ? `🪢 used Ref: ${refCodeLabelLink}` : '';

	const actualShares = Number(formatUnits(totalShares, 18));
	const sharesBefore = actualShares - Number(formatUnits(BigInt(trade.shares), 18));
	const position = sharesBefore ? ((actualShares - sharesBefore) / sharesBefore) * 100 : 100;

	const price = Number(formatUnits(BigInt(trade.amount), 18)) / Number(formatUnits(BigInt(trade.shares), 18));

	const message = `
*nDEPS/DEPS Invest!*

➡️ Spent ${formatCurrency(formatUnits(BigInt(trade.amount), 18))} dEURO 
⬅️ Got ${formatCurrency(formatUnits(BigInt(trade.shares), 18))} nDEPS
👤 [Buyer](https://etherscan.io/address/${trade.trader}) / [TX](https://etherscan.io/tx/${trade.txHash})
🪙 Position +${position.toFixed(2)}%
🏷 Price ${formatCurrency(price)} €
💸 Market Cap ${formatCurrency(marketCap)} €
${usedRef}
`;

	const image = `${CONFIG.telegram.imagesDir}/EquityInvest.mp4`;

	return [message, image];
}
