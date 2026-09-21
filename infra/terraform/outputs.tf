output "amplify_app_id" {
  description = "Amplify app id (use with aws amplify start-job)."
  value       = aws_amplify_app.scribe.id
}

output "default_app_url" {
  description = "Default Amplify URL for the deployed branch."
  value       = "https://${aws_amplify_branch.cloud.branch_name}.${aws_amplify_app.scribe.default_domain}"
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
# at your domain's DNS provider to validate the cert and route traffic.
output "domain_dns_records" {
  description = "DNS records to create for the custom domain (empty until enable_domain = true)."
  value = var.enable_domain ? {
    certificate_verification = aws_amplify_domain_association.domain[0].certificate_verification_dns_record
    subdomains               = aws_amplify_domain_association.domain[0].sub_domain
  } : null
}
