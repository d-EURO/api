import { CONFIG } from 'api.config';
import { AppUrl } from 'utils/func-helper';

export function HelpMessage(groups: string[], group: string, handles: string[]): string {
	const isSubscribed = groups.includes(group);

	return `
*Welcome to the d-EURO API Bot*

I am listening to changes within the d-EURO ecosystem.

*Available commands:*
${handles.join('\n')}

*Subscription state:*
${isSubscribed ? 'You are subscriped.' : 'You are not subscriped.'}

*Environment*
Api Version: ${process.env.npm_package_version}
Chain/Network: ${CONFIG.chain.name} (${CONFIG.chain.id})
Time: ${new Date().toString().split(' ').slice(0, 5).join(' ')}

[Goto App](${AppUrl('')})
[Github Api](https://github.com/d-EURO/api)
`;
}
