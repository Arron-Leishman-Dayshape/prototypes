/* Prototypes hub config — edit these and redeploy */
window.PROTOTYPES_CONFIG = {
  siteName: 'High Volume Prototypes',
  siteTagline: 'Click a mock, share the link, leave feedback.',

  // Internal-only access for hub + feedback threads.
  // Share mock URLs with reviewers (no key). Share the hub with ?key=… only to your team.
  // Change this anytime to revoke old hub links.
  internalAccessKey: 'hv-internal-7k9m2xq4',

  // Shared feedback store (free Supabase). Feedback is stored per prototype — no email.
  supabaseUrl: 'https://eruyowhibdrnfpnbjwos.supabase.co',
  supabaseAnonKey: 'sb_publishable_ZTFQX_SAjjRV7WkDmCCCzQ_hsWX0wvj',

  // Optional: Microsoft Clarity project ID for heatmaps + session replay
  // https://clarity.microsoft.com
  clarityId: '',

  feedbackIntro: 'What’s working, what’s confusing, what’s missing?',
};
