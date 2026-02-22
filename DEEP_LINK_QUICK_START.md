# Deep Link Quick Start

Get Supabase invite and password reset deep linking working in 3 steps.

---

## Step 1: Configure Supabase (2 minutes)

Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/url-configuration

**Site URL:**
```
logpeerrecovery://
```

**Redirect URLs (add all these):**
```
logpeerrecovery://**
logpeerrecovery://auth/callback
logpeerrecovery://auth/callback/**
logpeerrecovery://reset-password
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

Click **Save**.

---

## Step 2: Rebuild App (5 minutes)

Deep linking requires a native rebuild (not just Expo Go):

```bash
cd log-peer-recovery

# iOS
npx expo run:ios

# Android
npx expo run:android
```

---

## Step 3: Test (2 minutes)

### Test Invite Link:
1. Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/users
2. Click "Invite User"
3. Enter your email
4. Check email on mobile device
5. Tap invite link
6. App opens and logs you in ✅

### Test Password Reset:
1. On login screen, tap "Forgot Password"
2. Enter your email
3. Check email on mobile device
4. Tap reset link
5. App opens to reset password screen ✅
6. Enter new password
7. Password is reset successfully ✅

---

## That's It!

**Total time:** ~10 minutes

**Need more details?** See `docs/DEEP_LINKING_SUMMARY.md`

**Having issues?** See troubleshooting section below

---

## Quick Test Commands

**iOS Simulator:**
```bash
xcrun simctl openurl booted "logpeerrecovery://test"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://test"
```

If these open your app, deep linking is configured correctly!

---

## Files Changed

✅ `app.config.js` - Added deep link scheme  
✅ `src/config/supabase.ts` - Enabled PKCE flow  
✅ `src/components/DeepLinkHandler.tsx` - Handles deep links & navigation  
✅ `src/contexts/AuthContext.tsx` - Listens for PASSWORD_RECOVERY event  
✅ `src/screens/auth/ResetPasswordScreen.tsx` - NEW: Password reset UI  
✅ `src/navigation/AuthNavigator.tsx` - Added ResetPassword route  
✅ `src/navigation/RootNavigator.tsx` - Added Supabase URL prefix  
✅ `src/navigation/types.ts` - Added ResetPassword type  
✅ `App.tsx` - Added DeepLinkHandler  

---

## What You Get

✅ Invite links open your app  
✅ Password recovery links open reset screen  
✅ Magic links supported  
✅ Sessions persist automatically  
✅ Auto token refresh  
✅ PKCE security flow  
✅ Works on iOS and Android  
✅ Password validation with requirements  
✅ Automatic navigation to reset screen  

---

## Troubleshooting

### Password Reset Link Opens Chrome Instead of App

**Problem:** Clicking the reset link on Android opens a blank Chrome page instead of the app.

**Solution:**
1. Make sure you've rebuilt the app with `npx expo run:android` (not Expo Go)
2. Verify the redirect URLs are configured in Supabase (see Step 1)
3. Check that `app.config.js` has the correct scheme and intent filters
4. Clear Chrome's cache and app data
5. Uninstall and reinstall the app

### Link Opens App But Shows Error

**Check these:**
- Supabase redirect URLs match exactly (including `logpeerrecovery://reset-password`)
- App was rebuilt after configuration changes
- No typos in the scheme name
- Check console logs for specific error messages

### Password Reset Doesn't Navigate to Screen

**Check:**
- `DeepLinkHandler.tsx` has the navigation import and logic
- `AuthNavigator.tsx` includes the ResetPassword screen
- Navigation types are updated in `types.ts`

---

## How It Works

1. User requests password reset via `ForgotPasswordScreen`
2. Supabase sends email with reset link: `logpeerrecovery://reset-password?type=recovery&access_token=...`
3. Android/iOS intercepts the link and opens your app
4. `DeepLinkHandler` detects the `recovery` type
5. Sets the session with the tokens
6. Navigates to `ResetPasswordScreen`
7. User enters new password
8. Password is updated via Supabase
9. User is redirected to login

---

**Ready to go!** 🚀
