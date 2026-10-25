# Support email setup

The support menu sends six-digit verification codes from `support.ys.bot@gmail.com` through Gmail SMTP.

Set these environment variables in Vercel Production and in the long-running bot/app environment:

- `SUPPORT_EMAIL=support.ys.bot@gmail.com`
- `SUPPORT_EMAIL_APP_PASSWORD=<16-character Gmail app password>`

Use a Gmail App Password, not the normal Gmail account password. The account must have two-step verification enabled before an App Password can be created.

The token signing key is derived from `DATABASE_URL` unless you choose to add an optional `SUPPORT_TOKEN_SECRET`. After adding the variables, redeploy the website. The support request tables are created automatically in Neon on the first request.

Never commit these values or paste them into chat.
