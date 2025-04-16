import { CONFIG } from 'api.config';
import { FrontendCodeRegisteredQuery } from 'frontendcode/frontendcode.types';
import { createRefCode } from 'utils/message-helper';

export function FrontendCodeRegisteredMessage(registered: FrontendCodeRegisteredQuery): string[] {
	const refCode = createRefCode(registered.frontendCode);

	const message = `
*New dEURO Ambassador*

⚙️ Referral-Code: [${refCode}](https://app.deuro.com?ref=${refCode})
👤 Referrer / [TX](https://etherscan.io/tx/${registered.txHash})
`;

	const image = `${CONFIG.telegramImagesDir}/Referrallink_Telegram.mp4`;

	return [message, image];
}
