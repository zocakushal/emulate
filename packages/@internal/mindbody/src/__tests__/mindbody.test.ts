import { beforeEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { Store, WebhookDispatcher } from "@internal/core";
import { getMindbodyStore } from "../store.js";
import { mindbodyPlugin } from "../index.js";

const base = "http://localhost:4000";
const siteHeaders = {
  "Api-Key": "test-api-key",
  SiteId: "123456",
};

function createTestApp() {
  const store = new Store();
  const webhooks = new WebhookDispatcher();
  const app = new Hono();
  mindbodyPlugin.register(app as any, store, webhooks, base, new Map());
  mindbodyPlugin.seed?.(store, base);
  return { app, store };
}

describe("Mindbody plugin integration", () => {
  let app: Hono;
  let token: string;

  beforeEach(() => {
    const ctx = createTestApp();
    app = ctx.app;
    token = getMindbodyStore(ctx.store).userTokens.all()[0]!.access_token;
  });

  it("issues and renews user tokens", async () => {
    const issueRes = await app.request(`${base}/public/v6/usertoken/issue`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(issueRes.status).toBe(200);
    const issueBody = (await issueRes.json()) as { AccessToken: string };
    expect(issueBody.AccessToken).toBeTruthy();

    const renewRes = await app.request(`${base}/public/v6/usertoken/renew`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        Authorization: `Bearer ${issueBody.AccessToken}`,
      },
    });
    expect(renewRes.status).toBe(200);
    const renewBody = (await renewRes.json()) as { AccessToken: string };
    expect(renewBody.AccessToken).toBeTruthy();
    expect(renewBody.AccessToken).not.toBe(issueBody.AccessToken);
  });

  it("returns site, session type, program, and location data", async () => {
    const auth = {
      ...siteHeaders,
      Authorization: `Bearer ${token}`,
    };

    const sitesRes = await app.request(`${base}/public/v6/site/sites?siteIds=123456`, {
      headers: auth,
    });
    expect(sitesRes.status).toBe(200);
    const sitesBody = (await sitesRes.json()) as { Sites: Array<{ Name: string }> };
    expect(sitesBody.Sites[0]?.Name).toBe("Test Studio");

    const sessionTypesRes = await app.request(`${base}/public/v6/site/sessiontypes?ProgramIds=1`, {
      headers: auth,
    });
    expect(sessionTypesRes.status).toBe(200);
    const sessionTypesBody = (await sessionTypesRes.json()) as { SessionTypes: Array<{ Name: string }> };
    expect(sessionTypesBody.SessionTypes[0]?.Name).toBe("Haircut");

    const programsRes = await app.request(`${base}/public/v6/site/programs?ScheduleType=Appointment`, {
      headers: auth,
    });
    expect(programsRes.status).toBe(200);
    const programsBody = (await programsRes.json()) as { Programs: Array<{ Name: string }> };
    expect(programsBody.Programs[0]?.Name).toBe("Hair Services");

    const locationsRes = await app.request(`${base}/public/v6/site/locations`, {
      headers: auth,
    });
    expect(locationsRes.status).toBe(200);
    const locationsBody = (await locationsRes.json()) as { Locations: Array<{ Name: string }> };
    expect(locationsBody.Locations[0]?.Name).toBe("Main Location");
  });

  it("returns bookable items and staff appointments", async () => {
    const auth = {
      ...siteHeaders,
      Authorization: `Bearer ${token}`,
    };

    const bookableRes = await app.request(
      `${base}/public/v6/appointment/bookableitems?locationIds=1&sessionTypeIds=5001`,
      {
        headers: auth,
      }
    );
    expect(bookableRes.status).toBe(200);
    const bookableBody = (await bookableRes.json()) as {
      Availabilities: Array<{ Location: { Name: string } | null }>;
    };
    expect(bookableBody.Availabilities.length).toBeGreaterThan(0);
    expect(bookableBody.Availabilities[0]?.Location?.Name).toBe("Main Location");

    const staffAppointmentsRes = await app.request(
      `${base}/public/v6/appointment/staffappointments?locationId=1&clientId=100012345&startDate=2026-01-01`,
      {
        headers: auth,
      }
    );
    expect(staffAppointmentsRes.status).toBe(200);
    const staffAppointmentsBody = (await staffAppointmentsRes.json()) as {
      Appointments: Array<{ ClientId: string }>;
    };
    expect(staffAppointmentsBody.Appointments[0]?.ClientId).toBe("100012345");
  });

  it("creates and updates appointments", async () => {
    const createRes = await app.request(`${base}/public/v6/appointment/addappointment`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ClientId: "100012345",
        LocationId: 1,
        SessionTypeId: 5001,
        StaffId: 100000001,
        StartDateTime: "2026-05-01T10:00:00.000Z",
      }),
    });
    expect(createRes.status).toBe(200);
    const createBody = (await createRes.json()) as { Appointment: { Id: number; ClientId: string } };
    expect(createBody.Appointment.ClientId).toBe("100012345");

    const updateRes = await app.request(`${base}/public/v6/appointment/updateappointment`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        AppointmentId: createBody.Appointment.Id,
        Execute: "cancel",
        StartDateTime: "2026-05-02T11:00:00.000Z",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateBody = (await updateRes.json()) as {
      Appointment: { Status: string; StartDateTime: string };
    };
    expect(updateBody.Appointment.Status).toBe("Cancelled");
    expect(updateBody.Appointment.StartDateTime).toBe("2026-05-02T11:00:00.000Z");
  });

  it("lists, fetches, creates, and updates clients", async () => {
    const auth = {
      ...siteHeaders,
      Authorization: `Bearer ${token}`,
    };

    const clientsRes = await app.request(`${base}/public/v6/client/clients?SearchText=John`, {
      headers: auth,
    });
    expect(clientsRes.status).toBe(200);
    const clientsBody = (await clientsRes.json()) as { Clients: Array<{ Id: string; FirstName: string }> };
    expect(clientsBody.Clients[0]?.FirstName).toBe("John");

    const completeInfoRes = await app.request(`${base}/public/v6/client/clientcompleteinfo?ClientId=100012345`, {
      headers: auth,
    });
    expect(completeInfoRes.status).toBe(200);
    const completeInfoBody = (await completeInfoRes.json()) as { Client: { Id: string; Email: string } };
    expect(completeInfoBody.Client.Id).toBe("100012345");
    expect(completeInfoBody.Client.Email).toBe("john@example.com");

    const addClientRes = await app.request(`${base}/public/v6/client/addclient`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        FirstName: "Jane",
        LastName: "Roe",
        Email: "jane.roe@example.com",
        MobilePhone: "+15557654321",
        ClientCreditCard: {
          CardNumber: "4111111111111111",
        },
      }),
    });
    expect(addClientRes.status).toBe(200);
    const addClientBody = (await addClientRes.json()) as {
      Client: { Id: string; FirstName: string; ClientCreditCard?: { LastFour: string } };
    };
    expect(addClientBody.Client.FirstName).toBe("Jane");
    expect(addClientBody.Client.ClientCreditCard?.LastFour).toBe("1111");

    const updateClientRes = await app.request(`${base}/public/v6/client/updateclient`, {
      method: "POST",
      headers: {
        ...siteHeaders,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Client: {
          Id: addClientBody.Client.Id,
          ClientCreditCard: {
            CardNumber: "5555555555554444",
          },
        },
      }),
    });
    expect(updateClientRes.status).toBe(200);
    const updateClientBody = (await updateClientRes.json()) as {
      Client: { ClientCreditCard?: { CardType: string; LastFour: string } };
    };
    expect(updateClientBody.Client.ClientCreditCard?.CardType).toBe("MasterCard");
    expect(updateClientBody.Client.ClientCreditCard?.LastFour).toBe("4444");
  });
});
