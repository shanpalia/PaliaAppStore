/**
 * =====================================================================
 * PaliaAPK HUB — supabase.js
 * Supabase client initialization
 * =====================================================================
 *
 * This module creates a single shared Supabase client instance used by
 * database.js and storage.js. No real credentials are included here —
 * replace the placeholder constants below with your project's values,
 * ideally injected via a build-time environment variable rather than
 * committed to source control.
 *
 * Usage:
 *   import { supabase } from "./supabase.js";
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ---------------------------------------------------------------------
   PLACEHOLDER CONFIGURATION — replace before deploying
   --------------------------------------------------------------------- */
const SUPABASE_URL = "https://ralinnuegsbuvlhwpzln.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhbGlubnVlZ3NidXZsaHdwemxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyOTU2NDIsImV4cCI6MjA5NTg3MTY0Mn0.hIec6UxRx5gzSMTi5oJ3_xXw3d1QKCmKsPF-stBwIFE";

/* ---------------------------------------------------------------------
   STORAGE BUCKET NAMES — placeholders, adjust to match your project
   --------------------------------------------------------------------- */
export const BUCKETS = {
  ICONS: "app-icons",
  BANNERS: "app-banners",
  SCREENSHOTS: "app-screenshots",
  APKS: "app-apks",
};

/* ---------------------------------------------------------------------
   TABLE NAMES — kept centralized so database.js never hardcodes strings
   --------------------------------------------------------------------- */
export const TABLES = {
  APPS: "apps",
  CATEGORIES: "categories",
  BANNERS: "banners",
  DOWNLOADS: "downloads",
  FAVORITES: "favorites",
  USERS: "users",
};

/* ---------------------------------------------------------------------
   CLIENT INSTANCE
   --------------------------------------------------------------------- */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
