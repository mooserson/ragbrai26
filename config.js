// Edit after deploying the Worker. Wrangler prints this URL after `wrangler deploy`.
// e.g. "https://ragbrai-stats.<your-subdomain>.workers.dev"
window.RAGBRAI_CONFIG = {
  STATS_API: "https://ragbrai-stats.pmcathey.workers.dev",
  // Donorbox campaign URL — set once the charity (Chicago youth-bike org) is
  // locked in. Until then the Donate button shows a "coming soon" state.
  DONATE_URL: null,
};
