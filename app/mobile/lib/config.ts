/**
 * Global configuration for the mobile app.
 */

// Use an environment variable for the default site URL if available, 
// otherwise fallback to the development environment.
// In Expo, you can use process.env.EXPO_PUBLIC_DEFAULT_SITE_URL
export const DEFAULT_SITE_URL = process.env.EXPO_PUBLIC_DEFAULT_SITE_URL || "";

/**
 * List of hosts that are allowed to use insecure HTTP.
 * Typically used for local development.
 */
export const ALLOWED_INSECURE_HOSTS = [
    "localhost",
    "127.0.0.1",
];
