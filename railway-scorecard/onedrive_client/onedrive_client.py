"""
onedrive_client.py — Microsoft Graph API client for SharePoint file access.

Downloads files from SharePoint document libraries using app-only (client credentials)
authentication. No interactive login required.

Tenant: Greythorn Services (legacy SharePoint domain: sepuklogistics.sharepoint.com)

Azure AD App: FV Agents OneDrive Access
  - Permissions: Files.Read.All, Sites.Read.All (Application)
  - Credentials: Set via environment variables (see .env.example)
"""

import os
import json
import time
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _require_env(name: str) -> str:
    """Get a required environment variable or raise with a helpful message."""
    value = os.environ.get(name)
    if not value:
        raise EnvironmentError(
            f"Missing required environment variable: {name}\n"
            f"Set it in the Railway dashboard or export it in your shell."
        )
    return value


SHAREPOINT_HOST = os.environ.get(
    "SHAREPOINT_HOST",
    "sepuklogistics.sharepoint.com"
)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"

logger = logging.getLogger(__name__)


class OneDriveClientError(Exception):
    """Raised for OneDrive client errors."""
    pass


class OneDriveClient:
    """
    Microsoft Graph API client for downloading files from SharePoint.

    Uses client credentials (app-only) authentication — no interactive
    login needed. Suitable for headless/scheduled server environments.
    """

    def __init__(
        self,
        tenant_id: str = None,
        client_id: str = None,
        client_secret: str = None,
        sharepoint_host: str = SHAREPOINT_HOST,
    ):
        self.tenant_id = tenant_id or _require_env("AZURE_TENANT_ID")
        self.client_id = client_id or _require_env("AZURE_CLIENT_ID")
        self.client_secret = client_secret or _require_env("AZURE_CLIENT_SECRET")
        self.sharepoint_host = sharepoint_host

        self._token: Optional[str] = None
        self._token_expiry: float = 0

        # Cache: site_name -> site_id
        self._site_cache: dict[str, str] = {}
        # Cache: (site_id, library_name) -> drive_id
        self._drive_cache: dict[tuple[str, str], str] = {}

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def _get_token(self) -> str:
        """Get or refresh the OAuth2 access token using client credentials."""
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }

        logger.debug("Requesting new access token...")
        resp = requests.post(url, data=payload, timeout=30)

        if resp.status_code != 200:
            raise OneDriveClientError(
                f"Token request failed ({resp.status_code}): {resp.text}"
            )

        data = resp.json()
        self._token = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600)
        logger.debug("Access token acquired, expires in %ds", data.get("expires_in"))
        return self._token

    def _headers(self) -> dict:
        """Return authorization headers."""
        return {"Authorization": f"Bearer {self._get_token()}"}

    # ------------------------------------------------------------------
    # Graph API helpers
    # ------------------------------------------------------------------

    def _get_json(self, url: str) -> dict:
        """GET request returning JSON, with error handling."""
        resp = requests.get(url, headers=self._headers(), timeout=30)
        if resp.status_code == 404:
            raise OneDriveClientError(f"Not found: {url}")
        if resp.status_code != 200:
            raise OneDriveClientError(
                f"Graph API error ({resp.status_code}): {resp.text}"
            )
        return resp.json()

    def _download_url(self, url: str, local_path: Path) -> Path:
        """Download a file from a Graph API download URL."""
        resp = requests.get(url, headers=self._headers(), timeout=120, stream=True)
        if resp.status_code != 200:
            raise OneDriveClientError(
                f"Download failed ({resp.status_code}): {resp.text}"
            )

        local_path = Path(local_path)
        local_path.parent.mkdir(parents=True, exist_ok=True)

        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        size_mb = local_path.stat().st_size / (1024 * 1024)
        logger.info("Downloaded: %s (%.2f MB)", local_path.name, size_mb)
        return local_path

    # ------------------------------------------------------------------
    # Site and Drive resolution
    # ------------------------------------------------------------------

    def _get_site_id(self, site_name: str) -> str:
        """Resolve a SharePoint site name to its Graph API site ID."""
        if site_name in self._site_cache:
            return self._site_cache[site_name]

        url = f"{GRAPH_BASE}/sites/{self.sharepoint_host}:/sites/{site_name}"
        data = self._get_json(url)
        site_id = data["id"]
        self._site_cache[site_name] = site_id
        logger.debug("Resolved site '%s' -> %s", site_name, site_id)
        return site_id

    def _get_drive_id(self, site_name: str, library_name: str) -> str:
        """Resolve a document library name to its Graph API drive ID."""
        cache_key = (site_name, library_name)
        if cache_key in self._drive_cache:
            return self._drive_cache[cache_key]

        site_id = self._get_site_id(site_name)
        url = f"{GRAPH_BASE}/sites/{site_id}/drives"
        data = self._get_json(url)

        # Match library by name (case-insensitive)
        library_lower = library_name.lower()
        for drive in data.get("value", []):
            if drive["name"].lower() == library_lower:
                drive_id = drive["id"]
                self._drive_cache[cache_key] = drive_id
                logger.debug(
                    "Resolved library '%s' on '%s' -> %s",
                    library_name, site_name, drive_id
                )
                return drive_id

        # List available libraries for debugging
        available = [d["name"] for d in data.get("value", [])]
        raise OneDriveClientError(
            f"Library '{library_name}' not found on site '{site_name}'. "
            f"Available libraries: {available}"
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def download_file(
        self,
        site_name: str,
        library_name: str,
        file_path: str,
        local_path: str | Path,
    ) -> Path:
        """
        Download a single file from a SharePoint document library.

        Args:
            site_name:    SharePoint site name (e.g. "DirectorsStorage")
            library_name: Document library name (e.g. "Documents")
            file_path:    Path within the library (e.g. "folder/file.xlsx")
            local_path:   Where to save the file locally

        Returns:
            Path to the downloaded file
        """
        drive_id = self._get_drive_id(site_name, library_name)
        encoded_path = quote(file_path)
        url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{encoded_path}"

        data = self._get_json(url)
        download_url = data.get("@microsoft.graph.downloadUrl")

        if not download_url:
            raise OneDriveClientError(
                f"No download URL returned for '{file_path}'"
            )

        return self._download_url(download_url, Path(local_path))

    def list_folder(
        self,
        site_name: str,
        library_name: str,
        folder_path: str,
    ) -> list[dict]:
        """
        List files in a SharePoint folder.

        Returns:
            List of dicts with keys: name, size, last_modified, is_folder, id
        """
        drive_id = self._get_drive_id(site_name, library_name)
        encoded_path = quote(folder_path)
        url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{encoded_path}:/children"

        data = self._get_json(url)
        items = []
        for item in data.get("value", []):
            items.append({
                "name": item["name"],
                "size": item.get("size", 0),
                "last_modified": item.get("lastModifiedDateTime", ""),
                "is_folder": "folder" in item,
                "id": item["id"],
            })

        logger.info(
            "Listed %d items in %s/%s/%s",
            len(items), site_name, library_name, folder_path
        )
        return items

    def download_folder(
        self,
        site_name: str,
        library_name: str,
        folder_path: str,
        local_dir: str | Path,
        extension_filter: Optional[str] = None,
    ) -> list[Path]:
        """
        Download all files from a SharePoint folder.

        Args:
            site_name:        SharePoint site name
            library_name:     Document library name
            folder_path:      Path to folder within the library
            local_dir:        Local directory to save files into
            extension_filter: Optional file extension filter (e.g. ".pdf")

        Returns:
            List of Paths to downloaded files
        """
        items = self.list_folder(site_name, library_name, folder_path)
        local_dir = Path(local_dir)
        local_dir.mkdir(parents=True, exist_ok=True)

        downloaded = []
        for item in items:
            if item["is_folder"]:
                logger.debug("Skipping subfolder: %s", item["name"])
                continue

            if extension_filter and not item["name"].lower().endswith(extension_filter.lower()):
                logger.debug("Skipping (filter): %s", item["name"])
                continue

            file_remote_path = f"{folder_path}/{item['name']}"
            local_path = local_dir / item["name"]

            try:
                self.download_file(site_name, library_name, file_remote_path, local_path)
                downloaded.append(local_path)
            except OneDriveClientError as e:
                logger.error("Failed to download '%s': %s", item["name"], e)

        logger.info(
            "Downloaded %d/%d files from %s/%s/%s",
            len(downloaded), len(items), site_name, library_name, folder_path
        )
        return downloaded

    def delete_file(
        self,
        site_name: str,
        library_name: str,
        file_path: str,
    ) -> bool:
        """Delete a file from a SharePoint document library."""
        drive_id = self._get_drive_id(site_name, library_name)
        encoded_path = quote(file_path)
        url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{encoded_path}"

        resp = requests.delete(url, headers=self._headers(), timeout=30)
        if resp.status_code == 204:
            logger.info("Deleted: %s", file_path)
            return True
        raise OneDriveClientError(
            f"Delete failed ({resp.status_code}): {resp.text}"
        )

    def upload_file(
        self,
        site_name: str,
        library_name: str,
        remote_path: str,
        local_path: str | Path,
    ) -> dict:
        """
        Upload a file to a SharePoint document library.
        Uses resumable upload session for files over 4 MB.
        """
        local_path = Path(local_path)
        if not local_path.exists():
            raise OneDriveClientError(f"Local file not found: {local_path}")

        file_size = local_path.stat().st_size
        drive_id = self._get_drive_id(site_name, library_name)
        encoded_path = quote(remote_path)

        if file_size <= 4 * 1024 * 1024:
            return self._simple_upload(drive_id, encoded_path, local_path, file_size)
        else:
            return self._resumable_upload(drive_id, encoded_path, local_path, file_size)

    def _simple_upload(self, drive_id: str, encoded_path: str, local_path: Path, file_size: int) -> dict:
        """Upload a small file (<= 4 MB) via simple PUT."""
        url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{encoded_path}:/content"

        with open(local_path, "rb") as f:
            data = f.read()

        headers = self._headers()
        headers["Content-Type"] = "application/octet-stream"

        resp = requests.put(url, headers=headers, data=data, timeout=60)

        if resp.status_code not in (200, 201):
            raise OneDriveClientError(
                f"Simple upload failed ({resp.status_code}): {resp.text}"
            )

        result = resp.json()
        logger.info("Uploaded (simple): %s (%.1f KB)", result.get("name"), file_size / 1024)
        return {"name": result.get("name"), "size": result.get("size"), "webUrl": result.get("webUrl")}

    def _resumable_upload(self, drive_id: str, encoded_path: str, local_path: Path, file_size: int) -> dict:
        """Upload a large file (> 4 MB) via resumable upload session."""
        session_url = f"{GRAPH_BASE}/drives/{drive_id}/root:/{encoded_path}:/createUploadSession"

        resp = requests.post(
            session_url,
            headers={**self._headers(), "Content-Type": "application/json"},
            json={"item": {"@microsoft.graph.conflictBehavior": "replace"}},
            timeout=30,
        )

        if resp.status_code not in (200, 201):
            raise OneDriveClientError(f"Failed to create upload session ({resp.status_code}): {resp.text}")

        upload_url = resp.json().get("uploadUrl")
        if not upload_url:
            raise OneDriveClientError("No uploadUrl returned from session creation")

        chunk_size = 10 * 1024 * 1024
        result = None

        with open(local_path, "rb") as f:
            offset = 0
            while offset < file_size:
                chunk = f.read(chunk_size)
                chunk_len = len(chunk)
                end = offset + chunk_len - 1

                resp = requests.put(
                    upload_url,
                    headers={"Content-Length": str(chunk_len), "Content-Range": f"bytes {offset}-{end}/{file_size}"},
                    data=chunk,
                    timeout=120,
                )

                if resp.status_code not in (200, 201, 202):
                    raise OneDriveClientError(f"Chunk upload failed at offset {offset} ({resp.status_code}): {resp.text}")

                offset += chunk_len
                if resp.status_code in (200, 201):
                    result = resp.json()

        if result is None:
            raise OneDriveClientError("Upload completed but no metadata returned")

        logger.info("Uploaded (resumable): %s (%.1f MB)", result.get("name"), file_size / (1024 * 1024))
        return {"name": result.get("name"), "size": result.get("size"), "webUrl": result.get("webUrl")}
