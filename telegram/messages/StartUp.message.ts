import { CONFIG, CONFIG_PROFILE } from 'api.config';
import { AppUrl } from 'utils/func-helper';

export function StartUpMessage(handles: string[]): string {
	const config = CONFIG[CONFIG_PROFILE];

	return `
*Hello again, from the Frankencoin API Bot!*

I have updated and restarted and am back online, listening to changes within the Frankencoin ecosystem.

*Available subscription handles:*
${handles.join('\n')}

*Environment*
Api Version: ${process.env.npm_package_version}
Chain/Network: ${config.chain.name} (${config.chain.id})
Time: ${new Date().toString().split(' ').slice(0, 5).join(' ')}

[Goto App](${AppUrl('')})
[Github Api](https://github.com/Frankencoin-ZCHF/frankencoin-api)
`;
}
