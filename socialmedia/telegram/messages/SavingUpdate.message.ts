import { CONFIG } from 'api.config';
import { FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import { createRefCode } from 'socialmedia/socialmedia.helper';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function SavingUpdateMessage(saving: FrontendCodeSavingsQuery): string[] {
	const refCode = createRefCode(saving.frontendCode);
	const usedRef = refCode ? `🪢 used Ref: [${refCode}](https://app.deuro.com?ref=${refCode})` : '';

	const message = `
*New dEURO Savings!*

🔏 Savings Amount: *${formatCurrency(formatUnits(BigInt(saving.amount), 18))}*
🧲 ${formatCurrency(formatUnits(BigInt(saving.rate), 4))}% APR
👤 [Saver](https://etherscan.io/address/${saving.account}) / [TX](https://etherscan.io/tx/${saving.txHash})
${usedRef}
`;

	const image = `${CONFIG.telegram.imagesDir}/Savings.mp4`;

	return [message, image];
}
