import { CONFIG } from 'api.config';
import { EcosystemMintQueryItem } from 'ecosystem/ecosystem.stablecoin.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

export function MintingUpdateMessage(mint: EcosystemMintQueryItem): string[] {
	const message = `
New dEURO Mint!

🏦 Lending Amount: ${formatCurrency(formatUnits(BigInt(mint.value), 18))}
🔗 Verifiable on the blockchain
	`;

	const image = `${CONFIG.twitter.imagesDir}/Lending.png`;

	return [message, image];
}
