output "amplify_app_id" {
  description = "Amplify app id (use with aws amplify start-job)."
  value       = aws_amplify_app.scribe.id
}

output "default_app_url" {
  description = "Default Amplify URL for the deployed branch."
  value       = "https://${aws_amplify_branch.cloud.branch_name}.${aws_amplify_app.scribe.default_domain}"
}

output "custom_domain_url" {
  description = "Your custom URL once DNS is live (enable_domain = true)."
  value       = var.enable_domain ? "https://${var.subdomain_prefix}.${var.domain_name}" : null
}

output "s3_bucket" {
  description = "Bucket that holds your books."
  value       = aws_s3_bucket.books.bucket
}

output "start_build_command" {
  description = "Run this after apply to trigger the first deploy."
  value       = "aws amplify start-job --app-id ${aws_amplify_app.scribe.id} --branch-name ${aws_amplify_branch.cloud.branch_name} --job-type RELEASE --region ${var.aws_region}"
}

# When enable_domain = true, these tell you exactly which DNS records to add
# at GoDaddy (only needed if you are NOT delegating to Route 53).
output "domain_dns_records" {
  description = "DNS records to create at GoDaddy (empty until enable_domain = true; not needed when manage_dns_in_route53 = true)."
  value = var.enable_domain ? {
    certificate_verification = aws_amplify_domain_association.domain[0].certificate_verification_dns_record
    subdomains               = aws_amplify_domain_association.domain[0].sub_domain
  } : null
}

# Route 53 option: set these four values as the domain's nameservers at GoDaddy.
output "route53_nameservers" {
  description = "Nameservers to set at GoDaddy when manage_dns_in_route53 = true."
  value       = var.manage_dns_in_route53 ? aws_route53_zone.primary[0].name_servers : null
}
