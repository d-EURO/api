import { CONFIG } from 'api.config';
import { FrontendCodeRegisteredQuery } from 'frontendcode/frontendcode.types';
import { createRefCode } from 'utils/message-helper';

export function FrontendCodeRegisteredMessage(registered: FrontendCodeRegisteredQuery): string[] {
	const refCode = createRefCode(registered.frontendCode);

	const message = `
*New dEURO Ambassador*

⚙️ Referral-Code: [${refCode}](https://app.deuro.com?ref=${refCode})
👤 [Referrer](https://etherscan.io/address/${registered.owner}) / [TX](https://etherscan.io/tx/${registered.txHash})
`;

	const image = `${CONFIG.telegram.imagesDir}/ReferralLink.mp4`;

	return [message, image];
}
