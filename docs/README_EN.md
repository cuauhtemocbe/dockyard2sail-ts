# ⚓ dockyard2sail-ts 🚢

_A production-ready TypeScript + Docker + DevContainers template_

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-lightgrey?logo=githubactions&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)
![Production Ready](https://img.shields.io/badge/Ready_to-Sail_🌊-blue)

---

## 🌊 Features

- **TypeScript**: Full TypeScript support with strict type checking
- **pnpm**: Fast, efficient package manager with workspace support
- **Vite**: Lightning-fast build tool and dev server
- **Vitest**: Fast unit testing framework
- **Docker**: Multi-stage production builds and development containers
- **DevContainers**: Complete VS Code development environment
- **Husky**: Git hooks for code quality assurance
- **CI/CD Ready**: Validation scripts and GitHub Actions support

---

## 🛳️ Project Structure

```
├── .devcontainer/          # VS Code DevContainer configuration
├── .husky/                 # Git hooks
├── scripts/                # Build and validation scripts
├── src/                    # Source code
│   ├── main.ts            # Main application entry point
│   └── test/              # Test files
├── docker-compose.yml      # Development environment
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development environment
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration
└── vitest.config.ts        # Testing configuration
```

➡️ [More details about Template](./docs/TEMPLATE_INFO.md)

## 🧭 Getting Started

When you run the development server:

```bash
pnpm dev
```

You should see something like this:

![pnpm dev example](./docs/pnpm-dev-example.png)

---

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [VS Code](https://code.visualstudio.com/) (recommended)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) (for DevContainer support)

### Option 1: Using DevContainers (Recommended)

1. Open the project in VS Code
2. When prompted, click "Reopen in Container" or press `F1` and select "Dev Containers: Reopen in Container"
3. Wait for the container to build and start
4. Run the development server:
   ```bash
   pnpm dev
   ```

### Option 2: Using Docker Compose

1. Start the development environment:

   ```bash
   docker-compose up -d
   ```

2. Attach to the container:

   ```bash
   docker-compose exec phaser-app bash
   ```

3. Install dependencies and start development:
   ```bash
   pnpm install
   pnpm dev
   ```

### Option 3: Local Development

1. Install [pnpm](https://pnpm.io/):

   ```bash
   npm install -g pnpm
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start development server:
   ```bash
   pnpm dev
   ```

---

## ⚡ Available Scripts

| Script               | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm dev`           | Start development server                       |
| `pnpm build`         | Build for production                           |
| `pnpm typecheck`     | Run TypeScript type checking                   |
| `pnpm test`          | Run tests in watch mode                        |
| `pnpm test:run`      | Run tests once                                 |
| `pnpm test:ui`       | Run tests with UI                              |
| `pnpm test:coverage` | Run tests with coverage                        |
| `pnpm preview`       | Preview production build                       |
| `pnpm validate`      | Run full validation (typecheck + test + build) |

---

## 🐳 Docker Commands

### Development

```bash
# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop environment
docker-compose down
```

### Production

```bash
# Build production image
docker build -t my-app:latest .

# Run production container
docker run -p 8080:8080 my-app:latest
```

---

## 🧭 Configuration Files

### Package Manager (.npmrc, .pnpmrc)

- Optimized for CI/CD environments
- Strict peer dependency checking disabled for compatibility
- Auto-install peer dependencies enabled

### TypeScript (tsconfig.json)

- Strict type checking enabled
- Modern ES2022 target
- Path aliases configured
- Source maps enabled for debugging

### Vite (vite.config.ts)

- Hot Module Replacement (HMR)
- Path aliases matching TypeScript config
- Production optimizations

### Testing (vitest.config.ts)

- JSDOM environment for browser-like testing
- Coverage reporting with v8
- UI mode available

---

## ⚓ Deployment

### Production Build

```bash
pnpm build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

### Docker Production

```bash
# Build production image
docker build -t my-app:latest .

# Deploy to your container registry
docker push my-registry/my-app:latest
```

---

## 🔍 Code Quality

This template includes several code quality tools:

- **Husky**: Git hooks for pre-commit, pre-merge, and pre-push validation
- **lint-staged**: Run checks only on staged files
- **TypeScript**: Strict type checking
- **Vitest**: Comprehensive testing framework

### Git Workflow

- Regular commits: Fast commits without heavy validation
- Merge commits: Full validation (typecheck + tests + build)
- Push to main: Complete validation suite

---

## 🛠️ Customization

### Adding Dependencies

```bash
# Add runtime dependency
pnpm add package-name

# Add development dependency
pnpm add -D package-name
```

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://api.example.com
VITE_APP_TITLE=My App
```

### VS Code Extensions

The DevContainer includes recommended extensions:

- ESLint
- Prettier
- TypeScript support
- Vite support
- Testing utilities

---

## 📜 Best Practices

1. **Keep dependencies up to date**: Regularly update packages for security and performance
2. **Write tests**: Maintain good test coverage for reliability
3. **Use TypeScript strictly**: Enable strict mode for better type safety
4. **Docker layers**: Optimize Dockerfile for better caching
5. **Environment variables**: Use Vite's environment variable system
6. **Git hooks**: Leverage the pre-configured git hooks for code quality

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run validation: `pnpm validate`
5. Submit a pull request

---

## 📄 License

This template is available under the MIT License. See the LICENSE file for more details.

---

## 🆘 Troubleshooting

### Common Issues

**DevContainer won't start:**

- Ensure Docker is running
- Check Docker Compose configuration
- Verify VS Code Dev Containers extension is installed

**Build fails:**

- Run `pnpm install` to ensure dependencies are installed
- Check TypeScript errors with `pnpm typecheck`
- Verify Node.js version compatibility

**Tests not running:**

- Ensure test files end with `.test.ts` or `.spec.ts`
- Check Vitest configuration
- Verify JSDOM is properly configured for browser-like tests

**Port conflicts:**

- Default dev server runs on port 5173
- Change port in `vite.config.ts` if needed
- Update `docker-compose.yml` port mapping accordingly

---

Made with ❤️ at the ⚓ **Dockyard** → ready to 🚢 **Sail**
