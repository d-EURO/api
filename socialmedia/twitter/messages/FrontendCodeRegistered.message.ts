import { CONFIG } from 'api.config';
import { FrontendCodeRegisteredQuery } from 'frontendcode/frontendcode.types';
import { createRefCode } from 'socialmedia/socialmedia.helper';

export function FrontendCodeRegisteredMessage(registered: FrontendCodeRegisteredQuery): string[] {
	const refCode = createRefCode(registered.frontendCode) ?? '';

	const message = `
New dEURO Ambassador

⚙️ Referral-Code: ${refCode}
🔗 Verifiable on the blockchain
`;

	const image = `${CONFIG.twitter.imagesDir}/ReferralLink.png`;

	return [message, image];
}
