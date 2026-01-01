# Email Setup Guide for Password Reset

The email service is now configured to send emails using nodemailer. You need to configure SMTP settings in your `.env` file.

## Required Environment Variables

Add these variables to your `myDoctor/.env` file:

```env
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Gmail Setup (Recommended for Testing)

### Option 1: Gmail App Password (Recommended)

1. Go to your Google Account settings: https://myaccount.google.com/
2. Enable 2-Step Verification if not already enabled
3. Go to "App passwords": https://myaccount.google.com/apppasswords
4. Create a new app password for "Mail"
5. Copy the 16-character password
6. Use it as `SMTP_PASS` in your `.env` file

**Example .env configuration for Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # Your 16-character app password
```

### Option 2: Gmail with OAuth2 (Advanced)

For production, consider using OAuth2 instead of app passwords for better security.

## Other Email Providers

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### Custom SMTP Server
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587  # or 465 for SSL
SMTP_USER=your-email@domain.com
SMTP_PASS=your-password
```

## Testing Email Configuration

After setting up your `.env` file:

1. Restart your backend server
2. Try the forgot password flow
3. Check your email inbox (and spam folder)
4. Check the server console for email sending logs

## Troubleshooting

### Email not sending
- Check that all SMTP variables are set in `.env`
- Verify your email credentials are correct
- Check server console for error messages
- For Gmail, make sure you're using an App Password, not your regular password

### "SMTP not configured" warning
- Make sure all SMTP variables are in your `.env` file
- Restart the server after adding variables
- Check that variable names match exactly: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

### Gmail "Less secure app" error
- Use App Passwords instead of your regular password
- Enable 2-Step Verification first

## Security Notes

- Never commit your `.env` file to version control
- Use App Passwords for Gmail instead of your main password
- For production, consider using environment-specific email services (SendGrid, Mailgun, AWS SES, etc.)

