import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// One build per trip for now (trips/guam). When a second trip or brand arrives,
// TRIP selects the content pack and brand, and each gets its own Firebase Hosting target.
export default defineConfig({
  build: { target: "es2022", sourcemap: true },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Guam Coastal Circuit",
        short_name: "Guam Circuit",
        description: "A guided island drive from Asan to the edge of the Pacific.",
        theme_color: "#073B5C",
        background_color: "#F6F0E5",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json,webmanifest}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          { urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate", options: { cacheName: "google-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: ({ url }) => url.hostname === "upload.wikimedia.org",
            handler: "CacheFirst", options: { cacheName: "photos", expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 } } }
        ]
      }
    })
  ]
});
