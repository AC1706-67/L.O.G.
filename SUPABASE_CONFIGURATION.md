# Supabase Configuration for Password Reset

## 🎯 What You Need to Do

Configure your Supabase project to redirect password reset links to your app instead of a web page.

---

## 📍 Step 1: Go to Supabase Dashboard

**URL:** https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/url-configuration

Or navigate manually:
1. Go to https://supabase.com/dashboard
2. Select your project: `nkedmosycikakajobaht`
3. Click "Authentication" in sidebar
4. Click "URL Configuration"

---

## ⚙️ Step 2: Configure URLs

### Site URL
Set this to your app's custom scheme:
```
logpeerrecovery://
```

### Redirect URLs
Add ALL of these URLs (click "Add URL" for each):

```
logpeerrecovery://**
```
*Allows any path in your app*

```
logpeerrecovery://auth/callback
```
*For general auth callbacks*

```
logpeerrecovery://auth/callback/**
```
*For nested auth callback paths*

```
logpeerrecovery://reset-password
```
*Specifically for password reset*

```
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```
*Fallback for web/testing*

---

## 💾 Step 3: Save

Click the **"Save"** button at the bottom of the page.

---

## ✅ Verification

After saving, your configuration should look like this:

**Site URL:**
```
logpeerrecovery://
```

**Redirect URLs:**
```
✓ logpeerrecovery://**
✓ logpeerrecovery://auth/callback
✓ logpeerrecovery://auth/callback/**
✓ logpeerrecovery://reset-password
✓ https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

---

## 🧪 Test Configuration

### Method 1: Request Password Reset
1. Open your app
2. Tap "Forgot Password"
3. Enter your email
4. Check email
5. Tap reset link
6. **Expected:** App opens to reset password screen

### Method 2: Check Email Template
1. Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/templates
2. Select "Reset Password" template
3. Verify the link contains: `{{ .SiteURL }}`
4. This will use your configured Site URL

---

## 🔧 Email Template (Optional)

The default template should work, but you can customize it:

**Location:** Authentication → Email Templates → Reset Password

**Default link format:**
```
{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .RedirectTo }}
```

This automatically uses your configured `logpeerrecovery://` scheme.

---

## 🚨 Common Issues

### Issue: "Invalid redirect URL" error

**Cause:** The redirect URL isn't in your allowed list.

**Solution:** 
- Double-check you added `logpeerrecovery://reset-password`
- Make sure you clicked "Save"
- Try adding `logpeerrecovery://**` as a wildcard

### Issue: Link still opens browser

**Cause:** Configuration not saved or app not rebuilt.

**Solution:**
1. Verify URLs are saved in Supabase
2. Rebuild app: `npx expo run:android`
3. Uninstall old app first if needed

### Issue: "Site URL must be a valid URL" error

**Cause:** Supabase requires a valid URL format.

**Solution:**
- Use `logpeerrecovery://` (with `://`)
- Don't use `logpeerrecovery:` (without `//`)

---

## 📱 Platform-Specific Notes

### Android
- Deep links work automatically after rebuild
- Intent filters configured in `app.config.js`
- No additional Android configuration needed

### iOS
- Deep links work automatically after rebuild
- URL scheme configured in `app.config.js`
- No additional iOS configuration needed

---

## 🔐 Security Notes

### Redirect URL Validation
Supabase validates all redirect URLs against your allowed list. This prevents:
- Phishing attacks
- Token theft
- Unauthorized redirects

### Token Security
- Reset tokens are single-use
- Expire after short time (default: 1 hour)
- Can't be reused after password reset

### PKCE Flow
- Your app uses PKCE (Proof Key for Code Exchange)
- More secure than implicit flow
- Prevents authorization code interception

---

## 📊 Monitoring

After configuration, monitor these:

### Supabase Logs
https://supabase.com/dashboard/project/nkedmosycikakajobaht/logs/explorer

Filter for:
- `auth.password_recovery` - Password reset requests
- `auth.user.updated` - Successful password updates
- `auth.error` - Any auth errors

### App Logs
Check your app's console for:
```
"Handling recovery callback"
"Recovery session created - navigating to reset password screen"
"Password recovery event detected"
```

---

## ✨ What This Enables

After configuration:

✅ Password reset links open your app  
✅ Users see native reset screen  
✅ Better user experience  
✅ No browser confusion  
✅ Secure token handling  
✅ Works offline (after link opens)  
✅ Consistent with app design  

---

## 🆘 Need Help?

If configuration doesn't work:

1. **Check Supabase status:** https://status.supabase.com
2. **Review logs:** Check both Supabase and app logs
3. **Test with simple link:** Use test commands from `PASSWORD_RESET_QUICK_REFERENCE.md`
4. **Verify app rebuild:** Make sure you ran `npx expo run:android` (not `expo start`)

---

## 📚 Related Documentation

- `PASSWORD_RESET_SETUP.md` - Complete implementation guide
- `PASSWORD_RESET_QUICK_REFERENCE.md` - Quick commands and troubleshooting
- `DEEP_LINK_QUICK_START.md` - General deep linking setup

---

**Configuration complete!** Your app is ready for password reset deep linking. 🎉
