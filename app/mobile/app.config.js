const appJson = require("./app.json");

const baseConfig = appJson.expo || {};

module.exports = () => {
  const googleServicesFileFromEnv = process.env.GOOGLE_SERVICES_JSON;
  const webVapidPublicKeyFromEnv =
    process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY || process.env.NOTIFICATION_VAPID_PUBLIC_KEY;

  return {
    ...baseConfig,
    android: {
      ...(baseConfig.android || {}),
      googleServicesFile:
        googleServicesFileFromEnv ||
        baseConfig.android?.googleServicesFile ||
        "./google-services.json",
    },
    notification: {
      ...(baseConfig.notification || {}),
      ...(webVapidPublicKeyFromEnv
        ? { vapidPublicKey: webVapidPublicKeyFromEnv }
        : {}),
    },
  };
};
