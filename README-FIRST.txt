GENEVIEVE ECOSYSTEM LIVE STATUS V2
GitHub + Vercel ready

THIS IS THE NEXT ZIP AFTER THE MANUAL ONLINE/OFFLINE TEST.

WHAT V2 ADDS
- A real Vercel Function at /api/status.
- The phone dashboard checks that live public endpoint.
- Main Command Centre, Health and Animal status display automatically.
- Refresh button.
- Automatic refresh every 30 seconds.
- If the status function cannot be reached, the dashboard reports OFFLINE.

UPLOAD
1. Open the existing GitHub repository used for the first dashboard.
2. Delete the old repository files OR upload this full package and replace files with the same names.
3. Make sure the api folder and api/status.js are included.
4. Commit to the main branch.
5. Vercel will redeploy from GitHub.

VERCEL SETTINGS
Framework Preset: Other
Root Directory: repository root
Build Command: leave empty
Output Directory: leave empty

DEFAULT STATUS
All three services default to ONLINE after deployment because the public Vercel Function is running.

TEST AN OFFLINE STATUS
In Vercel:
1. Open the project.
2. Settings > Environment Variables.
3. Add one of these variables with the value offline:
   MAIN_COMMAND_STATUS
   HEALTH_STATUS
   ANIMAL_STATUS
4. Apply it to Production.
5. Redeploy.

Change the value to online and redeploy to return the service to ONLINE.

IMPORTANT
This V2 proves that GitHub, Vercel, the public status API and the mobile dashboard work together.
It does not expose the laptop-only Docker services to the public internet.
