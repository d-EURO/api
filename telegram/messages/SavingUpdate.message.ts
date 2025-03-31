import { CONFIG } from 'api.config';
import { SavingsSavedQuery } from 'savings/savings.core.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function SavingUpdateMessage(saving: SavingsSavedQuery): string[] {
	const message = `
*New dEURO Savings!*

🔏 Savings Amount: *${formatCurrency(formatUnits(BigInt(saving.amount), 18))}*
🧲 ${formatCurrency(formatUnits(BigInt(saving.rate), 4))}% APR
👤 [Saver](https://etherscan.io/address/${saving.account}) / [TX](https://etherscan.io/tx/${saving.txHash})
`;

	const image = `${CONFIG.telegramImagesDir}/Savings_Telegram.mp4`;

	return [message, image];
}
