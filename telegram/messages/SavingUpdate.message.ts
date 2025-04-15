import { CONFIG } from 'api.config';
import { SavingsSavedQuery } from 'savings/savings.core.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function SavingUpdateMessage(saving: SavingsSavedQuery): string[] {
	const { frontendCode, refCode } = saving;
	const trimmedFrontendCode = frontendCode ? frontendCode.substring(0, 4) + '...' + frontendCode.substring(frontendCode.length - 4) : '';
	const code = refCode || trimmedFrontendCode;
	const usedRef = code ? `🪢 used Ref: ${code}` : '';

	const message = `
*New dEURO Savings!*

🔏 Savings Amount: *${formatCurrency(formatUnits(BigInt(saving.amount), 18))}*
🧲 ${formatCurrency(formatUnits(BigInt(saving.rate), 4))}% APR
👤 [Saver](https://etherscan.io/address/${saving.account}) / [TX](https://etherscan.io/tx/${saving.txHash})
${usedRef}
`;

	const image = `${CONFIG.telegramImagesDir}/Savings_Telegram.mp4`;

	return [message, image];
}
