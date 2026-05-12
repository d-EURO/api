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

# See "CoinGecko" section below.
COINGECKO_BASE_URL=http://pricing-proxy:8080/coingecko
# COINGECKO_API_KEY=

TELEGRAM_BOT_TOKEN=[API-KEY]
TELEGRAM_GROUPS_JSON=telegram.groups.json
TELEGRAM_IMAGES_DIR=./images
```

## CoinGecko

The api fetches token prices from a CoinGecko-compatible endpoint.
Configuration is two env vars:

| Var | Required | Purpose |
|---|---|---|
| `COINGECKO_BASE_URL` | yes | Origin the api calls. |
| `COINGECKO_API_KEY` | no | Attached as the `x-cg-pro-api-key` header on every request when set. |

The recommended deployment is the
[**pricing-proxy**](https://github.com/DFXswiss/pricing-proxy) — a small
caching reverse-proxy in front of CoinGecko Pro. It holds the upstream
key, serves a 60 s shared cache, validates upstream error envelopes, and
coalesces concurrent identical requests. When you use the proxy:

```env
COINGECKO_BASE_URL=http://pricing-proxy:8080/coingecko
# COINGECKO_API_KEY left unset — the proxy injects its own key
```

Without the proxy, talk to CoinGecko directly:

```env
COINGECKO_BASE_URL=https://pro-api.coingecko.com
COINGECKO_API_KEY=CG-xxxxxxxxxxxxxxxxxxxxxxxx
```

The api refuses to start without `COINGECKO_BASE_URL`.

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
