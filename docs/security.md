# Security deployment notes

Application protections are enforced by the API, not just hidden buttons. Admin-only endpoints include user management, company/shift settings and protected rate/route writes. Drivers only access their assigned trips. Incoming query operators and prototype paths are rejected; payloads pass explicit Zod schemas before database writes. Password and reset-token fields are excluded from normal reads and responses.

Password recovery: users request recovery from the sign-in screen. An administrator verifies identity and generates a private, one-time link from Users > Password recovery requests. The token is stored as a SHA-256 hash, expires in 30 minutes, is consumed atomically and invalidates previous sessions. No email service is configured; links are not emailed automatically. A sole administrator who cannot sign in needs a trusted deployment operator to restore access using the database; do not create a public unauthenticated admin reset endpoint.

API limits: 240 requests/minute per client IP; login 20 attempts/15 minutes; recovery 5/hour; imports 20/minute. Limits are process-local. Before running multiple app replicas, configure a shared limiter store. `trust proxy: 1` assumes exactly one trusted reverse proxy; match this to the hosting topology and block direct origin access so clients cannot forge forwarded IPs.

MongoDB hosting settings must be applied in Atlas/your database host:
- Use a dedicated application database user with read/write access only to the Lucky Transport database, never cluster-admin/root privileges.
- Require authenticated TLS connections and restrict network access to the application's egress IPs/private network. Remove public 0.0.0.0/0 access after verifying the app can connect.
- Keep MONGODB_URI and JWT_SECRET in hosting secrets; never include them in client builds or Git. Rotate any exposed credentials and replace development/default account passwords.
- Enable automated backups and audit/alerting appropriate to the hosting plan. Use a separate privileged migration account where index/collection administration is required.

These hosting settings are not changed by deploying this code. No database credentials or network rules were modified during implementation.

Recovery design follows OWASP's guidance: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
