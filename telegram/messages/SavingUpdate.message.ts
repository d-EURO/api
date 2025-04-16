import { CONFIG } from 'api.config';
import { SavingsSavedQuery } from 'savings/savings.core.types';
import { formatCurrency } from 'utils/format';
import { formatUnits, Hex, hexToString } from 'viem';

export function SavingUpdateMessage(saving: SavingsSavedQuery): string[] {
	const refCode = createRefCode(saving.frontendCode);
	const usedRef = refCode ? `🪢 used Ref: [${refCode}](https://app.deuro.com?ref=${refCode})` : '';

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

function createRefCode(frontendCode: string): string | undefined {
	if (frontendCode?.startsWith('0x00')) {
		return hexToString(frontendCode as Hex).replace(/\0/g, '');
	}
}
