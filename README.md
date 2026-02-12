# 🦞 OpenClaw Hetzner Setup Wizard

A simple, guided wizard to deploy your own [OpenClaw](https://github.com/openclaw/openclaw) AI agent on Hetzner Cloud in under 5 minutes.

## What is this?

This web application walks you through:
1. Creating a Hetzner Cloud account
2. Generating an API token
3. Adding your SSH key
4. Automatically provisioning an Ubuntu server with OpenClaw pre-installed

No command-line experience required — just follow the steps!

## 🚀 Try it Live

**[hetzner-wizard.telegraphic.app](https://hetzner-wizard.telegraphic.app)**

## Run from Source

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development

```bash
# Clone the repo
git clone https://github.com/telegraphic-dev/openclaw-wizard.git
cd openclaw-wizard

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

## 🐳 Docker Deployment

```bash
# Build the image
docker build -t openclaw-wizard .

# Run the container
docker run -d -p 3000:3000 openclaw-wizard
```

### With Traefik (HTTPS)

```bash
docker run -d \
  --name openclaw-wizard \
  --network your-network \
  -e NODE_ENV=production \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.wizard.rule=Host(\`your-domain.com\`)" \
  --label "traefik.http.routers.wizard.entrypoints=https" \
  --label "traefik.http.routers.wizard.tls=true" \
  --label "traefik.http.routers.wizard.tls.certresolver=letsencrypt" \
  --label "traefik.http.services.wizard.loadbalancer.server.port=3000" \
  openclaw-wizard
```

## 📁 Project Structure

```
openclaw-wizard/
├── app/
│   ├── page.tsx              # Main wizard UI (React)
│   ├── layout.tsx            # App layout
│   ├── cleanup/
│   │   └── page.tsx          # Server deletion guide
│   └── api/
│       ├── provision/
│       │   └── route.ts      # Server provisioning endpoint
│       ├── check-server/
│       │   └── route.ts      # Check for existing server
│       └── console-url/
│           └── route.ts      # Hetzner console URL helper
├── Dockerfile                # Production Docker build
├── package.json
└── README.md
```

## 🔧 How It Works

1. **API Token Validation** — We verify your Hetzner token and check for existing servers
2. **SSH Key Upload** — Your public key is uploaded to Hetzner
3. **Server Creation** — A CAX11 ARM server is created with Ubuntu 24.04
4. **Bootstrap Script** — Cloud-init runs the OpenClaw bootstrap script
5. **Success** — You get SSH credentials to connect to your new server

### The Bootstrap Script

The wizard uses [openclaw-hetzner-bootstrap](https://github.com/telegraphic-dev/openclaw-hetzner-bootstrap) which:
- Creates an `openclaw` user
- Installs Node.js and dependencies  
- Downloads and configures OpenClaw
- Sets up systemd service

## 🔒 Security

- **Your API token is never stored** — It's only used during provisioning
- **SSH key required** — Password authentication is disabled
- **Token should be deleted** — We remind you to delete the API token after setup
- **Your server, your data** — We have no access to your provisioned server

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Tips

- The wizard uses Next.js 14 with App Router
- Styling is done with Tailwind CSS
- API routes stream progress using ReadableStream
- No database required — all state is client-side

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

## 💬 Support

- **Issues & Discussions**: [GitHub Issues](https://github.com/telegraphic-dev/openclaw-wizard/issues)
- **OpenClaw Community**: [OpenClaw Discord](https://discord.gg/openclaw)

---

**If this wizard helped you set up OpenClaw, please ⭐ star this repo!**
