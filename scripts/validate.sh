#!/bin/bash

# Pre-deployment validation script
echo "🔍 Running pre-deployment checks..."

# Check if pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed"
    exit 1
fi

# Run type checking
echo "📝 Running TypeScript type checking..."
if ! pnpm run typecheck; then
    echo "❌ TypeScript type checking failed"
    exit 1
fi
echo "✅ TypeScript type checking passed"

# Run tests with coverage (enforces the thresholds in vite.config.ts)
echo "🧪 Running tests with coverage..."
if ! pnpm test:coverage; then
    echo "❌ Tests or coverage threshold failed"
    exit 1
fi
echo "✅ Tests and coverage passed"

# Run build
echo "🏗️  Building project..."
if ! pnpm run build; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"

# Check if dist directory exists and has content
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo "❌ Build output directory is empty or missing"
    exit 1
fi
echo "✅ Build output verified"

# Optional: Run additional checks
echo "🔍 Running additional validations..."

# Check for common security issues (if package.json audit is available)
echo "🔒 Running security audit..."
if pnpm audit --audit-level moderate; then
    echo "✅ Security audit passed"
else
    echo "⚠️  Security audit found issues (continuing...)"
fi

# Documentation checks (CHANGELOG version sync, CLAUDE.md tooling exceptions)
echo "📚 Running documentation checks..."
if ! ./scripts/check-docs.sh; then
    echo "❌ Documentation checks failed"
    exit 1
fi
echo "✅ Documentation checks passed"

echo "🎉 All validations completed successfully!"
exit 0
