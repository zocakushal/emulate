import { parseJsonBody, type RouteContext } from "@internal/core";
import { envelope, formatPersonalTask, generateId, requireBusiness } from "../helpers.js";
import { getVagaroStore } from "../store.js";

export function personalTasksRoutes({ app, store }: RouteContext): void {
  const vs = getVagaroStore(store);

  app.post("/:region/api/v2/personal-tasks", async (c) => {
    const region = c.req.param("region");
    const business = requireBusiness(c, store, region);
    if (business instanceof Response) return business;

    const body = await parseJsonBody(c);
    const action = typeof body.action === "string" ? body.action : "create";
    const personalTimeOffId = typeof body.personalTimeOffId === "string" ? body.personalTimeOffId : generateId("PTO");

    let task = vs.personalTasks.findOneBy("personal_time_off_id", personalTimeOffId);

    if (action === "delete") {
      if (task) {
        vs.personalTasks.delete(task.id);
      }
      return c.json(envelope({
        personalTimeOffId,
        status: "success",
        message: "Personal task operation completed",
      }));
    }

    if (!task) {
      task = vs.personalTasks.insert({
        business_id: business.business_id,
        personal_time_off_id: personalTimeOffId,
        subject: typeof body.subject === "string" ? body.subject : "Personal Task",
        description: typeof body.description === "string" ? body.description : "",
        start_date: typeof body.startDate === "string" ? body.startDate : new Date().toISOString(),
        end_date: typeof body.endDate === "string" ? body.endDate : new Date(Date.now() + 30 * 60_000).toISOString(),
        service_provider_id: typeof body.serviceProviderId === "string" ? body.serviceProviderId : "",
      });
    } else {
      task = vs.personalTasks.update(task.id, {
        subject: typeof body.subject === "string" ? body.subject : task.subject,
        description: typeof body.description === "string" ? body.description : task.description,
        start_date: typeof body.startDate === "string" ? body.startDate : task.start_date,
        end_date: typeof body.endDate === "string" ? body.endDate : task.end_date,
        service_provider_id:
          typeof body.serviceProviderId === "string" ? body.serviceProviderId : task.service_provider_id,
      })!;
    }

    return c.json(envelope(formatPersonalTask(task)));
  });
}
