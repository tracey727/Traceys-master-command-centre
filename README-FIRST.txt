GENEVIEVE App™ — ECOSYSTEM ONE V1.26.0
PROFESSIONAL VERCEL-READY FICTIONAL PILOT

THIS PACKAGE IS READY FOR GITHUB + VERCEL

WHAT IS INCLUDED
- Professional GENEVIEVE App™ interface using the official locked GA asset.
- Main Command Centre V1.24 status and governance authority.
- Genevieve Health V1.25.4 protected branch.
- Genevieve Animal V1.25.6 protected branch.
- Controlled Bridge V1.25.9 with deny-by-default rules.
- Exact-preview preparation and mandatory human approval.
- Signed preparation token and SHA-256 preview hash verification.
- Health-to-Animal, Animal-to-Health and shared-facility pilot journeys.
- Security rejection suite.
- Four linked tamper-evident audit chains per governed run.
- Phone PWA manifest and Home Screen icon.

IMPORTANT SCOPE
This is the Vercel conversion of the private fictional-data pilot interface and
server-side governance workflow. It does not use real human or animal records.
It does not contact emergency services or emergency contacts. Dog Park remains
separate and excluded.

DEPLOY TO THE EXISTING GITHUB REPOSITORY
1. Unzip this package.
2. Open the existing GitHub repository.
3. Remove the old dashboard test files from the repository.
4. Upload ALL extracted contents from this package to the repository root.
   The api folder must be visible at the repository root.
5. Commit the changes.
6. Vercel will redeploy automatically if the repository is already connected.

VERCEL SETTINGS
- Framework Preset: Other
- Root Directory: repository root
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: leave default

AFTER DEPLOYMENT
Open:
  https://YOUR-VERCEL-ADDRESS.vercel.app

Check the API directly:
  https://YOUR-VERCEL-ADDRESS.vercel.app/api/status

The API should return JSON containing:
  "product": "GENEVIEVE App™"
  "ecosystem": "Ecosystem One"

OPTIONAL PRIVATE SECRET
In Vercel Settings > Environment Variables, add:
  GENEVIEVE_PILOT_HMAC_SECRET
Use a long random private value. The package has a fictional-pilot fallback so
it deploys without this, but the environment variable is preferred.

OPTIONAL OFFLINE TESTS
Set any variable below to offline, redeploy, and that component will show offline:
  GENEVIEVE_MAIN_STATUS
  GENEVIEVE_HEALTH_STATUS
  GENEVIEVE_ANIMAL_STATUS
  GENEVIEVE_BRIDGE_STATUS

PERSISTENCE NOTE
Vercel Functions may restart or scale. The dashboard keeps recent complete runs
and audit trails in the phone/browser local storage. Warm Vercel function
instances also retain recent runs temporarily. Permanent multi-user production
persistence requires a managed database and production authentication before
real records are considered.
