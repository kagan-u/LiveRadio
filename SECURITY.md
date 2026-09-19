# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Do NOT** open a public GitHub issue
- Email security concerns to the maintainers
- Include details about the vulnerability
- Allow time for a fix before public disclosure

## Security Measures

RadioLive implements the following security measures:

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation with Zod
- CORS configuration
- WebSocket abuse protection
- Chat spam protection
- Environment-based secrets (no hardcoded credentials)
- SQL injection prevention through parameterized queries

## Stream Security

- Stream keys are generated and stored server-side
- Source passwords are never exposed to the frontend
- Broadcast tokens expire and can be revoked

## Dependencies

We regularly audit dependencies for known vulnerabilities using `npm audit`.

## Best Practices

- Never commit `.env` files
- Use strong, unique passwords
- Keep dependencies updated
- Follow the principle of least privilege
