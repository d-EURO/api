import { MinterQuery } from 'ecosystem/ecosystem.minter.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerTxUrl } from 'utils/func-helper';

export function MinterProposalMessage(minter: MinterQuery): string {
	const d = new Date((minter.applyDate + minter.applicationPeriod) * 1000);

	return `
*New Minter Proposal*

Application Period: ${Math.floor(minter.applicationPeriod / 60 / 60)} hours
Application Veto Until: ${d.toString().split(' ').slice(0, 5).join(' ')}
Minter: ${minter.minter}
Suggestor: ${minter.suggestor}
Application Fee: ${formatCurrency(minter.applicationFee / 1e18, 2, 2)} dEURO
Message: ${minter.applyMessage}

[Goto Governance](${AppUrl(`/governance`)})
[Explorer Transaction](${ExplorerTxUrl(minter.txHash)})
                        `;
}
