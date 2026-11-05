# My Doctor transactional email delivery

My Doctor sends password codes and transactional notifications through an Aruba
mailbox on the `mydoctorplus.it` domain. Do not use a Gmail mailbox or a
different visible sender in production: this breaks the identity alignment that
receiving providers use to assess the message.

## Production environment

Create a dedicated, real Aruba domain mailbox, for example
`noreply@mydoctorplus.it`, and use its full address and mailbox password. Keep
the password only in the deployment secret store or `.env`; never commit it.

```env
EMAIL_ENABLED=true
EMAIL_PROVIDER=aruba
SMTP_HOST=smtps.aruba.it
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=noreply@mydoctorplus.it
SMTP_PASS=<Aruba mailbox password>
SMTP_FROM=noreply@mydoctorplus.it
SMTP_FROM_NAME=My Doctor
SMTP_REPLY_TO=support@mydoctorplus.it
SMTP_ENVELOPE_FROM=noreply@mydoctorplus.it
SMTP_MESSAGE_ID_DOMAIN=mydoctorplus.it
EMAIL_VERIFY_ON_STARTUP=true
EMAIL_MAX_CONCURRENCY=3
APP_URL=https://mydoctorweb.mydoctorplus.it
```

`SMTP_USER`, `SMTP_FROM`, and `SMTP_ENVELOPE_FROM` should use the same domain.
`SMTP_REPLY_TO` must be a monitored mailbox. Port 587 uses STARTTLS, so
`SMTP_SECURE=false` and `SMTP_REQUIRE_TLS=true` are intentional. Aruba documents
SMTP authentication with the full mailbox address and supports `smtps.aruba.it`
for domain mailboxes; it also documents port 587 for SMTP submission.

The code rejects a non-Aruba host when `EMAIL_PROVIDER=aruba`, rejects an
unconfigured visible sender, keeps the SMTP envelope sender aligned with the
visible sender, and limits outbox delivery concurrency to prevent retry bursts.
It retains every current template and trigger.

## DNS changes required outside this repository

Application code cannot publish DNS authentication. At the time of the audit,
public DNS did not return a TXT result for `mydoctorplus.it`,
`_dmarc.mydoctorplus.it`, or `a1._domainkey.mydoctorplus.it`. Configure these
records in the DNS panel that is authoritative for `mydoctorplus.it`:

1. **SPF** — create or merge a single TXT record at the root domain:

   ```text
   v=spf1 include:_spf.aruba.it -all
   ```

   Use only one SPF TXT record. If another legitimate provider sends as
   `@mydoctorplus.it`, merge its include/mechanism into this same record before
   the final `-all`; never publish a second SPF record.

2. **DKIM** — enable Aruba DKIM for the domain. Aruba's current guidance uses
   the `a1` selector for its manual setup, so publish the exact TXT host and
   public key Aruba shows for this mailbox (normally
   `a1._domainkey.mydoctorplus.it`). Do not copy a key from another provider or
   domain.

3. **DMARC** — first publish a monitoring policy after creating the report
   mailbox:

   ```text
   Host: _dmarc.mydoctorplus.it
   Value: v=DMARC1; p=none; rua=mailto:dmarc@mydoctorplus.it; aspf=r; adkim=r
   ```

   Review aggregate reports for at least one normal sending cycle. Once all
   approved senders pass alignment, move in stages to `p=quarantine` and then
   `p=reject`. Do not publish report addresses that do not exist.

## Safe verification and release checks

The application verifies SMTP authentication at startup when
`EMAIL_VERIFY_ON_STARTUP=true`. It does not send a message. The same no-send
check is available locally:

```powershell
npm run email:verify
```

After DNS propagation, send one password-reset test to each target provider
(Gmail, Outlook/Hotmail, iCloud, and a corporate mailbox) and inspect the full
headers. Each must show:

```text
spf=pass
dkim=pass header.d=mydoctorplus.it
dmarc=pass header.from=mydoctorplus.it
```

If an inbox still classifies a fully authenticated message as spam, keep the
full headers and the provider's reason before changing template content. Sender
authentication and domain reputation are evaluated by the recipient and cannot
be corrected by HTML alone.

## Reference comparison

The available completed reference in this workspace is `VeterinaryBackend`;
there is no project named `Tenderiva` in the workspace. Its email service uses
the same Nodemailer transport pattern and Aruba-compatible SMTP settings, but
it has no deliverability mechanism that would compensate for a mismatched
sender domain or absent DNS records. My Doctor now has the stricter configuration
check, aligned envelope sender, startup verification, and bounded retry delivery.
