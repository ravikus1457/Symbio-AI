# Security Policy

## Reporting

Report a suspected vulnerability privately to `support@symbioai.dev`.
Do not open a public issue containing credentials, customer information, or
reproduction steps that could harm the business.

Include the affected URL or file, impact, and the smallest reproducible example.
Symbio AI will coordinate remediation before public disclosure.

## Supported Version

Only the current production deployment and default branch receive security
updates.

## Secret Handling

This static site must never contain provider credentials. Third-party form IDs
and public feed URLs are identifiers, not authentication secrets; private
provider tokens belong only in encrypted server-side environment variables.
