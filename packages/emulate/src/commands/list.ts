const SERVICE_DESCRIPTIONS: Record<string, { label: string; endpoints: string }> = {
  vercel: {
    label: "Vercel REST API emulator",
    endpoints: "projects, deployments, domains, env vars, users, teams, file uploads, protection bypass",
  },
  github: {
    label: "GitHub REST API emulator",
    endpoints: "users, repos, issues, PRs, comments, reviews, labels, milestones, branches, git data, orgs, teams, releases, webhooks, search, actions, checks, rate limit",
  },
  google: {
    label: "Google OAuth 2.0 / OpenID Connect emulator",
    endpoints: "OAuth authorize, token exchange, userinfo, OIDC discovery, token revocation",
  },
  glossgenius: {
    label: "GlossGenius appointments and public booking API emulator",
    endpoints: "appointments, available times, portfolio images, reviews",
  },
  acuity: {
    label: "Acuity Scheduling OAuth and appointments API emulator",
    endpoints: "OAuth authorize/token, owner profile, appointment types, calendars, availability, appointments, payments",
  },
  vagaro: {
    label: "Vagaro scheduling API emulator",
    endpoints: "client credentials auth, services, appointments, availability, employees, locations, customers, personal tasks",
  },
  mindbody: {
    label: "Mindbody Public API v6 emulator",
    endpoints: "user token issue/renew, site details, session types, programs, locations, bookable items, appointments, clients",
  },
  square: {
    label: "Square Bookings and OAuth API emulator",
    endpoints: "OAuth authorize/token/revoke, bookings, availability, catalog, team members, customers, locations, merchants",
  },
};

export function listCommand(): void {
  console.log("\nAvailable services:\n");
  const maxNameLen = Math.max(...Object.keys(SERVICE_DESCRIPTIONS).map((name) => name.length));
  for (const [name, info] of Object.entries(SERVICE_DESCRIPTIONS)) {
    console.log(`  ${name.padEnd(maxNameLen + 2)}${info.label}`);
    console.log(`            Endpoints: ${info.endpoints}`);
    console.log();
  }
}
