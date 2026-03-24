import { parseJsonBody, type RouteContext } from "@internal/core";
import type { MindbodyClient } from "../entities.js";
import {
  formatClient,
  guessCardType,
  pagination,
  requireSite,
} from "../helpers.js";
import { getMindbodyStore } from "../store.js";

function matchesSearch(client: MindbodyClient, query: string): boolean {
  const normalized = query.toLowerCase();
  return [
    client.email ?? "",
    client.mobile_phone ?? "",
    client.first_name,
    client.last_name,
    `${client.first_name} ${client.last_name}`,
  ].some((value) => value.toLowerCase().includes(normalized));
}

export function clientRoutes({ app, store }: RouteContext): void {
  const ms = getMindbodyStore(store);

  app.get("/public/v6/client/clients", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const searchText = c.req.query("SearchText") ?? "";
    const clients = ms.clients
      .all()
      .filter((client) => client.site_id === auth.site.site_id)
      .filter((client) => !searchText || matchesSearch(client, searchText))
      .map(formatClient);

    return c.json({
      PaginationResponse: pagination(clients.length),
      Clients: clients,
    });
  });

  app.get("/public/v6/client/clientcompleteinfo", (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const clientId = c.req.query("ClientId") ?? "";
    const client = ms.clients
      .all()
      .find((item) => item.site_id === auth.site.site_id && item.client_id === clientId);

    if (!client) {
      return c.json({ Error: { Message: "Client not found", Code: "404" } }, 404);
    }
    return c.json({ Client: formatClient(client) });
  });

  app.post("/public/v6/client/addclient", async (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody(c);
    const card = body.ClientCreditCard as Record<string, unknown> | undefined;
    const cardNumber = typeof card?.CardNumber === "string" ? card.CardNumber : "";
    const client = ms.clients.insert({
      site_id: auth.site.site_id,
      client_id: String(100000000 + ms.clients.count() + 1),
      unique_id: 10000 + ms.clients.count() + 1,
      first_name: typeof body.FirstName === "string" ? body.FirstName : "Client",
      last_name: typeof body.LastName === "string" ? body.LastName : "User",
      email: typeof body.Email === "string" ? body.Email : null,
      mobile_phone: typeof body.MobilePhone === "string" ? body.MobilePhone : null,
      home_phone: typeof body.HomePhone === "string" ? body.HomePhone : null,
      work_phone: null,
      address_line_1: typeof body.AddressLine1 === "string" ? body.AddressLine1 : null,
      address_line_2: typeof body.AddressLine2 === "string" ? body.AddressLine2 : null,
      city: typeof body.City === "string" ? body.City : null,
      state: typeof body.State === "string" ? body.State : null,
      postal_code: typeof body.PostalCode === "string" ? body.PostalCode : null,
      country: typeof body.Country === "string" ? body.Country : "US",
      birth_date: typeof body.BirthDate === "string" ? body.BirthDate : null,
      gender: typeof body.Gender === "string" ? body.Gender : null,
      is_prospect: false,
      status: "Active",
      creation_date: new Date().toISOString(),
      card_last_four: cardNumber ? cardNumber.slice(-4) : null,
      card_type: cardNumber ? guessCardType(cardNumber) : null,
    });

    return c.json({ Client: formatClient(client) });
  });

  app.post("/public/v6/client/updateclient", async (c) => {
    const auth = requireSite(c, store, true);
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody(c);
    const clientPayload = (body.Client ?? {}) as Record<string, unknown>;
    const clientId = typeof clientPayload.Id === "string" ? clientPayload.Id : "";
    const client = ms.clients
      .all()
      .find((item) => item.site_id === auth.site.site_id && item.client_id === clientId);
    if (!client) {
      return c.json({ Error: { Message: "Client not found", Code: "404" } }, 404);
    }

    const card = clientPayload.ClientCreditCard as Record<string, unknown> | undefined;
    const cardNumber = typeof card?.CardNumber === "string" ? card.CardNumber : "";
    const updated = ms.clients.update(client.id, {
      card_last_four: cardNumber ? cardNumber.slice(-4) : client.card_last_four,
      card_type: cardNumber ? guessCardType(cardNumber) : client.card_type,
    })!;

    return c.json({ Client: formatClient(updated) });
  });
}
