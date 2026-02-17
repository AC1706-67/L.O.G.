# Deep Link Setup Checklist

Quick checklist to verify your Supabase deep linking implementation.

---

## ✅ Step 1: Supabase Dashboard Configuration

Login to: https://supabase.com/dashboard/project/nkedmosycikakajobaht

### Authentication → URL Configuration

1. **Site URL**
   ```
   logpeerrecovery://
   ```
   - [ ] Set and saved

2. **Redirect URLs** (add all)
   ```
   logpeerrecovery://**
   logpeerrecovery://auth/callback
   logpeerrecovery://auth/callback/**
   https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
   ```
   - [ ] All URLs added
   - [ ] Saved changes

3. **Email Templates**
   - [ ] Navigate to Authentication → Email Templates
   - [ ] Verify "Invite User" template uses `{{ .ConfirmationURL }}`
   - [ ] Verify "Reset Password" template uses `{{ .ConfirmationURL }}`

---

## ✅ Step 2: Rebuild Your App

Deep link configuration requires a new build (not just a reload).

### For Development

**iOS:**
```bash
cd log-peer-recovery
npx expo run:ios
```

**Android:**
```bash
cd log-peer-recovery
npx expo run:android
```

### For Production (EAS Build)

```bash
cd log-peer-recovery

# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

- [ ] App rebuilt with new configuration
- [ ] App installed on test device

---

## ✅ Step 3: Test Deep Links

### Test 1: Manual Deep Link (Verify Scheme Works)

**iOS Simulator:**
```bash
xcrun simctl openurl booted "logpeerrecovery://test"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://test"
```

**Expected:** App should open

- [ ] iOS: App opens
- [ ] Android: App opens

### Test 2: Simulated Auth Callback

**iOS Simulator:**
```bash
xcrun simctl openurl booted "logpeerrecovery://auth/callback?type=invite&access_token=test123&refresh_token=test456"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://auth/callback?type=invite&access_token=test123&refresh_token=test456"
```

**Expected:** 
- App opens
- Shows "Completing authentication..." loading screen
- May show error (expected with fake tokens)

- [ ] iOS: Deep link processed
- [ ] Android: Deep link processed
- [ ] Loading screen appears
- [ ] Error handling works

### Test 3: Real Invite Flow

1. **Send Test Invite:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Invite User"
   - Enter a test email you can access
   - Send invite

2. **Check Email:**
   - Open email on your mobile device
   - Verify link format: `logpeerrecovery://auth/callback?...`

3. **Tap Link:**
   - Tap the invite link in email
   - App should open
   - Authentication should complete
   - User should be logged in

- [ ] Invite email received
- [ ] Link format correct
- [ ] App opens on tap
- [ ] Authentication completes
- [ ] User logged in
- [ ] Session persists after app restart

---

## ✅ Step 4: Verify Session Persistence

1. **After successful login:**
   - [ ] Close app completely
   - [ ] Reopen app
   - [ ] User still logged in (no login screen)

2. **Check AsyncStorage:**
   ```typescript
   // Add temporarily to your app for debugging
   import AsyncStorage from '@react-native-async-storage/async-storage';
   
   const keys = await AsyncStorage.getAllKeys();
   console.log('AsyncStorage keys:', keys);
   
   const session = await AsyncStorage.getItem('supabase.auth.token');
   console.log('Session:', session);
   ```
   - [ ] Session data exists in AsyncStorage

---

## ✅ Step 5: Test Error Scenarios

### Test Invalid Token
```bash
# iOS
xcrun simctl openurl booted "logpeerrecovery://auth/callback?type=invite&error=invalid_token&error_description=Token%20expired"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://auth/callback?type=invite&error=invalid_token&error_description=Token%20expired"
```

**Expected:** Error message displayed to user

- [ ] Error screen appears
- [ ] Error message is user-friendly

### Test Expired Invite
1. Send invite
2. Wait for invite to expire (check Supabase settings)
3. Try to use expired link

**Expected:** Error message about expired invite

- [ ] Expired invite handled gracefully

---

## ✅ Step 6: Test Different Auth Types

### Password Recovery
1. Request password reset from login screen
2. Check email on mobile device
3. Tap reset link
4. Verify app opens and allows password reset

- [ ] Recovery link opens app
- [ ] Password reset flow works

### Magic Link (if enabled)
1. Request magic link login
2. Check email on mobile device
3. Tap magic link
4. Verify app opens and logs in

- [ ] Magic link opens app
- [ ] Login completes

---

## ✅ Step 7: Production Readiness

### Code Quality
- [ ] No console.log statements in production code (or use proper logging)
- [ ] Error messages are user-friendly
- [ ] Loading states provide feedback
- [ ] No hardcoded test values

### Security
- [ ] PKCE flow enabled (`flowType: 'pkce'` in supabase.ts)
- [ ] Session timeout configured (15 minutes)
- [ ] Auto token refresh enabled
- [ ] Secure storage used (AsyncStorage)

### User Experience
- [ ] Loading indicator during auth
- [ ] Clear error messages
- [ ] Smooth navigation after login
- [ ] Profile setup flow for new users
- [ ] Help/support contact info for auth issues

### Monitoring
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Analytics for auth events
- [ ] Deep link metrics tracked

---

## 🐛 Troubleshooting

### App Doesn't Open on Link Tap

**Check:**
1. App was rebuilt after adding scheme
2. Scheme matches exactly: `logpeerrecovery://` (no typos)
3. App is installed on device
4. For iOS: Check `app.config.js` has `scheme` field
5. For Android: Check `intentFilters` in `app.config.js`

**Fix:**
```bash
# Clean and rebuild
cd log-peer-recovery
rm -rf node_modules
npm install
npx expo run:ios  # or run:android
```

### "Invalid Redirect URL" Error

**Check:**
1. Supabase Site URL is `logpeerrecovery://`
2. Redirect URLs include `logpeerrecovery://**`
3. No typos in scheme name
4. Changes saved in Supabase dashboard

**Fix:**
- Double-check all URLs in Supabase dashboard
- Try adding specific path: `logpeerrecovery://auth/callback`

### Session Not Persisting

**Check:**
1. `persistSession: true` in `src/config/supabase.ts`
2. `autoRefreshToken: true` in `src/config/supabase.ts`
3. AsyncStorage has permissions
4. No errors in console during session save

**Fix:**
```typescript
// Test AsyncStorage directly
import AsyncStorage from '@react-native-async-storage/async-storage';

try {
  await AsyncStorage.setItem('test', 'value');
  const value = await AsyncStorage.getItem('test');
  console.log('AsyncStorage works:', value);
} catch (error) {
  console.error('AsyncStorage error:', error);
}
```

### Deep Link Works in Dev, Not Production

**Check:**
1. EAS build includes `app.config.js` changes
2. Production build has correct bundle ID / package name
3. For iOS: Associated Domains configured
4. For Android: Intent filters in production build

**Fix:**
```bash
# Create new production build
eas build --platform ios --profile production --clear-cache
eas build --platform android --profile production --clear-cache
```

---

## 📱 Quick Test Commands

```bash
# iOS - Test scheme
xcrun simctl openurl booted "logpeerrecovery://"

# iOS - Test auth callback
xcrun simctl openurl booted "logpeerrecovery://auth/callback?type=invite&access_token=test&refresh_token=test"

# Android - Test scheme
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://"

# Android - Test auth callback
adb shell am start -W -a android.intent.action.VIEW -d "logpeerrecovery://auth/callback?type=invite&access_token=test&refresh_token=test"

# View logs
# iOS
npx react-native log-ios

# Android
npx react-native log-android
```

---

## ✅ Final Checklist

Before going to production:

- [ ] All tests pass
- [ ] Real invite flow tested on iOS
- [ ] Real invite flow tested on Android
- [ ] Session persistence verified
- [ ] Error handling tested
- [ ] Password recovery tested
- [ ] Production builds created
- [ ] Monitoring/analytics configured
- [ ] User documentation created
- [ ] Support team trained on auth flow

---

## 🎉 Success Criteria

Your implementation is complete when:

1. ✅ User receives invite email
2. ✅ User taps link on mobile device
3. ✅ App opens automatically
4. ✅ Authentication completes without errors
5. ✅ User is logged in
6. ✅ Session persists after app restart
7. ✅ Token auto-refreshes before expiry
8. ✅ Error scenarios handled gracefully

---

**Need Help?**

Check the full guide: `docs/SUPABASE_DEEP_LINKING_GUIDE.md`

Common issues and solutions are documented there.
