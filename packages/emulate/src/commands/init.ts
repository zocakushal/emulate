import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { stringify as yamlStringify } from "yaml";

interface InitOptions {
  service: string;
}

const defaultVercelConfig = {
  vercel: {
    users: [
      {
        username: "developer",
        name: "Developer",
        email: "dev@example.com",
      },
    ],
    teams: [
      {
        slug: "my-team",
        name: "My Team",
      },
    ],
    projects: [
      {
        name: "my-app",
        team: "my-team",
        framework: "nextjs",
      },
    ],
    integrations: [
      {
        client_id: "oac_example_client_id",
        client_secret: "example_client_secret",
        name: "My Vercel App",
        redirect_uris: ["http://localhost:3000/api/auth/callback/vercel"],
      },
    ],
  },
};

const defaultGithubConfig = {
  github: {
    users: [
      {
        login: "octocat",
        name: "The Octocat",
        email: "octocat@github.com",
        bio: "I am the Octocat",
        company: "GitHub",
        location: "San Francisco",
      },
    ],
    orgs: [
      {
        login: "my-org",
        name: "My Organization",
        description: "A test organization",
      },
    ],
    repos: [
      {
        owner: "octocat",
        name: "hello-world",
        description: "My first repository",
        language: "JavaScript",
        topics: ["hello", "world"],
        auto_init: true,
      },
      {
        owner: "my-org",
        name: "org-repo",
        description: "An organization repository",
        language: "TypeScript",
        auto_init: true,
      },
    ],
    oauth_apps: [
      {
        client_id: "Iv1.example_client_id",
        client_secret: "example_client_secret",
        name: "My App",
        redirect_uris: ["http://localhost:3000/api/auth/callback/github"],
      },
    ],
  },
};

const defaultGoogleConfig = {
  google: {
    users: [
      {
        email: "testuser@example.com",
        name: "Test User",
        picture: "https://lh3.googleusercontent.com/a/default-user",
        email_verified: true,
      },
    ],
    oauth_clients: [
      {
        client_id: "example-client-id.apps.googleusercontent.com",
        client_secret: "GOCSPX-example_secret",
        redirect_uris: ["http://localhost:3000/api/auth/callback/google"],
      },
    ],
  },
};

const defaultGlossgeniusConfig = {
  glossgenius: {
    businesses: [
      {
        slug: "test-salon",
        name: "Test Salon",
      },
    ],
    services: [
      {
        name: "Haircut",
        price: "50.00",
        duration: 45,
        business_slug: "test-salon",
      },
    ],
    providers: [
      {
        name: "Jane Doe",
        business_slug: "test-salon",
      },
    ],
    reviews: [
      {
        rating: 5,
        message: "Great service!",
        reviewer_name: "Happy Client",
        business_slug: "test-salon",
      },
    ],
  },
};

const defaultAcuityConfig = {
  acuity: {
    oauth_clients: [
      {
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        redirect_uris: ["http://localhost:3000/callback"],
      },
    ],
    owners: [
      {
        name: "Test Owner",
        email: "owner@example.com",
        currency: "USD",
      },
    ],
    calendars: [
      {
        name: "Main Calendar",
        location: "Downtown Studio",
        timezone: "America/New_York",
      },
    ],
    appointment_types: [
      {
        name: "Consultation",
        duration: 60,
        price: "100.00",
        category: "Services",
      },
    ],
  },
};

const defaultVagaroConfig = {
  vagaro: {
    businesses: [
      {
        business_id: "BIZ001",
        region: "us04",
        client_id: "test-client",
        client_secret: "test-secret",
      },
    ],
    services: [
      {
        name: "Haircut",
        duration: 30,
        price: 40,
        business_id: "BIZ001",
      },
    ],
    employees: [
      {
        name: "Jane Stylist",
        business_id: "BIZ001",
      },
    ],
    locations: [
      {
        name: "Main Salon",
        business_id: "BIZ001",
      },
    ],
  },
};

const defaultMindbodyConfig = {
  mindbody: {
    api_key: "test-api-key",
    sites: [
      {
        site_id: "123456",
        name: "Test Studio",
        email: "studio@example.com",
        currency: "USD",
      },
    ],
    locations: [
      {
        name: "Main Location",
        site_id: "123456",
        address: "123 Main St",
      },
    ],
    session_types: [
      {
        name: "Haircut",
        duration: 30,
        price: 50,
        program_id: 1,
      },
    ],
    clients: [
      {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+15551234567",
      },
    ],
  },
};

const defaultSquareConfig = {
  square: {
    oauth_clients: [
      {
        client_id: "sq0idp-test",
        client_secret: "sq0csp-test",
        redirect_uris: ["http://localhost:3000/callback"],
      },
    ],
    merchants: [
      {
        name: "Test Business",
        currency: "USD",
        country: "US",
      },
    ],
    locations: [
      {
        name: "Main Location",
        address: "123 Main St",
        timezone: "America/New_York",
      },
    ],
    catalog_items: [
      {
        name: "Haircut",
        variations: [
          {
            name: "Standard",
            price: 4000,
            duration: 30,
          },
          {
            name: "Premium",
            price: 6000,
            duration: 45,
          },
        ],
      },
    ],
    team_members: [
      {
        given_name: "Jane",
        family_name: "Stylist",
        status: "ACTIVE",
      },
    ],
    customers: [
      {
        given_name: "John",
        family_name: "Doe",
        email: "john@example.com",
        phone: "+15551234567",
      },
    ],
  },
};

const defaultTokens = {
  tokens: {
    "gho_test_token_admin": {
      login: "admin",
      scopes: ["repo", "user", "admin:org", "admin:repo_hook"],
    },
    "gho_test_token_user1": {
      login: "octocat",
      scopes: ["repo", "user"],
    },
  },
};

const serviceConfigs: Record<string, Record<string, unknown>> = {
  vercel: defaultVercelConfig,
  github: defaultGithubConfig,
  google: defaultGoogleConfig,
  glossgenius: defaultGlossgeniusConfig,
  acuity: defaultAcuityConfig,
  vagaro: defaultVagaroConfig,
  mindbody: defaultMindbodyConfig,
  square: defaultSquareConfig,
};

export function initCommand(options: InitOptions): void {
  const filename = "emulate.config.yaml";
  const fullPath = resolve(filename);

  if (existsSync(fullPath)) {
    console.error(`Config file already exists: ${filename}`);
    process.exit(1);
  }

  let config: Record<string, unknown>;
  if (options.service === "all") {
    config = {
      ...defaultTokens,
      ...defaultVercelConfig,
      ...defaultGithubConfig,
      ...defaultGoogleConfig,
      ...defaultGlossgeniusConfig,
      ...defaultAcuityConfig,
      ...defaultVagaroConfig,
      ...defaultMindbodyConfig,
      ...defaultSquareConfig,
    };
  } else {
    const svcConfig = serviceConfigs[options.service];
    if (!svcConfig) {
      console.error(`Unknown service: ${options.service}. Available: ${Object.keys(serviceConfigs).join(", ")}, all`);
      process.exit(1);
    }
    config = { ...defaultTokens, ...svcConfig };
  }

  const content = yamlStringify(config);
  writeFileSync(fullPath, content, "utf-8");

  console.log(`Created ${filename}`);
  console.log(`\nRun 'emulate' to start the emulator.`);
}
