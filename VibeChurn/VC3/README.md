VIBECHURN — site

Structure:

site/
  orb.html   - main orb interface (formerly Vibe3.html)
  index.html - randomized index of up to 30 projects (reads localStorage for prototype)

Notes:
- This workspace contains a client-side prototype that uses localStorage (key: vibecode_projects_v1) for submissions and scoring.
- For production, migrate storage to a server or Supabase using the provided SQL in the conversation history.
- To run locally, serve the `VC3/site` directory with a static server (e.g., `python -m http.server`) and open `orb.html`.
