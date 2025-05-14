import { CONFIG } from 'api.config';
import { createRefCode } from 'socialmedia/socialmedia.helper';
import { TradeQuery } from 'trades/trade.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function TradeMessage(trade: TradeQuery, marketCap: number, totalShares: bigint): string[] {
	const refCode = createRefCode(trade.frontendCode);
	const usedRef = refCode ? `🪢 used Ref: ${refCode}` : '';

	const actualShares = Number(formatUnits(totalShares, 18));
	const sharesBefore = actualShares - Number(formatUnits(BigInt(trade.shares), 18));
	const position = sharesBefore ? ((actualShares - sharesBefore) / sharesBefore) * 100 : 100;

	const price = Number(formatUnits(BigInt(trade.amount), 18)) / Number(formatUnits(BigInt(trade.shares), 18));

	const message = `
nDEPS/DEPS Invest!

➡️ Spent ${formatCurrency(formatUnits(BigInt(trade.amount), 18))} dEURO 
⬅️ Got ${formatCurrency(formatUnits(BigInt(trade.shares), 18))} nDEPS
🔗 Verifiable on the blockchain
🪙 Position +${position.toFixed(2)}%
🏷 Price ${formatCurrency(price)} €
💸 Market Cap ${formatCurrency(marketCap)} €
${usedRef}
`;

	const image = `${CONFIG.twitter.imagesDir}/EquityInvest.png`;

	return [message, image];
}
