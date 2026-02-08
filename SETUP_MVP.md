# TaskFlow MVP Setup Guide

## 1. Environment Variables

Create a `.env` file (copy from `.env.example`) and add:

```env
# OpenRouter AI - Get key from https://openrouter.ai
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Email (Gmail - use App Password)
SMTP_USER=khichiptatik90@gmail.com
SMTP_PASSWORD=uaul dcpy ytsh bosz

# Admin dashboard secret (for /admin)
ADMIN_SECRET=taskflow-admin-secret-change-me
```

## 2. Database Migration

Run the fix-db endpoint once to create trial tables and columns:

```
GET http://localhost:3000/api/fix-db
```

Or run manually:
```sql
-- Add trial columns to users
ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN is_trial_approved BOOLEAN DEFAULT FALSE;

-- Create trial_requests table (see scripts/add-trial-columns.sql)
```

## 3. Admin Dashboard

- **URL:** `http://localhost:3000/admin`
- **Access:** Enter your `ADMIN_SECRET` from .env
- **Flow:** Trial requests appear here. Click "Approve Trial" to activate a user's 7-day trial and send them an email.

## 4. Trial Flow

1. User visits landing page → clicks "Book 7-Day Free Trial"
2. User fills form at `/auth/trial` → request saved to `trial_requests`
3. Admin goes to `/admin` → sees request → clicks "Approve Trial"
4. System creates user (if new), sets 7-day trial, emails user
5. User can now log in at `/auth/login` with same credentials

## 5. Email Notifications

Emails are sent for:
- Trial approval (user can now login)
- Workspace created / member added to workspace
- Project created (all workspace members)
- Task assigned (assignee)
- Employee created by admin (credentials to employee)

## 6. AI Features

- **Task suggestions:** On the Tasks page, when creating a task, enter a description and click "AI suggest tasks" to get AI-generated task titles.
- Uses OpenRouter (arcee-ai/trinity-large-preview) model.
