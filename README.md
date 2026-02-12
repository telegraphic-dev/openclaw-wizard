# OpenClaw Setup Wizard 🦞

A beginner-friendly web wizard to set up OpenClaw on Hetzner with zero technical knowledge.

## Live Demo

https://openclaw-wizard.vercel.app *(deploy to Vercel)*

## Features

- Step-by-step guided setup
- No command line required (except final SSH connection)
- Creates Hetzner server automatically
- Installs and configures OpenClaw
- Real-time progress updates

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/telegraphic-dev/openclaw-wizard)

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## How It Works

1. User creates Hetzner account (guided with screenshots)
2. User generates API token (step-by-step instructions)
3. User optionally provides SSH public key
4. Wizard creates VPS via Hetzner API
5. Cloud-init runs bootstrap script on first boot
6. User gets IP + gateway token + connection instructions

## Security

- API tokens are only used for server creation
- Tokens are never stored or logged
- All API calls are made server-side
- HTTPS enforced

## Stack

- Next.js 14
- Tailwind CSS
- Hetzner Cloud API
- Vercel (deployment)

## Related

- [openclaw-hetzner-bootstrap](https://github.com/telegraphic-dev/openclaw-hetzner-bootstrap) - CLI scripts
- [OpenClaw](https://github.com/openclaw/openclaw) - The AI agent framework
