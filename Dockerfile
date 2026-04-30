FROM node:lts-alpine

# Pre-create /app/.api so the telegram/twitter persistence dir inherits node:node
# ownership when bind-mounted as a Docker volume. Without this, Docker initialises
# the volume as root:root and the container — running as `node` — cannot persist
# subscriber state via writeBackupGroups() (manifests as `Telegram group backup
# failed` on every /subscribe, with no telegram.groups.json ever written).
RUN mkdir -p /app/.api && chown -R node:node /app

WORKDIR /app
USER node

COPY --chown=node . .
RUN yarn install --frozen-lockfile
RUN yarn build

CMD ["yarn", "start"]