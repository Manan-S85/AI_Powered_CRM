# Google Service Account Credentials

Place your Google service account JSON credentials file in this directory.

The file should be named: `google-service-account.json`

## How to get Google Service Account credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Sheets API
4. Go to IAM & Admin > Service Accounts
5. Create a new service account
6. Download the JSON key file
7. Place it in this directory as `google-service-account.json`
8. Share your Google Sheet with the service account email

**IMPORTANT**: This file contains sensitive credentials and is automatically ignored by git.