GENEVIEVE V3 — 404 REPAIR

This repair removes the missing /api/status dependency.

UPLOAD THESE THREE FILES TO THE ROOT OF THE EXISTING GITHUB REPOSITORY:
- app.js
- status.json
- service-worker.js

Choose Add file > Upload files in GitHub.
Upload the three extracted files, not this ZIP.
Commit changes.
Vercel should redeploy automatically.

After Vercel finishes:
1. Open the dashboard.
2. Refresh the page.
3. It should show ALL ONLINE.
4. Deployment test should say:
   Vercel deployment status responded successfully.

This confirms the public GitHub/Vercel dashboard deployment.
It does not expose or test laptop-only Docker services.
