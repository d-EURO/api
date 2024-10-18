## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn install
```

## create .env (see: .env.example)

```
PORT=3030

CONFIG_APP_URL=https://app.frankencoin.com
CONFIG_INDEXER_URL=https://ponder.frankencoin.com
CONFIG_CHAIN=mainnet

RPC_URL_MAINNET=https://eth-mainnet.g.alchemy.com/v2/...
RPC_URL_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/...

COINGECKO_API_KEY=CG-...

TELEGRAM_BOT_TOKEN=...

STORJ_ACCESSKEY=...
STORJ_SECRETACCESSKEY=...
STORJ_BUCKET=frankencoin
STORJ_REGION=EU1
STORJ_ENDPOINT=https://gateway.storjshare.io
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
