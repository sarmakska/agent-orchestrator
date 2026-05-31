# Security Policy

## Reporting a vulnerability

If you have found a security issue in this project, please report it privately by emailing security@sarmalinux.com. Do not open a public GitHub issue for security problems. Include a clear description of the issue, steps to reproduce, the commit SHA you tested against, and any proof-of-concept code or output. Confirmed issues are patched on `main` and released as a tagged version, and I credit reporters in the release notes unless they ask me not to.

## Response policy

I respond within 7 days of receiving a report, with an acknowledgement and an initial assessment of severity and next steps. I aim to ship a fix or a documented mitigation for confirmed high-severity issues within 30 days. This policy covers the code in this repository only. Vulnerabilities in upstream dependencies or third-party services should be reported to those projects directly.

## Supported versions

Security fixes land on the latest minor release line. Pin to a tagged release if you need a stable surface.

| Version | Supported |
|---|---|
| 1.1.x | Yes |
| 1.0.x | Security fixes only |
| < 1.0 | No |
