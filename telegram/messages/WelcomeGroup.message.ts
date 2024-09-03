import { CONFIG, CONFIG_PROFILE } from 'api.config';
import { AppUrl } from 'utils/func-helper';

export function WelcomeGroupMessage(group: string | number, handles: string[]): string {
	const config = CONFIG[CONFIG_PROFILE];
	return `
*Welcome to the Frankencoin API Bot*

If you receive this message, it means the bot recognized this chat. (${group})

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
