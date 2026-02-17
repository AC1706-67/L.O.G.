export default {
  expo: {
    name: "log-peer-recovery",
    slug: "log-peer-recovery",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    // Deep linking configuration
    scheme: "logpeerrecovery",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.logpeerrecovery.app",
      // iOS Universal Links (optional but recommended for production)
      associatedDomains: ["applinks:nkedmosycikakajobaht.supabase.co"]
    },
    android: {
      package: "com.logpeerrecovery.app",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      // Android App Links (optional but recommended for production)
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "nkedmosycikakajobaht.supabase.co",
              pathPrefix: "/auth/v1/verify"
            }
          ],
          category: ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};
