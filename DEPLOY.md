# Deploying Cinderwake Scribe to AWS (Amplify Hosting + S3)

This is the **cloud-safe** build of the app (the `cloud` git branch). It behaves
exactly like the local app, but stores your books in **S3** instead of the local
disk, reads the Anthropic key from an **environment variable**, and is protected
by a **single password**. Nothing in the original `main` branch is changed.

> **What's different from `main`:** a storage layer (`lib/storage.js`) that swaps
> between local files and S3; `middleware.js` (password gate); `amplify.yml`
> (build spec); `scripts/seed-s3.mjs` (uploader); `@aws-sdk/client-s3` added.
> All the app logic and every API route behave the same.

---

## 0. What you'll create

| Piece | Purpose | Rough cost (single user) |
|-------|---------|--------------------------|
| S3 bucket | Stores your chapters, canon, covers, metadata | pennies/month |
| IAM user (or role) | Lets the app read/write that bucket | free |
| Amplify Hosting app | Runs Next.js, auto-builds from GitHub | ~$0 idle + tiny per-request |
| Route 53 record (or your DNS) | Points sreedharpanaman.com at Amplify | ~$0.50/mo if using Route 53 |

Your real recurring cost is the **Anthropic API**, not AWS.

---

## 1. Create the S3 bucket

AWS Console → **S3 → Create bucket**:

- Name: e.g. `scribe-sreedhar` (must be globally unique) — note it as `S3_BUCKET`.
- Region: pick one and remember it (e.g. `us-east-1`) — this is `AWS_REGION`.
- **Block all public access: ON** (leave it on — the app reads via credentials, not public URLs).
- Versioning: **Enable** (cheap insurance — recover an overwritten chapter).

## 2. Create an IAM user with access to just that bucket

AWS Console → **IAM → Users → Create user** (e.g. `scribe-app`), no console access.
Attach an **inline policy** (replace the bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::scribe-sreedhar"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::scribe-sreedhar/*"
    }
  ]
}
```

Then **Security credentials → Create access key** → *Application running outside AWS*.
Save the **Access key ID** and **Secret access key**.

> Cleaner alternative (optional): skip the IAM user and instead attach the same
> policy to Amplify's compute service role after step 4, then omit the two
> `AWS_*` env vars below. The IAM-user path is the quickest to get running.

## 3. Upload your existing books to the bucket

From the app folder on your machine (the `cloud` checkout), with your local
`../books` present:

```bash
npm install
S3_BUCKET=scribe-sreedhar AWS_REGION=us-east-1 \
AWS_ACCESS_KEY_ID=AKIA... AWS_SECRET_ACCESS_KEY=... \
BOOKS_DIR=../books npm run seed:s3
```

Add `--dry` first to preview. This copies `../books/<id>/**` to keys `<id>/**`
in the bucket. Re-run any time to push local changes up; add `--prune` to also
remove bucket objects you deleted locally.

## 4. Create the Amplify Hosting app

AWS Console → **Amplify → Create new app → Deploy with GitHub**:

1. Authorize GitHub, pick **panamania/scribe**, branch **`cloud`**.
2. Amplify auto-detects Next.js and finds `amplify.yml`. Accept it.
3. Before the first deploy, open **Environment variables** and add:

   | Name | Value |
   |------|-------|
   | `STORAGE` | `s3` |
   | `S3_BUCKET` | `scribe-sreedhar` |
   | `AWS_REGION` | `us-east-1` |
   | `AWS_ACCESS_KEY_ID` | *(from step 2)* |
   | `AWS_SECRET_ACCESS_KEY` | *(from step 2)* |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `SITE_USER` | `sridhar` |
   | `SITE_PASSWORD` | *a strong password* |
   | `SCRIBE_MODEL` | `claude-opus-4-8` *(optional)* |

4. **Save and deploy.** First build takes a few minutes. When it's green, open the
   `...amplifyapp.com` URL — the browser should prompt for your username/password,
   and your books should load from S3.

## 5. Point sreedharpanaman.com at it

Amplify → your app → **Hosting → Custom domains → Add domain**:

- Enter `sreedharpanaman.com` (and/or `scribe.sreedharpanaman.com`).
- Amplify shows DNS records (CNAME/ANAME) and provisions a free SSL cert.
- Add those records at whoever manages your DNS. If DNS is on **Route 53**,
  Amplify can wire it automatically. Propagation + cert validation can take
  15–60 minutes.

Done — the app is live at your domain, private behind your password, storing
everything in S3.

---

## Notes & gotchas

- **The key is never stored in S3.** Because `ANTHROPIC_API_KEY` is set in the
  environment, `lib/settings.js` always uses it and ignores/blanks any key
  submitted through the Settings UI. Model and workspace still save to S3.
- **Rotate the key** you had in the old local `data/settings.json` if it was ever
  shared; set the fresh one only in Amplify env.
- **Auth is app-wide** via `middleware.js`. To change the login, update
  `SITE_USER`/`SITE_PASSWORD` in Amplify and redeploy. (Amplify also has a
  built-in "Access control" basic-auth toggle if you'd rather use that instead.)
- **Backups:** S3 versioning (step 1) plus your local `../books` copy. You can
  also pull the bucket down any time with `aws s3 sync s3://scribe-sreedhar ./books-backup`.
- **Run the cloud build locally** to test S3 wiring before deploying: put the
  same vars in `.env.local` (see `.env.cloud.example`) and `npm run dev`.
- **Costs stay low** because Amplify's Next.js compute is pay-per-request and S3
  is pennies at this size. Watch the Anthropic bill, not AWS.
- **Prompt caching is on.** The co-writer (`/api/generate`) and canon check
  (`/api/books/[id]/canoncheck`) cache the system prompt + full canon bible, so
  repeated calls within the cache window pay ~10% of the input-token price for
  that (large) prefix. Server logs print a `[cache] ...` line per call showing
  `read`/`write` tokens — a rising `read` count means cache hits are landing.
- **Bedrock vs Anthropic API:** Bedrock is the *same* per-token price, so it's
  not a cost win; the caching above is. The code uses `@anthropic-ai/sdk`; if you
  later want IAM/data-residency, `@anthropic-ai/bedrock-sdk` speaks the same API
  (including the `cache_control` used here), so the switch is small.
