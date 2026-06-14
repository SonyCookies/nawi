import { exportDatabaseToJson, importDatabaseFromJson } from "./backup";

export const GOOGLE_CLIENT_ID = "155043319046-2c7leptg8kb3pcqunpj8vp743fnn3a76.apps.googleusercontent.com";
export const BACKUP_FILE_NAME = "nawi_db_sync.json";

export interface GoogleUserProfile {
  email: string;
  picture?: string;
  name?: string;
}

export interface CloudBackupMetadata {
  id: string;
  modifiedTime: string;
  size?: string;
}

let tokenClient: any = null;

/**
 * Initializes the Google Identity Services OAuth token client.
 */
export function initGoogleTokenClient(onTokenReceived: (accessToken: string) => void, onError?: (err: any) => void) {
  if (typeof window === "undefined" || !(window as any).google) {
    console.warn("Google Identity Services script not loaded yet.");
    return;
  }

  try {
    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile https://www.googleapis.com/auth/drive.appdata",
      callback: (response: any) => {
        if (response.error) {
          console.error("OAuth error response:", response);
          onError?.(response);
          return;
        }
        if (response.access_token) {
          onTokenReceived(response.access_token);
        }
      },
      error_callback: (err: any) => {
        console.error("GIS client error:", err);
        onError?.(err);
      }
    });
  } catch (err) {
    console.error("Error initializing Google Token Client:", err);
  }
}

/**
 * Request permission popup from user.
 */
export function requestGoogleAccessToken() {
  if (!tokenClient) {
    throw new Error("Google Token Client is not initialized. Please wait a moment and try again.");
  }
  tokenClient.requestAccessToken({ prompt: "consent" });
}

/**
 * Fetch Google User Profile information.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Fetch Google profile failed:", errorText);
    throw new Error(`Failed to fetch Google profile: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Finds the backup file in Google Drive's hidden App Data folder.
 */
export async function getCloudBackupMetadata(accessToken: string): Promise<CloudBackupMetadata | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${BACKUP_FILE_NAME}'&fields=files(id,modifiedTime,size)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error("Query Google Drive failed:", errorDetails);
    throw new Error(`Failed to query Google Drive: ${response.status} - ${errorDetails}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return {
      id: data.files[0].id,
      modifiedTime: data.files[0].modifiedTime,
      size: data.files[0].size,
    };
  }

  return null;
}

/**
 * Exports database to JSON and uploads to Google Drive appDataFolder space.
 */
export async function uploadBackupToDrive(accessToken: string): Promise<CloudBackupMetadata> {
  const jsonContent = await exportDatabaseToJson();
  const existingMeta = await getCloudBackupMetadata(accessToken);

  const metadata = {
    name: BACKUP_FILE_NAME,
    parents: existingMeta ? undefined : ["appDataFolder"],
  };

  const boundary = "nawi_sync_multipart_boundary_715";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    jsonContent +
    closeDelimiter;

  const url = existingMeta
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingMeta.id}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const response = await fetch(url, {
    method: existingMeta ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Upload failed details:", errorText);
    throw new Error(`Failed to upload backup: ${response.statusText}`);
  }

  const responseData = await response.json();
  return {
    id: responseData.id || (existingMeta ? existingMeta.id : ""),
    modifiedTime: new Date().toISOString(),
  };
}

/**
 * Downloads backup JSON from Google Drive appDataFolder and imports it to Dexie.
 */
export async function downloadBackupFromDrive(accessToken: string): Promise<boolean> {
  const existingMeta = await getCloudBackupMetadata(accessToken);
  if (!existingMeta) {
    return false;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${existingMeta.id}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Download cloud backup content failed:", errorText);
    throw new Error(`Failed to download backup content: ${response.status} - ${errorText}`);
  }

  const jsonContent = await response.text();
  await importDatabaseFromJson(jsonContent);
  return true;
}
