# Social Media Notification Assets

Media attached to Telegram and Twitter/X notifications.

The directories are versioned (`.gitkeep` placeholders) so the layout exists in
the container even when no assets are committed. `TwitterService` and
`TelegramService` both fall back to text-only posts when an asset file is
missing — see `resolveMediaPath` in `socialmedia/socialmedia.helper.ts`.

## Layout

```
assets/socialmedia/
├── telegram/
│   ├── Savings.mp4         # Posted with SavingUpdateMessage
│   ├── EquityInvest.mp4    # Posted with TradeMessage
│   └── Lending.mp4         # Posted with MintingUpdateMessage
└── twitter/
    ├── Savings.png         # Posted with SavingUpdateMessage
    ├── EquityInvest.png    # Posted with TradeMessage
    └── Lending.png         # Posted with MintingUpdateMessage
```

File names are referenced literally by the message templates under
`socialmedia/{telegram,twitter}/messages/`. Adding a new asset means adding the
file here **and** the matching `${CONFIG.<service>.imagesDir}/<File>.{png,mp4}`
reference in the corresponding message.

## Specifications

| Channel  | Format | Notes                                                    |
| -------- | ------ | -------------------------------------------------------- |
| Telegram | MP4    | H.264, ≤ 50 MB, square or 16:9; played inline in chat    |
| Twitter  | PNG    | ≤ 5 MB, recommended ≥ 1200 × 675; rendered in feed cards |

## Container path

The `Dockerfile` copies this directory to `/app/assets/socialmedia/`. The
`docker-compose.yaml` in `DFXServer/server` sets:

```yaml
TELEGRAM_IMAGES_DIR: /app/assets/socialmedia/telegram
TWITTER_IMAGES_DIR: /app/assets/socialmedia/twitter
```

Both vars must point at the in-image path — not the legacy `/app/.api/images/*`
location, which lived in the bind-mounted volume and was lost during the
Azure → local migration.
