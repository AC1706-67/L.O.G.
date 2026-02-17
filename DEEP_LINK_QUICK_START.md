# Deep Link Quick Start

Get Supabase invite deep linking working in 3 steps.

---

## Step 1: Configure Supabase (2 minutes)

Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/url-configuration

**Site URL:**
```
logpeerrecovery://
```

**Redirect URLs (add all 4):**
```
logpeerrecovery://**
logpeerrecovery://auth/callback
logpeerrecovery://auth/callback/**
https://nkedmosycikakajobaht.supabase.co/auth/v1/callback
```

Click **Save**.

---

## Step 2: Rebuild App (5 minutes)

```bash
cd log-peer-recovery

# iOS
npx expo run:ios

# Android
npx expo run:android
```

---

## Step 3: Test (2 minutes)

1. Go to: https://supabase.com/dashboard/project/nkedmosycikakajobaht/auth/users
2. Click "Invite User"
3. Enter your email
4. Check email on mobile device
5. Tap invite link
6. App opens and logs you in ✅

---

## That's It!

**Total time:** ~10 minutes

**Need more details?** See `docs/DEEP_LINKING_SUMMARY.md`

**Having issues?** See `docs/DEEP_LINK_SETUP_CHECKLIST.md`

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
✅ `src/components/DeepLinkHandler.tsx` - NEW: Handles deep links  
✅ `src/contexts/AuthContext.tsx` - Listens for auth changes  
✅ `App.tsx` - Added DeepLinkHandler  

---

## What You Get

✅ Invite links open your app  
✅ Password recovery links work  
✅ Magic links supported  
✅ Sessions persist automatically  
✅ Auto token refresh  
✅ PKCE security flow  
✅ Works on iOS and Android  

---

**Ready to go!** 🚀
