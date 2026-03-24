import { parseJsonBody, type RouteContext } from "@internal/core";
import { formatTeamMember, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

export function teamMembersRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.post("/v2/team-members/search", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const body = await parseJsonBody(c);
    const query = (body.query ?? {}) as Record<string, unknown>;
    const filter = ((query.filter ?? query.filter) ?? {}) as Record<string, unknown>;
    const status = typeof filter.status === "string" ? filter.status : undefined;

    const teamMembers = ss.teamMembers
      .all()
      .filter((member) => member.merchant_id === merchant.merchant_id)
      .filter((member) => !status || member.status === status)
      .map(formatTeamMember);

    return c.json({ team_members: teamMembers });
  });

  app.get("/v2/team-members/:id", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const member = ss.teamMembers
      .all()
      .find((item) => item.merchant_id === merchant.merchant_id && item.team_member_id === c.req.param("id"));
    if (!member) {
      return c.json({ errors: [{ code: "NOT_FOUND", detail: "Team member not found" }] }, 404);
    }
    return c.json({ team_member: formatTeamMember(member) });
  });
}
