# Contributing to RadioLive

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test everything works
6. Submit a pull request

## Development

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Run database migrations
cd services/api && pnpm db:migrate

# Seed database
cd services/api && pnpm db:seed
```

## Code Style

- Use TypeScript
- Follow existing patterns
- Keep functions small and focused
- Write clear commit messages

## Pull Requests

- Describe what changed and why
- Reference any related issues
- Keep PRs focused on one feature
- Make sure the app runs after your changes

## Reporting Issues

- Use GitHub issues
- Include steps to reproduce
- Include your environment details
