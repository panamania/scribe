terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# S3 — durable storage for books, canon, covers, and app settings.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "books" {
  bucket = var.s3_bucket_name
}

resource "aws_s3_bucket_versioning" "books" {
  bucket = aws_s3_bucket.books.id
  versioning_configuration {
    status = "Enabled" # recover overwritten/deleted chapters
  }
}

resource "aws_s3_bucket_public_access_block" "books" {
  bucket                  = aws_s3_bucket.books.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "books" {
  bucket = aws_s3_bucket.books.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------------------------
# IAM — the role Amplify's SSR compute assumes at runtime to reach S3.
#
# We attach S3 permissions to the Amplify service role rather than passing
# access keys as env vars: the SSR functions run on Lambda, where
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION are RESERVED and
# injected from the execution role — user keys placed in env would be ignored.
# The AWS SDK in lib/storage.js picks up these role credentials automatically.
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "amplify_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["amplify.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "amplify" {
  name               = "${var.app_name}-amplify-role"
  assume_role_policy = data.aws_iam_policy_document.amplify_assume.json
}

data "aws_iam_policy_document" "s3_access" {
  statement {
    sid       = "ListBucket"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.books.arn]
  }
  statement {
    sid       = "ObjectReadWrite"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.books.arn}/*"]
  }
}

resource "aws_iam_role_policy" "s3_access" {
  name   = "s3-access"
  role   = aws_iam_role.amplify.id
  policy = data.aws_iam_policy_document.s3_access.json
}

# Let Amplify write build/runtime logs to CloudWatch.
resource "aws_iam_role_policy_attachment" "amplify_logs" {
  role       = aws_iam_role.amplify.name
  policy_arn = "arn:aws:iam::aws:policy/AWSAmplifyAdminAccess"
}

# ---------------------------------------------------------------------------
# Amplify Hosting — builds the Next.js app from GitHub and runs it as SSR
# (CloudFront in front, Lambda compute behind), with automatic TLS.
# ---------------------------------------------------------------------------
resource "aws_amplify_app" "scribe" {
  name                 = var.app_name
  repository           = var.repository_url
  access_token         = var.github_access_token
  platform             = "WEB_COMPUTE" # Next.js SSR
  iam_service_role_arn = aws_iam_role.amplify.arn

  build_spec = file("${path.module}/../../amplify.yml")

  # Runtime + build environment. NOTE: no AWS_* credentials here on purpose —
  # the SSR compute uses the iam_service_role_arn above.
  environment_variables = {
    STORAGE       = "s3"
    S3_BUCKET     = aws_s3_bucket.books.bucket
    ANTHROPIC_API_KEY = var.anthropic_api_key
    SCRIBE_MODEL  = var.scribe_model
    SITE_USER     = var.site_user
    SITE_PASSWORD = var.site_password
    # Ensure a Next.js 15-compatible Node during Amplify builds.
    _CUSTOM_IMAGE = "amplify:al2023"
  }
}

resource "aws_amplify_branch" "cloud" {
  app_id            = aws_amplify_app.scribe.id
  branch_name       = var.branch_name
  framework         = "Next.js - SSR"
  stage             = "PRODUCTION"
  enable_auto_build = true # rebuild on every push to this branch
}

# ---------------------------------------------------------------------------
# Optional: host the domain's DNS in Route 53. When this hosted zone is in the
# same AWS account as the Amplify app, Amplify automatically writes the ACM
# validation + routing records (including the apex ALIAS that GoDaddy can't do)
# into it. You then point GoDaddy's nameservers at this zone (see outputs).
# ---------------------------------------------------------------------------
resource "aws_route53_zone" "primary" {
  count = var.manage_dns_in_route53 ? 1 : 0
  name  = var.domain_name
}

# ---------------------------------------------------------------------------
# Custom domain (optional). Enable once you're ready to point DNS.
# Amplify provisions a free ACM cert; you add the DNS records it outputs.
# ---------------------------------------------------------------------------
resource "aws_amplify_domain_association" "domain" {
  count                 = var.enable_domain ? 1 : 0
  app_id                = aws_amplify_app.scribe.id
  domain_name           = var.domain_name
  wait_for_verification = false

  # e.g. scribe.sreedharpanaman.com — a subdomain needs only a simple CNAME at
  # GoDaddy (no apex ALIAS limitation to work around).
  sub_domain {
    branch_name = aws_amplify_branch.cloud.branch_name
    prefix      = var.subdomain_prefix
  }
}
