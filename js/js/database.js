/**
 * =====================================================================
 * PaliaAPK HUB — database.js
 * Supabase database access layer
 * =====================================================================
 *
 * All read/write operations against the Postgres tables backing
 * PaliaAPK HUB live here. Every exported function returns a plain
 * { data, error } shaped result (mirroring the Supabase client) so
 * callers can handle failures without try/catch at every call site.
 *
 * -----------------------------------------------------------------
 * SCHEMA REFERENCE (for provisioning — run in the Supabase SQL editor)
 * -----------------------------------------------------------------
 *
 * create table apps (
 *   id                uuid primary key default gen_random_uuid(),
 *   name              text not null,
 *   package_name      text not null unique,
 *   developer         text not null,
 *   description       text,
 *   version           text,
 *   size              text,
 *   android_version   text,
 *   category          text references categories(slug),
 *   rating            numeric(2,1) default 0,
 *   downloads         bigint default 0,
 *   icon_url          text,
 *   banner_url        text,
 *   apk_url           text,
 *   screenshots       text[] default '{}',
 *   featured          boolean default false,
 *   trending          boolean default false,
 *   new_app           boolean default false,
 *   created_at        timestamptz default now(),
 *   updated_at        timestamptz default now()
 * );
 *
 * create table categories (
 *   id          uuid primary key default gen_random_uuid(),
 *   name        text not null,
 *   slug        text not null unique,
 *   icon_url    text,
 *   created_at  timestamptz default now()
 * );
 *
 * create table banners (
 *   id          uuid primary key default gen_random_uuid(),
 *   app_id      uuid references apps(id) on delete cascade,
 *   image_url   text not null,
 *   title       text,
 *   subtitle    text,
 *   sort_order  integer default 0,
 *   active      boolean default true,
 *   created_at  timestamptz default now()
 * );
 *
 * create table downloads (
 *   id          uuid primary key default gen_random_uuid(),
 *   app_id      uuid references apps(id) on delete cascade,
 *   user_id     uuid references users(id),
 *   downloaded_at timestamptz default now()
 * );
 *
 * create table favorites (
 *   id          uuid primary key default gen_random_uuid(),
 *   app_id      uuid references apps(id) on delete cascade,
 *   user_id     uuid references users(id) on delete cascade,
 *   created_at  timestamptz default now(),
 *   unique (app_id, user_id)
 * );
 *
 * create table users (
 *   id          uuid primary key references auth.users(id) on delete cascade,
 *   email       text unique,
 *   display_name text,
 *   avatar_url  text,
 *   created_at  timestamptz default now()
 * );
 *
 * -- Recommended: an atomic increment function for downloads
 * create or replace function increment_app_downloads(target_id uuid)
 * returns void as $$
 *   update apps set downloads = downloads + 1, updated_at = now()
 *   where id = target_id;
 * $$ language sql;
 *
 * Usage:
 *   import { loadApps, getAppById } from "./database.js";
 */

import { supabase, TABLES } from "./supabase.js";

/* ---------------------------------------------------------------------
   CONSTANTS
   --------------------------------------------------------------------- */
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_RESULT_LIMIT = 6;
const RELATED_APPS_LIMIT = 4;

/* ---------------------------------------------------------------------
   INTERNAL HELPERS
   --------------------------------------------------------------------- */

/** Normalizes a Supabase response into a consistent { data, error } shape. */
const wrapResult = (data, error) => ({
  data: data ?? null,
  error: error ? error.message || String(error) : null,
});

/** Wraps a thrown exception (network failure, etc.) into the same shape. */
const wrapException = (err) => ({
  data: null,
  error: err instanceof Error ? err.message : String(err),
});

/* ---------------------------------------------------------------------
   APPS — LISTING QUERIES
   --------------------------------------------------------------------- */

/**
 * Load a general, paginated list of apps ordered by newest first.
 * @param {{ page?: number, pageSize?: number }} [options]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadApps = async ({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) => {
  try {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/**
 * Load apps flagged as featured (used in the hero slider / featured section).
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadFeaturedApps = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .eq("featured", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/**
 * Load apps flagged as trending.
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadTrendingApps = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .eq("trending", true)
      .order("downloads", { ascending: false })
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/**
 * Load apps flagged as newly published.
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadNewApps = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .eq("new_app", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/**
 * Load the highest-ranked apps by rating, then by download count.
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadTopCharts = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .order("rating", { ascending: false })
      .order("downloads", { ascending: false })
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   CATEGORIES
   --------------------------------------------------------------------- */

/**
 * Load all categories, ordered alphabetically by name.
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const loadCategories = async () => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CATEGORIES)
      .select("*")
      .order("name", { ascending: true });

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   SINGLE APP LOOKUP
   --------------------------------------------------------------------- */

/**
 * Fetch a single app record by its primary key.
 * @param {string} id
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const getAppById = async (id) => {
  if (!id) return { data: null, error: "getAppById requires an app id" };

  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .eq("id", id)
      .single();

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   DOWNLOAD TRACKING
   --------------------------------------------------------------------- */

/**
 * Atomically increments an app's download counter and logs a download
 * event. Prefers a Postgres RPC (increment_app_downloads) to avoid
 * read-modify-write race conditions; falls back to a manual update if
 * the RPC is unavailable.
 * @param {string} appId
 * @param {string|null} [userId] - Optional, for authenticated users.
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const incrementDownload = async (appId, userId = null) => {
  if (!appId) return { data: null, error: "incrementDownload requires an app id" };

  try {
    const { error: rpcError } = await supabase.rpc("increment_app_downloads", {
      target_id: appId,
    });

    if (rpcError) {
      // Fallback path: manual read-then-write (non-atomic, best effort).
      const { data: current, error: fetchError } = await supabase
        .from(TABLES.APPS)
        .select("downloads")
        .eq("id", appId)
        .single();

      if (fetchError) return wrapResult(null, fetchError);

      const { data, error } = await supabase
        .from(TABLES.APPS)
        .update({ downloads: (current?.downloads ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", appId)
        .select()
        .single();

      if (error) return wrapResult(null, error);

      await logDownloadEvent(appId, userId);
      return wrapResult(data, null);
    }

    await logDownloadEvent(appId, userId);
    return wrapResult({ appId }, null);
  } catch (err) {
    return wrapException(err);
  }
};

/**
 * Internal: inserts a row into the downloads table for analytics/history.
 * Failures here are logged but never block the primary download flow.
 * @param {string} appId
 * @param {string|null} userId
 */
const logDownloadEvent = async (appId, userId) => {
  try {
    await supabase.from(TABLES.DOWNLOADS).insert({
      app_id: appId,
      user_id: userId,
    });
  } catch {
    /* Non-critical — the download counter increment already succeeded. */
  }
};

/* ---------------------------------------------------------------------
   SEARCH
   --------------------------------------------------------------------- */

/**
 * Search apps by name, developer, category, or version.
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const searchApps = async (query, limit = SEARCH_RESULT_LIMIT) => {
  const trimmed = (query || "").trim();
  if (!trimmed) return { data: [], error: null };

  try {
    const pattern = `%${trimmed}%`;

    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .or(
        [
          `name.ilike.${pattern}`,
          `developer.ilike.${pattern}`,
          `category.ilike.${pattern}`,
          `version.ilike.${pattern}`,
        ].join(",")
      )
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   RELATED / SIMILAR APPS
   --------------------------------------------------------------------- */

/**
 * Fetch apps related to a given app — same category, excluding itself.
 * @param {string} appId
 * @param {string} category
 * @param {number} [limit]
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const getRelatedApps = async (appId, category, limit = RELATED_APPS_LIMIT) => {
  if (!category) return { data: [], error: null };

  try {
    const { data, error } = await supabase
      .from(TABLES.APPS)
      .select("*")
      .eq("category", category)
      .neq("id", appId)
      .order("rating", { ascending: false })
      .limit(limit);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   FAVORITES (bonus — supports the favorites table defined in schema)
   --------------------------------------------------------------------- */

/**
 * Toggle a favorite record for a user/app pair.
 * @param {string} appId
 * @param {string} userId
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export const toggleFavorite = async (appId, userId) => {
  if (!appId || !userId) {
    return { data: null, error: "toggleFavorite requires both appId and userId" };
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from(TABLES.FAVORITES)
      .select("id")
      .eq("app_id", appId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) return wrapResult(null, fetchError);

    if (existing) {
      const { error } = await supabase.from(TABLES.FAVORITES).delete().eq("id", existing.id);
      return wrapResult({ favorited: false }, error);
    }

    const { error } = await supabase.from(TABLES.FAVORITES).insert({ app_id: appId, user_id: userId });
    return wrapResult({ favorited: true }, error);
  } catch (err) {
    return wrapException(err);
  }
};
