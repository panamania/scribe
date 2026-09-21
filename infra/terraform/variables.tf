variable "aws_region" {
  description = "AWS region for the bucket and Amplify app."
  type        = string
  default     = "us-east-1"
}

variable "app_name" {
  description = "Name for the Amplify app and related resources."
  type        = string
  default     = "cinderwake-scribe"
}

variable "s3_bucket_name" {
  description = "Globally-unique S3 bucket name for book storage."
  type        = string
}

variable "repository_url" {
  description = "GitHub repository URL to deploy."
  type        = string
  default     = "https://github.com/panamania/scribe"
}

variable "branch_name" {
  description = "Branch Amplify builds and deploys."
  type        = string
  default     = "cloud"
}

variable "github_access_token" {
  description = "GitHub personal access token (classic) with 'repo' scope, so Amplify can connect the repo and create the build webhook."
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for the co-writer. Never committed; lives only in tfvars + Amplify env."
  type        = string
  sensitive   = true
}

variable "scribe_model" {
  description = "Default Claude model id."
  type        = string
  default     = "claude-opus-4-8"
}

variable "site_user" {
  description = "Username for the app's single-password login gate."
  type        = string
  default     = "sridhar"
}

variable "site_password" {
  description = "Password for the app's login gate."
  type        = string
  sensitive   = true
}

variable "enable_domain" {
  description = "Set true to attach the custom domain (adds an ACM cert + DNS records to configure)."
  type        = bool
  default     = false
}

variable "manage_dns_in_route53" {
  description = "Create a Route 53 hosted zone for the domain. When the zone is in the same account as the Amplify app, Amplify AUTO-creates the validation + routing records (including the apex). You then delegate the domain to the output nameservers at GoDaddy. Leave false to keep DNS at GoDaddy and add records by hand."
  type        = bool
  default     = false
}

variable "domain_name" {
  description = "Root domain registered at GoDaddy, e.g. sreedharpanaman.com."
  type        = string
  default     = "sreedharpanaman.com"
}

variable "subdomain_prefix" {
  description = "Subdomain the app is served on, e.g. \"scribe\" -> scribe.sreedharpanaman.com."
  type        = string
  default     = "scribe"
}
