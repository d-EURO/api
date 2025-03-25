## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn install
```

## create .env (see: .env.example)

```
PORT=3000

CONFIG_APP_URL=https://app.deuro.com
CONFIG_INDEXER_URL=https://ponder.deuro.com
CONFIG_CHAIN=mainnet

RPC_URL_MAINNET=https://eth-mainnet.g.alchemy.com/v2/[API-KEY]
RPC_URL_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/[API-KEY]

COINGECKO_API_KEY=[API-KEY]

TELEGRAM_BOT_TOKEN=[API-KEY]
TELEGRAM_GROUPS_JSON=telegram.groups.json
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod

# Publish NPM pkg (higher version) - needs login
$ npm publish --access public
```

## License

Nest is [MIT licensed](LICENSE).
This repo is [MIT licensed](LICENSE).
