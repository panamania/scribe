# Terraform — Cinderwake Scribe on AWS (Amplify + S3)

Provisions everything the cloud build needs: an S3 bucket, the IAM role the SSR
compute uses to reach it, the Amplify app + `cloud` branch, and (optionally) the
custom domain. See `../architecture.svg` for the component picture.

## Prerequisites

1. **Terraform** ≥ 1.5 and **AWS CLI**, both on PATH.
2. **AWS credentials** with permission to create S3/IAM/Amplify resources.
   `aws sts get-caller-identity` should succeed. (Prefer an IAM admin user over
   root credentials.)
3. A **GitHub classic PAT** with `repo` scope (github.com/settings/tokens) so
   Amplify can connect the repo and create its build webhook.
4. Your **Anthropic API key** and a **login password** you choose.

## Deploy

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # then edit it
terraform init
terraform plan
terraform apply
```

Trigger the first build (Amplify builds on push after this, but the first one is
manual). Terraform prints the exact command as the `start_build_command` output:

```bash
aws amplify start-job --app-id <APP_ID> --branch-name cloud --job-type RELEASE --region us-east-1
```

Upload your existing books to the new bucket (from the app root, one level up):

```bash
cd ../..
S3_BUCKET=<bucket> AWS_REGION=us-east-1 BOOKS_DIR=../books npm run seed:s3
```

Open the `default_app_url` output — it should prompt for your login and load
your library from S3.

## Custom domain

When ready, set `enable_domain = true` (and `domain_name`) in `terraform.tfvars`,
then `terraform apply` again. Read the `domain_dns_records` output and create those
records at your DNS provider (a CNAME to verify the ACM cert, plus the subdomain
records). Validation + propagation take 15–60 min. If your DNS is on Route 53,
you can extend this config with `aws_route53_record` resources to automate it.

## Notes

- **Secrets:** `terraform.tfvars` and the **state file** contain your key and
  password. `.gitignore` excludes tfvars and local state. For team use, switch to
  an encrypted remote backend (e.g. an S3 backend with a DynamoDB lock).
- **No AWS keys in env:** S3 access is via the Amplify service role, not access
  keys — see the comment in `main.tf`.
- **Teardown:** `terraform destroy`. The S3 bucket must be emptied first (it holds
  your manuscripts — back them up: `aws s3 sync s3://<bucket> ./books-backup`).
