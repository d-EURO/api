import { LeadrateRateQuery } from 'savings/savings.leadrate.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerTxUrl } from 'utils/func-helper';

export function LeadrateChangedMessage(rate: LeadrateRateQuery): string {
	const d = new Date(rate.created * 1000);

	return `
*Leadrate Changed*

Valid from: ${d.toString().split(' ').slice(0, 5).join(' ')}
Approved Rate: ${formatCurrency(rate.approvedRate / 10_000)}%

[Goto Governance](${AppUrl(`/governance`)})
[Explorer Transaction](${ExplorerTxUrl(rate.txHash)})
                        `;
}
