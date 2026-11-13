THREADPILOT GEMINI FREE — GITHUB + RENDER UPDATE

1. Extract this ZIP. Upload index.html, server.js, package.json, render.yaml and README.txt into the ROOT of your existing GitHub ThreadPilot repository (replace existing files when prompted). Commit changes.
2. Render > ThreadPilot > Environment > Edit. Add GEMINI_API_KEY with the full API key copied from https://aistudio.google.com/api-keys . Remove OPENAI_API_KEY. Save and deploy.
3. Verify that your Gemini project says Free Tier; DO NOT enable billing or upgrade to a paid tier.
4. After Render says Live, open your existing .onrender.com site. Click Test connection, then send Hello in the chat.
5. To test visual analysis, share the Knit Out window and click Solve Level. Move suggestions are experimental, not a verified solver. Automatic tapping is NOT implemented.

This server uses Gemini 2.5 Flash via REST and no npm dependencies. Free tier has quotas and may be unavailable for some accounts/regions. On quota errors, wait rather than upgrading to paid. Free-tier prompts/images may be used by Google to improve products; avoid sensitive screenshots.

Keep API keys secret. Never upload .env files or API keys to GitHub.
