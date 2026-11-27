# NecroOps AWS read-only integration: infrastructure preparation

**Status: infrastructure template prepared; AWS account deployment and application adapter are not yet completed.**

The current NecroOps production app remains a local-fixture simulator. This stack only prepares a narrowly scoped AWS identity for a future read-only integration. It does not connect the app by itself and does not change any AWS workload.

## Security design

- Vercel team-scoped OIDC federation; no AWS access key or secret key is stored in Vercel.
- Trust is restricted to Vercel team `itsok33220-9416s-projects`, project `necro-ops`, and the `production` deployment environment.
- The IAM role grants inventory/metadata reads for EC2, S3 bucket metadata, CloudWatch metrics/alarms, Lambda inventory, and RDS inventory.
- No `Create`, `Put`, `Update`, `Delete`, `Terminate`, `Stop`, or other resource-mutation actions are granted.
- S3 permissions do not include object listing or object reads.
- Lambda permissions do not include function-code download or environment-variable configuration reads.
- Cost Explorer permissions are intentionally omitted from this first role. Add them only after reviewing API pricing and the exact cost-data requirement.

The role is not a blanket AWS read-only policy. It is deliberately limited to the services NecroOps can inspect in its first integration phase.

## Prerequisites

1. Finish AWS registration and wait until the AWS account is activated. The AWS signup page previously shown indicated that account registration/activation was still incomplete.
2. Register and verify root-account MFA. Use a passkey/security key where available.
3. Sign in to the AWS Console using the account owner/admin identity.
4. In Vercel, open the `necro-ops` project, then **Settings → Security → Secure backend access with OIDC federation**. Enable OIDC and select **Team issuer mode**. The issuer must be:
   `https://oidc.vercel.com/itsok33220-9416s-projects`

Do not create root access keys or paste any AWS credentials into GitHub, this chat, browser code, or Vercel environment variables.

## Create the AWS identity from the Console

1. Open the AWS CloudFormation console: https://console.aws.amazon.com/cloudformation/
2. Choose **Create stack → With new resources (standard)**.
3. Choose **Upload a template file** and upload `infra/aws/vercel-readonly-role.yaml` from this repository branch.
4. On the stack details page, use stack name `NecroOpsVercelReadOnly`.
5. Review the resources and IAM changes. The stack creates one OIDC provider and one IAM role with the policy shown above.
6. Submit the stack and wait for **CREATE_COMPLETE**.
7. Open the stack's **Outputs** tab and copy `NecroOpsAwsRoleArn`. The role ARN is an identifier, not a password.

The template has no EC2, S3, Lambda, RDS, or other billable compute/storage resource creation. AWS account usage and API pricing can still depend on the services later queried; review pricing before enabling live polling.

## Vercel configuration (after the application adapter is merged)

The Vercel project is `necro-ops` under team `itsok33220-9416s-projects`.

After the AWS adapter code has been implemented and reviewed, add these server-only project environment variables:

- `AWS_ROLE_ARN`: the `NecroOpsAwsRoleArn` output from CloudFormation.
- `AWS_REGION`: the AWS region to use for regional inventory API clients (the Console was last showing `eu-north-1`).

Start with **Production only**. Do not add `AWS_ROLE_ARN` until the application adapter is deployed; the current production source does not call AWS APIs.

## Validation checklist

- [ ] AWS registration complete and account activation confirmed.
- [ ] Root MFA enabled.
- [ ] Vercel OIDC enabled in Team issuer mode.
- [ ] CloudFormation stack status is `CREATE_COMPLETE`.
- [ ] Trust policy is limited to the exact Vercel team/project/production subject.
- [ ] Vercel `AWS_ROLE_ARN` added server-side after application support is deployed.
- [ ] Live AWS identity check succeeds using temporary OIDC-derived credentials.
- [ ] EC2/S3/CloudWatch/Lambda/RDS inventory endpoints return live account data.
- [ ] Negative tests confirm AWS write actions are denied.
- [ ] Production UI clearly distinguishes live AWS observations from local fixtures.

Until these checks pass, the dashboard must continue to display the local-fixture/no-AWS-connected status. Do not describe the application as AWS-connected merely because the IAM role exists.
