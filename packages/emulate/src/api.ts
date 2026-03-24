import { createServer, type AppKeyResolver, type AuthFallback, type Store } from "@internal/core";
import { vercelPlugin, seedFromConfig as seedVercel, type VercelSeedConfig } from "@internal/vercel";
import { githubPlugin, seedFromConfig as seedGitHub, getGitHubStore, type GitHubSeedConfig } from "@internal/github";
import { googlePlugin, seedFromConfig as seedGoogle, type GoogleSeedConfig } from "@internal/google";
import { glossgeniusPlugin, seedFromConfig as seedGlossgenius, type GlossgeniusSeedConfig } from "@internal/glossgenius";
import { acuityPlugin, seedFromConfig as seedAcuity, type AcuitySeedConfig } from "@internal/acuity";
import { vagaroPlugin, seedFromConfig as seedVagaro, type VagaroSeedConfig } from "@internal/vagaro";
import { mindbodyPlugin, seedFromConfig as seedMindbody, type MindbodySeedConfig } from "@internal/mindbody";
import { squarePlugin, seedFromConfig as seedSquare, type SquareSeedConfig } from "@internal/square";
import { serve } from "@hono/node-server";

const SERVICE_PLUGINS = {
  vercel: vercelPlugin,
  github: githubPlugin,
  google: googlePlugin,
  glossgenius: glossgeniusPlugin,
  acuity: acuityPlugin,
  vagaro: vagaroPlugin,
  mindbody: mindbodyPlugin,
  square: squarePlugin,
} as const;

export type ServiceName = keyof typeof SERVICE_PLUGINS;

export interface SeedConfig {
  tokens?: Record<string, { login: string; scopes?: string[] }>;
  vercel?: VercelSeedConfig;
  github?: GitHubSeedConfig;
  google?: GoogleSeedConfig;
  glossgenius?: GlossgeniusSeedConfig;
  acuity?: AcuitySeedConfig;
  vagaro?: VagaroSeedConfig;
  mindbody?: MindbodySeedConfig;
  square?: SquareSeedConfig;
}

export interface EmulatorOptions {
  service: ServiceName;
  port?: number;
  seed?: SeedConfig;
}

export interface Emulator {
  url: string;
  reset(): void;
  close(): Promise<void>;
}

export async function createEmulator(options: EmulatorOptions): Promise<Emulator> {
  const { service, port = 4000, seed: seedConfig } = options;

  const plugin = SERVICE_PLUGINS[service];
  if (!plugin) {
    throw new Error(`Unknown service: ${service}`);
  }

  const tokens: Record<string, { login: string; id: number; scopes?: string[] }> = {};
  if (seedConfig?.tokens) {
    let tokenId = 100;
    for (const [token, user] of Object.entries(seedConfig.tokens)) {
      tokens[token] = { login: user.login, id: tokenId++, scopes: user.scopes };
    }
  } else {
    tokens["gho_test_token_admin"] = { login: "admin", id: 2, scopes: ["repo", "user", "admin:org", "admin:repo_hook"] };
  }

  const baseUrl = `http://localhost:${port}`;

  let serverStore: Store | undefined;
  const appKeyResolver: AppKeyResolver | undefined =
    service === "github"
      ? (appId: number) => {
          try {
            const gh = getGitHubStore(serverStore!);
            const ghApp = gh.apps.all().find((a) => a.app_id === appId);
            if (!ghApp) return null;
            return { privateKey: ghApp.private_key, slug: ghApp.slug, name: ghApp.name };
          } catch {
            return null;
          }
        }
      : undefined;

  let fallbackUser: AuthFallback | undefined;
  if (service === "vercel") {
    const firstLogin = seedConfig?.vercel?.users?.[0]?.username ?? "admin";
    fallbackUser = { login: firstLogin, id: 1, scopes: [] };
  } else if (service === "github") {
    const firstLogin = seedConfig?.github?.users?.[0]?.login ?? "admin";
    fallbackUser = { login: firstLogin, id: 1, scopes: ["repo", "user", "admin:org", "admin:repo_hook"] };
  } else if (service === "google") {
    const firstEmail = seedConfig?.google?.users?.[0]?.email ?? "testuser@gmail.com";
    fallbackUser = { login: firstEmail, id: 1, scopes: ["openid", "email", "profile"] };
  } else if (service === "glossgenius") {
    const firstBusiness = seedConfig?.glossgenius?.businesses?.[0]?.slug ?? "test-salon";
    fallbackUser = { login: firstBusiness, id: 1, scopes: ["appointments:read"] };
  } else if (service === "acuity") {
    const firstEmail = seedConfig?.acuity?.owners?.[0]?.email ?? "owner@example.com";
    fallbackUser = { login: firstEmail, id: 1, scopes: ["api-v1"] };
  } else if (service === "square") {
    const firstMerchant = seedConfig?.square?.merchants?.[0]?.name ?? "Test Business";
    fallbackUser = { login: firstMerchant, id: 1, scopes: ["appointments:read", "customers:read", "catalog:read"] };
  }

  const { app, store } = createServer(plugin, { port, baseUrl, tokens, appKeyResolver, fallbackUser });
  serverStore = store;

  const seed = () => {
    plugin.seed?.(store, baseUrl);
    if (service === "vercel" && seedConfig?.vercel) seedVercel(store, baseUrl, seedConfig.vercel);
    if (service === "github" && seedConfig?.github) seedGitHub(store, baseUrl, seedConfig.github);
    if (service === "google" && seedConfig?.google) seedGoogle(store, baseUrl, seedConfig.google);
    if (service === "glossgenius" && seedConfig?.glossgenius) seedGlossgenius(store, baseUrl, seedConfig.glossgenius);
    if (service === "acuity" && seedConfig?.acuity) seedAcuity(store, baseUrl, seedConfig.acuity);
    if (service === "vagaro" && seedConfig?.vagaro) seedVagaro(store, baseUrl, seedConfig.vagaro);
    if (service === "mindbody" && seedConfig?.mindbody) seedMindbody(store, baseUrl, seedConfig.mindbody);
    if (service === "square" && seedConfig?.square) seedSquare(store, baseUrl, seedConfig.square);
  };
  seed();

  const httpServer = serve({ fetch: app.fetch, port });

  return {
    url: baseUrl,
    reset() {
      store.reset();
      seed();
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        httpServer.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
