/**
 * =====================================================================
 * PaliaAPK HUB — storage.js
 * Supabase Storage access layer
 * =====================================================================
 *
 * Handles all file storage concerns: resolving public URLs for app
 * icons/banners/screenshots, uploading assets, and preparing APK
 * download links. No credentials are included — bucket names are
 * centralized in supabase.js (BUCKETS).
 *
 * Usage:
 *   import { getAppIconUrl, uploadScreenshot, getApkDownloadUrl } from "./storage.js";
 */

import { supabase, BUCKETS } from "./supabase.js";

/* ---------------------------------------------------------------------
   INTERNAL HELPERS
   --------------------------------------------------------------------- */

const wrapResult = (data, error) => ({
  data: data ?? null,
  error: error ? error.message || String(error) : null,
});

const wrapException = (err) => ({
  data: null,
  error: err instanceof Error ? err.message : String(err),
});

/**
 * Builds a collision-resistant storage path for an uploaded file.
 * @param {string} appId
 * @param {File} file
 * @returns {string}
 */
const buildFilePath = (appId, file) => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  return `${appId}/${Date.now()}-${safeName}`;
};

/* ---------------------------------------------------------------------
   PUBLIC URL RESOLUTION
   --------------------------------------------------------------------- */

/**
 * Resolves the public URL for a stored icon path.
 * @param {string} path - Storage object path (not a full URL).
 * @returns {string|null}
 */
export const getAppIconUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKETS.ICONS).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

/**
 * Resolves the public URL for a stored banner path.
 * @param {string} path
 * @returns {string|null}
 */
export const getAppBannerUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKETS.BANNERS).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

/**
 * Resolves public URLs for an array of stored screenshot paths.
 * @param {string[]} paths
 * @returns {string[]}
 */
export const getScreenshotUrls = (paths) => {
  if (!Array.isArray(paths)) return [];
  return paths
    .map((path) => supabase.storage.from(BUCKETS.SCREENSHOTS).getPublicUrl(path).data?.publicUrl)
    .filter(Boolean);
};

/**
 * Resolves the public/APK download URL for a stored package path.
 * @param {string} path
 * @returns {string|null}
 */
export const getApkDownloadUrl = (path) => {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKETS.APKS).getPublicUrl(path);
  return data?.publicUrl ?? null;
};

/**
 * Generates a time-limited signed URL for a private APK bucket.
 * Use this instead of getApkDownloadUrl if the APK bucket is not public.
 * @param {string} path
 * @param {number} [expiresInSeconds]
 * @returns {Promise<{data: {signedUrl: string}|null, error: string|null}>}
 */
export const getSignedApkUrl = async (path, expiresInSeconds = 300) => {
  if (!path) return { data: null, error: "getSignedApkUrl requires a storage path" };

  try {
    const { data, error } = await supabase.storage
      .from(BUCKETS.APKS)
      .createSignedUrl(path, expiresInSeconds);

    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   UPLOADS
   --------------------------------------------------------------------- */

/**
 * Uploads an app icon and returns its storage path.
 * @param {string} appId
 * @param {File} file
 * @returns {Promise<{data: {path: string, url: string}|null, error: string|null}>}
 */
export const uploadAppIcon = async (appId, file) => {
  return uploadToBucket(BUCKETS.ICONS, appId, file, getAppIconUrl);
};

/**
 * Uploads an app banner and returns its storage path.
 * @param {string} appId
 * @param {File} file
 * @returns {Promise<{data: {path: string, url: string}|null, error: string|null}>}
 */
export const uploadAppBanner = async (appId, file) => {
  return uploadToBucket(BUCKETS.BANNERS, appId, file, getAppBannerUrl);
};

/**
 * Uploads a single screenshot and returns its storage path.
 * @param {string} appId
 * @param {File} file
 * @returns {Promise<{data: {path: string, url: string}|null, error: string|null}>}
 */
export const uploadScreenshot = async (appId, file) => {
  return uploadToBucket(BUCKETS.SCREENSHOTS, appId, file, (path) =>
    supabase.storage.from(BUCKETS.SCREENSHOTS).getPublicUrl(path).data?.publicUrl ?? null
  );
};

/**
 * Uploads an APK package file and returns its storage path.
 * @param {string} appId
 * @param {File} file
 * @returns {Promise<{data: {path: string, url: string}|null, error: string|null}>}
 */
export const uploadApk = async (appId, file) => {
  return uploadToBucket(BUCKETS.APKS, appId, file, getApkDownloadUrl);
};

/**
 * Internal: shared upload implementation for all buckets.
 * @param {string} bucket
 * @param {string} appId
 * @param {File} file
 * @param {(path: string) => string|null} resolveUrl
 * @returns {Promise<{data: {path: string, url: string}|null, error: string|null}>}
 */
const uploadToBucket = async (bucket, appId, file, resolveUrl) => {
  if (!appId || !file) {
    return { data: null, error: "uploadToBucket requires an appId and a file" };
  }

  try {
    const path = buildFilePath(appId, file);

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) return wrapResult(null, error);

    return wrapResult({ path, url: resolveUrl(path) }, null);
  } catch (err) {
    return wrapException(err);
  }
};

/* ---------------------------------------------------------------------
   DELETION
   --------------------------------------------------------------------- */

/**
 * Removes one or more files from a given bucket.
 * @param {string} bucket - One of the BUCKETS constants.
 * @param {string[]} paths
 * @returns {Promise<{data: Array|null, error: string|null}>}
 */
export const removeFiles = async (bucket, paths) => {
  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    return { data: null, error: "removeFiles requires a bucket and a non-empty paths array" };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).remove(paths);
    return wrapResult(data, error);
  } catch (err) {
    return wrapException(err);
  }
};
