# Deploying trip-companion

One-time setup, in order. Steps marked **Jay** need the account owner (console clicks,
interactive login or DNS). Everything after step 7 is automatic on push to `main`.

## 1. Firebase project (Jay)

Status 2026-10-05: steps 1.1 to 1.6 done. Firestore `(default)` in us-east1 (Standard),
bucket `techsavvy-dad.firebasestorage.app` in US-EAST1, Google sign-in on, `guam.techsavvy.dad`
authorized, web app `Guam Coastal Circuit` registered.

Status 2026-10-05, later: keyless deploy is set up. Workload identity pool `github-pool` and provider
`github-provider` exist, the `deployer` service account holds the four roles, the Firebase browser key
is restricted to the app's domains and Firebase APIs, `guam.techsavvy.dad` is verified, and the four
repository variables are set with DEPLOY_ENABLED last. Cloud Functions are not deployed yet.

1. Create project `techsavvy-dad` in the Firebase console. Analytics off.
2. Upgrade to Blaze (pay as you go). Done 2026-10-05. Cloud Storage for new projects and scheduled
   functions both require it. Expected cost at family scale: effectively zero, but set a
   budget alert at $5.
3. Firestore: create in production mode, location `us-east1` (permanent; matches the other
   projects). The app's offline cache hides the distance from Guam.
4. Storage: create the default bucket in the same location.
5. Authentication: enable the Google provider. Add `guam.techsavvy.dad` under Authorized domains.
6. Project settings, Your apps: add a Web app. Its config is committed in `.env.production`
   and `.env.development` (public identifiers, not secrets). Project number: 36520514480.

## 2. Hosting site and custom domain (Jay, at GoDaddy)

    firebase login --reauth
    firebase hosting:sites:create guam-techsavvy --project techsavvy-dad

Then Hosting, Add custom domain, `guam.techsavvy.dad`, site `guam-techsavvy`. Firebase shows
a TXT record and A records. Add them in GoDaddy, My Products, techsavvy.dad, DNS. The
GoDaddy "Launching Soon" page on the root domain is not affected.

## 3. Rules and functions, first time (The Beast)

    npm ci && (cd functions && npm install)
    firebase deploy --only firestore:rules,storage,functions --project techsavvy-dad

## 4. Keyless deploy identity (The Beast, gcloud)

Same pattern as chief-os-app's `deploy-hosting.yml`.

    PROJECT=techsavvy-dad
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
    gcloud iam workload-identity-pools create github-pool --project $PROJECT --location global
    gcloud iam workload-identity-pools providers create-oidc github-provider --project $PROJECT \
      --location global --workload-identity-pool github-pool \
      --issuer-uri https://token.actions.githubusercontent.com \
      --attribute-mapping google.subject=assertion.sub,attribute.repository=assertion.repository \
      --attribute-condition "assertion.repository_owner == 'JFontanini'"
    SA=deployer@${PROJECT}.iam.gserviceaccount.com
    gcloud iam service-accounts create deployer --project $PROJECT --display-name "GitHub Actions deployer"
    for ROLE in roles/firebasehosting.admin roles/firebaserules.admin roles/firebasestorage.admin roles/serviceusage.serviceUsageConsumer; do
      gcloud projects add-iam-policy-binding $PROJECT --member "serviceAccount:${SA}" --role $ROLE
    done
    gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT --role roles/iam.workloadIdentityUser \
      --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/JFontanini/trip-companion"

The storage-rules role is the one to confirm on the first CI run; if the deploy step reports
a permission error on the bucket, the message names the missing permission.

## 5. GitHub repository variables (Jay, or Claude with repo settings access)

| Variable | Value |
|---|---|
| `WIF_PROVIDER` | `projects/36520514480/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `DEPLOY_SERVICE_ACCOUNT` | `deployer@techsavvy-dad.iam.gserviceaccount.com` |
| `LIVE_URL` | `https://guam.techsavvy.dad` |
| `DEPLOY_ENABLED` | `true`, last, once everything above is set |

If the Deploy workflow shows the job as skipped, the job condition `vars.DEPLOY_ENABLED == 'true'` did not
match: check the variable is under Variables (not Secrets), named exactly `DEPLOY_ENABLED`, valued exactly `true`.

## 6. First deploy

Run the Deploy workflow from the Actions tab (workflow_dispatch). It builds, deploys hosting
and rules, and fails unless the live site matches the build.

## 7. After that

Push to `main` deploys. `deployed.yml` checks every six hours that live still matches `main`.
Functions changes deploy by hand: `firebase deploy --only functions --project techsavvy-dad`.

## Content-Security-Policy

`firebase.json` ships the CSP as Report-Only, matching jayfontanini.com. After a week with no
violations in the browser console on real devices, rename the header to
`Content-Security-Policy` to enforce it.
