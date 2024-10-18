import { CONFIG } from 'api.config';
import { Subscription } from 'telegram/dtos/groups.dto';
import { AppUrl } from 'utils/func-helper';

export function HelpMessage(group: string, handles: string[], subs: Subscription): string {
	const subTo: string[] = [];

	for (const h of Object.keys(subs)) {
		if (subs[h].groups.includes(group)) subTo.push(h);
	}

	return `
*Hello again, from the Frankencoin API Bot!*

I am listening to changes within the Frankencoin ecosystem.

*Available subscription handles:*
${handles.join('\n')}

*Subscripted to:*
${subTo.length > 0 ? subTo.join('\n') : 'Not subscripted to any handles.'}

*Environment*
Api Version: ${process.env.npm_package_version}
Chain/Network: ${CONFIG.chain.name} (${CONFIG.chain.id})
Time: ${new Date().toString().split(' ').slice(0, 5).join(' ')}

[Goto App](${AppUrl('')})
[Github Api](https://github.com/Frankencoin-ZCHF/frankencoin-api)
`;
}
