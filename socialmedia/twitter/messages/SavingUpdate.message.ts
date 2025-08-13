import { CONFIG } from 'api.config';
import { FrontendCodeSavingsQuery } from 'frontendcode/frontendcode.types';
import { createRefCode } from 'socialmedia/socialmedia.helper';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function SavingUpdateMessage(saving: FrontendCodeSavingsQuery): string[] {
	const refCode = createRefCode(saving.frontendCode);
	const displayRef = refCode === 'Cake Wallet' ? '@cakewallet' : refCode;
	const usedRef = displayRef ? `🪢 used Ref: ${displayRef}` : '';

	const message = `
New dEURO Savings!
    
🔏 Savings Amount: ${formatCurrency(formatUnits(BigInt(saving.amount), 18))}
🧲 ${formatCurrency(formatUnits(BigInt(saving.rate), 4))}% APR
🔗 Verifiable on the blockchain
${usedRef}
`;

	const image = `${CONFIG.twitter.imagesDir}/Savings.png`;

	return [message, image];
}
