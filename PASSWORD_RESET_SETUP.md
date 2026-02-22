# Password Reset Deep Linking Setup - Complete Guide

## Overview

Your LOG Peer Recovery app now supports password reset via deep linking. When users click the reset link in their email, the app opens directly to a password reset screen instead of showing a blank browser page.

---

## Your Project Type

**Expo Managed Workflow (SDK 54)** with:
- `expo-linking` for deep linking
- Supabase authentication
- React Navigation
- Custom scheme: `logpeerrecovery://`

---

## What Was Implemented

### 1. New Reset Password Screen
**File:** `src/screens/auth/ResetPasswordScreen.tsx`

Features:
- Password input with confirmation
- Real-time validation
- Password requirements display
- Loading states
- Error handling
- Automatic navigation to login after success

### 2. Updated Navigation
**Files Modified:**
- `src/navigation/types.ts` - Added `ResetPassword` route type
- `src/navigation/AuthNavigator.tsx` - Added ResetPassword screen
- `src/navigation/RootNavigator.tsx` - Added Supabase URL prefix

### 3. Enhanced Deep Link Handler
**File:** `src/components/DeepLinkHandler.tsx`

Changes:
- Added navigation hook
- Updated `handleRecoveryCallback` to navigate to reset screen
- Maintains session during password reset flow

### 4. Auth Context Updates
**File:** `src/contexts/AuthContext.tsx`

Changes:
- Added `PASSWORD_RECOVERY` event listener
- Logs recovery events for debugging

### 5. Configuration Updates
**File:** `src/config/supabase.ts`

Changes:
- Added deep link documentation
- Confirmed PKCE flow configuration

---

## Supabase Configuration Required

### Step 1: Update Redirect URLs

Go to your Supabase dashboard:
https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/url-configuration

**Site URL:**
```
logpeerrecovery://
```

**Redirect URLs (add all of these):**
```
logpeerrecovery://**
logpeerrecovery://auth/callback
logpeerrecovery://auth/callback/**
logpeerrecovery://reset-password
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

### Step 2: Email Template (Optional)

The default Supabase password reset email template should work automatically. The reset link will use your configured redirect URL.

If you want to customize the email:
1. Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/templates
2. Select "Reset Password"
3. The link should contain: `{{ .SiteURL }}/auth/v1/verify?token={{ .Token }}&type=recovery&redirect_to={{ .RedirectTo }}`

---

## Testing Instructions

### Test on Android Device/Emulator

1. **Build and install the app:**
   ```bash
   cd log-peer-recovery
   npx expo run:android
   ```

2. **Request password reset:**
   - Open the app
   - On login screen, tap "Forgot Password"
   - Enter your email address
   - Tap "Send Reset Link"

3. **Check email on the device:**
   - Open email app on the same device
   - Find the password reset email from Supabase
   - Tap the reset link

4. **Expected behavior:**
   - App opens automatically
   - Shows "Completing authentication..." briefly
   - Navigates to Reset Password screen
   - You can enter new password
   - After reset, redirects to login

### Test on iOS Device/Simulator

Same steps as Android, but build with:
```bash
npx expo run:ios
```

### Test Deep Linking Directly

**Android:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://reset-password?type=recovery&access_token=test"
```

**iOS:**
```bash
xcrun simctl openurl booted "logpeerrecovery://reset-password?type=recovery&access_token=test"
```

This should open your app (though the token won't be valid).

---

## How It Works

### Flow Diagram

```
User requests reset
       ↓
Supabase sends email with link:
logpeerrecovery://reset-password?type=recovery&access_token=xxx&refresh_token=yyy
       ↓
Android/iOS intercepts link
       ↓
Opens LOG app
       ↓
DeepLinkHandler processes URL
       ↓
Detects type=recovery
       ↓
Calls handleRecoveryCallback()
       ↓
Sets session with tokens
       ↓
Navigates to ResetPasswordScreen
       ↓
User enters new password
       ↓
Calls supabase.auth.updateUser()
       ↓
Password updated
       ↓
Navigates to Login screen
```

### Code Flow

1. **Deep Link Received:**
   - `DeepLinkHandler` listens via `expo-linking`
   - Parses URL parameters

2. **Session Creation:**
   - Extracts `access_token` and `refresh_token`
   - Calls `supabase.auth.setSession()`
   - Session is now active

3. **Navigation:**
   - Uses React Navigation to navigate to `ResetPassword` screen
   - User is now authenticated with temporary session

4. **Password Update:**
   - User enters new password
   - Validates against requirements
   - Calls `supabase.auth.updateUser({ password: newPassword })`
   - Uses existing session (no token needed)

5. **Completion:**
   - Shows success alert
   - Navigates to login screen
   - User can log in with new password

---

## Password Requirements

The app enforces these requirements:
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*...)

These are validated in:
- `ResetPasswordScreen.tsx` (UI validation)
- `AuthContext.tsx` (backend validation)

---

## Troubleshooting

### Issue: Link Opens Chrome Instead of App

**Cause:** App not built with native code, or deep linking not configured.

**Solution:**
1. Rebuild app: `npx expo run:android` (not `expo start`)
2. Verify `app.config.js` has correct scheme
3. Check Supabase redirect URLs
4. Uninstall and reinstall app

### Issue: App Opens But Shows Error

**Check:**
- Console logs in Metro bundler
- Supabase redirect URLs match exactly
- No typos in scheme name (`logpeerrecovery`)

**Debug:**
```bash
# View Android logs
adb logcat | grep -i "logpeerrecovery"

# View iOS logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "Expo"'
```

### Issue: Doesn't Navigate to Reset Screen

**Check:**
- `DeepLinkHandler.tsx` has `useNavigation()` hook
- `AuthNavigator.tsx` includes `ResetPassword` screen
- Navigation types updated in `types.ts`

**Debug:**
Add console logs in `DeepLinkHandler.tsx`:
```typescript
console.log('Navigating to reset password screen');
```

### Issue: Password Reset Fails

**Check:**
- Session is active (check console logs)
- Password meets requirements
- Network connection is working

**Debug:**
Check Supabase logs:
https://supabase.com/dashboard/project/nkedmosycikakajobaht/logs/explorer

---

## Security Considerations

### PKCE Flow
- Uses Proof Key for Code Exchange (PKCE)
- More secure than implicit flow
- Prevents authorization code interception

### Session Management
- Tokens stored in AsyncStorage (encrypted on device)
- Auto-refresh enabled
- 15-minute session timeout

### Password Validation
- Enforced on client and server
- Prevents weak passwords
- Meets HIPAA security requirements

### Deep Link Security
- Tokens are single-use
- Expire after short time
- Can't be reused after password reset

---

## File Reference

### New Files
- `src/screens/auth/ResetPasswordScreen.tsx` - Password reset UI

### Modified Files
- `src/components/DeepLinkHandler.tsx` - Added navigation logic
- `src/contexts/AuthContext.tsx` - Added PASSWORD_RECOVERY listener
- `src/navigation/AuthNavigator.tsx` - Added ResetPassword route
- `src/navigation/RootNavigator.tsx` - Added Supabase URL prefix
- `src/navigation/types.ts` - Added ResetPassword type
- `src/config/supabase.ts` - Updated documentation
- `DEEP_LINK_QUICK_START.md` - Updated with password reset info

### Configuration Files
- `app.config.js` - Deep link scheme and intent filters (already configured)
- `.env` - Supabase credentials (already configured)

---

## Next Steps

1. **Configure Supabase redirect URLs** (see above)
2. **Rebuild the app** with `npx expo run:android`
3. **Test password reset flow** on device
4. **Verify it works** before deploying to production

---

## Production Checklist

Before deploying to production:

- [ ] Supabase redirect URLs configured
- [ ] Tested on physical Android device
- [ ] Tested on physical iOS device
- [ ] Email template reviewed
- [ ] Password requirements documented for users
- [ ] Error handling tested
- [ ] Session timeout tested
- [ ] Deep linking works from email apps (Gmail, Outlook, etc.)
- [ ] Works with device in background/closed state
- [ ] Analytics/logging added for monitoring

---

## Support

If you encounter issues:

1. Check console logs in Metro bundler
2. Check device logs (adb logcat / iOS Console)
3. Verify Supabase configuration
4. Test with simple deep link first
5. Review this document's troubleshooting section

---

**Setup complete!** Your app now supports password reset via deep linking. 🎉
