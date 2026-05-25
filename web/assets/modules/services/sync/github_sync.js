// Path: web/assets/modules/services/sync/github_sync.js
import { getLogger } from "utils/logger.js";
import { GithubAuthManager } from "services/sync/github_auth_manager.js";

const logger = getLogger("GithubSync");

export const GithubSync = {
    /**
     * Internal request wrapper for GitHub REST API
     */
    async _request(method, endpoint, body = null) {
        const token = GithubAuthManager.getToken();
        const username = GithubAuthManager.getUsername();
        const repo = GithubAuthManager.getRepoName();
        
        if (!token || !username) {
            throw new Error("Not authenticated");
        }

        const url = `https://api.github.com/repos/${username}/${repo}${endpoint}`;
        const options = {
            method,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        if (!response.ok && response.status !== 404) {
            const err = await response.json().catch(() => ({ message: "Unknown error" }));
            throw new Error(`GitHub API Error (${response.status}): ${err.message}`);
        }
        return response;
    },

    async downloadData(filePath) {
        try {
            logger.info("Download", `Fetching ${filePath}...`);
            const response = await this._request("GET", `/contents/${filePath}?cache_bust=${Date.now()}`);
            
            if (response.status === 404) {
                logger.info("Download", `File ${filePath} not found on cloud.`);
                return null;
            }

            const data = await response.json();
            
            // Decode Base64 content properly (handles Unicode)
            const binaryString = atob(data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            const content = decoder.decode(bytes);
            
            let parsed = content;
            if (filePath.endsWith(".json")) {
                parsed = JSON.parse(content);
            }
            
            return {
                data: parsed,
                sha: data.sha
            };
        } catch (error) {
            logger.error("Download", error);
            throw error;
        }
    },

    /**
     * Delete a file from GitHub
     */
    async deleteFile(filePath, sha, message = `Delete ${filePath}`) {
        try {
            logger.info("Delete", `Deleting ${filePath}...`);
            const response = await this._request("DELETE", `/contents/${filePath}`, {
                message: message,
                sha: sha
            });
            return response.ok;
        } catch (error) {
            logger.error("Delete", error);
            return false;
        }
    },

    /**
     * Upload multiple files in a single Git commit using the Data API.
     * files: Array of objects { path, content }
     */
    async uploadMultipleFiles(files, commitMessage = "Sync: Update multiple files") {
        try {
            const deviceId = GithubAuthManager.getDeviceId();
            const fullMessage = `${commitMessage} [${deviceId}]`;
            logger.info("Upload", `Uploading ${files.length} files using Data API (Device: ${deviceId})...`);
            
            // 1. Get current branch reference (main)
            const refRes = await this._request("GET", "/git/refs/heads/main");
            const refData = await refRes.json();
            const lastCommitSha = refData.object.sha;

            // 2. Create Blobs for all files
            const treeItems = [];
            for (const file of files) {
                const contentString = typeof file.content === "string" ? file.content : this._stringifyCompact(file.content);
                const blobRes = await this._request("POST", "/git/blobs", {
                    content: contentString,
                    encoding: "utf-8"
                });
                const blobData = await blobRes.json();
                treeItems.push({
                    path: file.path,
                    mode: "100644",
                    type: "blob",
                    sha: blobData.sha
                });
            }

            // 3. Create a new Tree based on the last commit
            const treeRes = await this._request("POST", "/git/trees", {
                base_tree: lastCommitSha,
                tree: treeItems
            });
            const treeData = await treeRes.json();
            const newTreeSha = treeData.sha;

            // 4. Create the Commit
            const commitRes = await this._request("POST", "/git/commits", {
                message: fullMessage,
                tree: newTreeSha,
                parents: [lastCommitSha]
            });
            const commitData = await commitRes.json();
            const newCommitSha = commitData.sha;

            // 5. Update the Reference (Main branch)
            await this._request("PATCH", "/git/refs/heads/main", {
                sha: newCommitSha,
                force: true 
            });

            logger.info("Upload", "Data API Success.");
            
            // Return new SHAs for the updated files by fetching the new tree
            const newTreeRes = await this._request("GET", `/git/trees/${newTreeSha}?recursive=1`);
            const newTreeData = await newTreeRes.json();
            
            const newShas = {};
            for (const file of files) {
                const node = newTreeData.tree.find(t => t.path === file.path);
                if (node) {
                    newShas[file.path] = node.sha;
                }
            }
            return newShas;

        } catch (error) {
            logger.error("Upload Multiple", error);
            throw error;
        }
    },

    /**
     * Advanced Upload using Git Data API for clean commit history.
     * Logic: Get Main Ref -> Create Blob -> Create Tree (relative to old tree) -> Create Commit -> Update Ref.
     */
    async uploadData(payload, currentSha = null, filePath) {
        try {
            const shas = await this.uploadMultipleFiles([{ path: filePath, content: payload }], `Sync: Update ${filePath}`);
            return shas[filePath];
        } catch (error) {
            logger.error("Upload Data API", error);
            throw error;
        }
    },

    /**
     * [NEW] Helper to stringify JSON with indented structure but compact arrays for history.
     * Collapses structures like:
     * "mn127": [
     *   1,
     *   1778049057895
     * ]
     * Into: "mn127": [1, 1778049057895]
     */
    _stringifyCompact(obj) {
        const json = JSON.stringify(obj, null, 2);
        // Regex to collapse number arrays with exactly 2 elements onto one line
        // Handles level (pos/neg/zero) and large timestamps
        return json.replace(/:\s*\[\s*(-?\d+),\s*(\d+)\s*\]/g, ': [$1, $2]');
    }
};
