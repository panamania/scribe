# Connecting scribe.sreedharpanaman.com (DNS at GoDaddy)

The app is served on the **subdomain** `scribe.sreedharpanaman.com`. Because it's
a subdomain (not the bare root), GoDaddy just needs two **CNAME** records — none
of the apex/ALIAS limitations apply. Keep your DNS at GoDaddy; do **not** delegate
nameservers (that would move your email/MX and everything else to AWS too).

## Step 1 — Attach the domain in AWS

In `infra/terraform/terraform.tfvars` set:

```hcl
enable_domain         = true
domain_name           = "sreedharpanaman.com"
subdomain_prefix      = "scribe"
manage_dns_in_route53 = false      # keep DNS at GoDaddy
```

Then:

```bash
terraform apply
terraform output domain_dns_records
```

Amplify creates a free ACM certificate and returns the two records to add. The
output looks like this (your hostnames/targets will differ):

```
certificate_verification = "_a1b2c3....sreedharpanaman.com CNAME _x9y8z7....acm-validations.aws"
subdomains = [
  { dns_record = "scribe.sreedharpanaman.com CNAME d123abc456xyz.cloudfront.net", prefix = "scribe", verified = false }
]
```

Each value is `NAME  TYPE  VALUE`.

## Step 2 — Add the two CNAMEs at GoDaddy

GoDaddy → **My Products** → your domain → **DNS** (Manage DNS) → **Add** a record
for each of the two below. **GoDaddy's "Name" is relative to the domain**, so drop
`.sreedharpanaman.com` from the name. Drop any trailing dot from the value.

| # | Type  | Name (host)                     | Value (points to)                          | TTL   |
|---|-------|---------------------------------|--------------------------------------------|-------|
| 1 | CNAME | `_a1b2c3…`  *(cert record name, minus the domain)* | `_x9y8z7….acm-validations.aws` | 1 Hour |
| 2 | CNAME | `scribe`                        | `d123abc456xyz.cloudfront.net` *(from the subdomains output)* | 1 Hour |

- **Record 1** proves you own the domain so ACM can issue the SSL cert.
- **Record 2** points `scribe.` at the Amplify/CloudFront distribution.

If GoDaddy already has a record named `scribe`, edit/replace it. Leave all your
other records (root `@`, `www`, MX/email, etc.) untouched.

## Step 3 — Wait, then verify

Cert validation + propagation usually take 10–30 min (up to a few hours). Check:

```bash
nslookup -type=cname scribe.sreedharpanaman.com
```

It should resolve to the `*.cloudfront.net` target. In the Amplify console the
domain shows **Available** when done. Then open:

```
https://scribe.sreedharpanaman.com
```

You'll get the login prompt and your library over HTTPS.

---

## Alternative — let AWS manage DNS (Route 53)

Only worth it if you want AWS to manage all of this domain's DNS (or need the apex
too). It moves DNS off GoDaddy:

1. Set `manage_dns_in_route53 = true` and `enable_domain = true`; `terraform apply`.
2. `terraform output route53_nameservers` → four `ns-….awsdns-….` values.
3. **First recreate any existing GoDaddy records** (especially MX/email) in the new
   Route 53 zone, or they'll stop working.
4. GoDaddy → domain → **Nameservers** → **Change** → **Enter my own nameservers** →
   paste the four values → Save.

Amplify then auto-creates the validation + routing records in Route 53 (no manual
CNAMEs). Nameserver changes can take up to 24–48h to propagate.
