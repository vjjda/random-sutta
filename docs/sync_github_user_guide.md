# Path: docs/sync_github_user_guide.md

# How to Sync Your Data with GitHub (Beginner's Guide)

This guide will help you set up a private place on GitHub to store and sync your settings, bookmarks, and data across different devices safely.

---

## Step 1: Create a GitHub Account
If you don't have an account yet:
1. Go to [github.com](https://github.com/).
2. Click **Sign up** and follow the instructions.
3. Verify your email address.

---

## Step 2: Create a Private Repository
A "Repository" (or "Repo") is like a folder on the internet where your data will live.
1. Log in to your GitHub account.
2. Click the **+** icon in the top-right corner and select **New repository**.
3. **Repository name**: Type something simple like `my-app-data`.
4. **Public/Private**: Select **Private** (This is important to keep your data safe).
5. Check the box **Add a README file** (This makes the setup easier).
6. Click **Create repository**.

**Keep this page open!** You will need the URL (e.g., `https://github.com/your-username/my-app-data`).

---

## Step 3: Get your Personal Access Token (PAT)
Since the app cannot use your regular password for security reasons, you need a "Token" (a special password just for the app).

1. Click your **Profile Picture** (top-right) -> **Settings**.
2. Scroll down on the left sidebar and click **<> Developer settings**.
3. Click **Personal access tokens** -> **Tokens (classic)**.
   > *Note: While "Fine-grained tokens" are newer, "Classic" is often easier for beginners to set up.*
4. Click **Generate new token** -> **Generate new token (classic)**.
5. **Note**: Type something like `App Sync Token`.
6. **Expiration**: Choose `No expiration` (if you don't want to redo this every month) or `90 days`.
7. **Select scopes**: Check the box for **repo** (Full control of private repositories).
8. Scroll to the bottom and click **Generate token**.

⚠️ **CRITICAL**: Copy the token immediately! It looks like `ghp_xxxxxxxxxxxx`. You will never see it again after you leave this page. Save it in a safe place (like a password manager).

---

## Step 4: Connecting the App
Now go back to the app and enter the following:

1. **GitHub Repository URL**: `https://github.com/your-username/my-app-data`
2. **Personal Access Token**: Paste the `ghp_...` code you just copied.
3. **Branch**: Enter `main`.

Click **Save** or **Sync**, and you're all set!

---

## Security Tips
- **Never share your Token**: Anyone with this token can access your repository.
- **Why Private?**: If you make your repository "Public", anyone on the internet can see your synced data. Always ensure it is set to **Private**.
- **Regenerating**: If you lose your token, you can't "see" it again. You must create a new one using Step 3.
