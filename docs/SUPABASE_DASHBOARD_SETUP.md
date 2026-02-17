# Supabase Dashboard Configuration

Step-by-step guide with exact values to enter in your Supabase dashboard.

---

## 🔗 Your Supabase Project

**Project URL:** https://nkedmosycikakajobaht.supabase.co  
**Dashboard:** https://supabase.com/dashboard/project/nkedmosycikakajobaht

---

## Step 1: Configure URL Settings

### Navigate to:
```
Dashboard → Authentication → URL Configuration
```

### 1.1 Site URL

**Field:** Site URL  
**Value:**
```
logpeerrecovery://
```

**What it does:** This is the base URL Supabase uses for all authentication redirects. When users click invite links, they'll be redirected to this custom scheme, which opens your mobile app.

**Important:** 
- Include the `://` at the end
- No spaces
- Lowercase only
- Must match the `scheme` in your `app.config.js`

---

### 1.2 Redirect URLs

**Field:** Redirect URLs  
**Action:** Click "Add URL" for each of these:

```
logpeerrecovery://**
```
```
logpeerrecovery://auth/callback
```
```
logpeerrecovery://auth/callback/**
```
```
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

**What each does:**
- `logpeerrecovery://**` - Wildcard to allow any path under your scheme
- `logpeerrecovery://auth/callback` - Specific callback endpoint for auth
- `logpeerrecovery://auth/callback/**` - Callback with additional parameters
- `https://...` - Fallback for web testing and development

**Important:**
- Add each URL separately
- Click "Save" after adding all URLs
- The `**` wildcard is important - don't forget it

---

### 1.3 Additional Redirect URLs (Optional but Recommended)

For development and testing, you may also want to add:

```
exp://localhost:8081
```
```
http://localhost:3000
```

These allow testing in Expo Go and web browsers during development.

---

## Step 2: Configure Email Templates

### Navigate to:
```
Dashboard → Authentication → Email Templates
```

### 2.1 Invite User Template

**Click:** "Invite User" template

**Verify the template contains:**
```html
<h2>You have been invited</h2>
<p>You have been invited to create a user on {{ .SiteURL }}. Follow this link to accept the invite:</p>
<p><a href="{{ .ConfirmationURL }}">Accept the invite</a></p>
```

**Important:**
- The `{{ .ConfirmationURL }}` variable automatically uses your Site URL
- Don't change this variable name
- The final URL will be: `logpeerrecovery://auth/callback?type=invite&token=...`

**Optional Customization:**
You can customize the HTML/text, but keep the `{{ .ConfirmationURL }}` variable:

```html
<h2>Welcome to LOG Peer Recovery</h2>
<p>You've been invited to join our team. Click below to get started:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>This link will open the LOG Peer Recovery mobile app.</p>
```

---

### 2.2 Reset Password Template

**Click:** "Reset Password" template

**Verify the template contains:**
```html
<h2>Reset Password</h2>
<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

**Important:**
- Keep the `{{ .ConfirmationURL }}` variable
- The final URL will be: `logpeerrecovery://auth/callback?type=recovery&token=...`

---

### 2.3 Magic Link Template (if using)

**Click:** "Magic Link" template

**Verify the template contains:**
```html
<h2>Magic Link</h2>
<p>Follow this link to login:</p>
<p><a href="{{ .ConfirmationURL }}">Log In</a></p>
```

---

### 2.4 Email Confirmation Template

**Click:** "Confirm Signup" template

**Verify the template contains:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

---

## Step 3: Configure Auth Settings

### Navigate to:
```
Dashboard → Authentication → Settings
```

### 3.1 Enable Email Confirmations (Optional)

**Setting:** Enable email confirmations  
**Recommended:** OFF for invite-only apps  
**Why:** Since you're using admin invites, you may not need email confirmation

---

### 3.2 Secure Email Change (Recommended)

**Setting:** Secure email change  
**Recommended:** ON  
**Why:** Requires confirmation when users change their email

---

### 3.3 Session Settings

**Setting:** JWT expiry  
**Recommended:** 3600 (1 hour)  
**Why:** Balances security and user experience

**Setting:** Refresh token rotation  
**Recommended:** ON  
**Why:** Enhanced security - tokens are rotated on each refresh

---

## Step 4: Test Configuration

### 4.1 Send Test Invite

1. Navigate to: `Dashboard → Authentication → Users`
2. Click "Invite User"
3. Enter your test email
4. Click "Send Invite"

### 4.2 Check Email

Open the email on your mobile device and verify:
- [ ] Email received
- [ ] Link format is: `logpeerrecovery://auth/callback?...`
- [ ] NOT `http://localhost:3000`

### 4.3 Test Link

Tap the link and verify:
- [ ] App opens (not browser)
- [ ] Authentication completes
- [ ] User is logged in

---

## Step 5: Security Settings (HIPAA Compliance)

### Navigate to:
```
Dashboard → Settings → API
```

### 5.1 Enable RLS (Row Level Security)

**For each table:**
1. Go to: `Dashboard → Table Editor`
2. Select table
3. Click "Enable RLS" if not already enabled
4. Add appropriate policies

**Critical tables:**
- `users`
- `participants`
- `logs`
- `assessments`
- `recovery_plans`

---

### 5.2 Configure CORS (if using web)

**Navigate to:** `Dashboard → Settings → API`

**Allowed origins:**
```
logpeerrecovery://*
```

---

## Step 6: Monitoring & Logs

### Navigate to:
```
Dashboard → Logs
```

### 6.1 Enable Auth Logs

Monitor these logs during testing:
- Auth logs - See all authentication attempts
- API logs - See API calls from your app
- Database logs - See database queries

### 6.2 Check for Errors

After testing, check logs for:
- Failed authentication attempts
- Invalid redirect URL errors
- Token exchange failures

---

## Common Configuration Mistakes

### ❌ Mistake 1: Wrong Site URL
```
http://localhost:3000  ← WRONG
```
```
logpeerrecovery://  ← CORRECT
```

### ❌ Mistake 2: Missing Wildcard
```
logpeerrecovery://auth/callback  ← INCOMPLETE
```
```
logpeerrecovery://**  ← CORRECT (add both)
```

### ❌ Mistake 3: Typo in Scheme
```
logpeer-recovery://  ← WRONG (has dash)
```
```
logpeerrecovery://  ← CORRECT (no dash)
```

### ❌ Mistake 4: Forgot to Save
After adding URLs, click the "Save" button!

---

## Verification Checklist

Before testing with your app:

- [ ] Site URL is `logpeerrecovery://`
- [ ] All 4 redirect URLs added
- [ ] Changes saved (clicked Save button)
- [ ] Email templates use `{{ .ConfirmationURL }}`
- [ ] Test invite sent
- [ ] Email link format verified
- [ ] RLS enabled on sensitive tables

---

## Quick Reference

### Your Configuration Values

| Setting | Value |
|---------|-------|
| Site URL | `logpeerrecovery://` |
| Redirect URL 1 | `logpeerrecovery://**` |
| Redirect URL 2 | `logpeerrecovery://auth/callback` |
| Redirect URL 3 | `logpeerrecovery://auth/callback/**` |
| Redirect URL 4 | `https://nkedmosycikakajobaht.supabase.co/auth/v1/callback` |
| Email Variable | `{{ .ConfirmationURL }}` |

---

## Need to Revert?

If you need to go back to web-based auth for testing:

1. Change Site URL to: `http://localhost:3000`
2. Add redirect URL: `http://localhost:3000/**`
3. Keep mobile URLs for when you're ready to switch back

You can have both web and mobile URLs configured simultaneously.

---

## Support

If you encounter issues:

1. Check the logs: `Dashboard → Logs → Auth`
2. Verify all URLs are saved
3. Test with a fresh invite email
4. Check the full guide: `docs/SUPABASE_DEEP_LINKING_GUIDE.md`

---

**Configuration Status:** Ready to configure ✅

Follow these steps exactly and your deep linking will work!
