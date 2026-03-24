import { bodyStr, parseJsonBody, type RouteContext } from "@internal/core";
import { formatItem, formatVariation, requireMerchant } from "../helpers.js";
import { getSquareStore } from "../store.js";

export function catalogRoutes({ app, store }: RouteContext): void {
  const ss = getSquareStore(store);

  app.post("/v2/catalog/search", async (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const body = await parseJsonBody(c);
    const query = (body.query ?? {}) as Record<string, unknown>;
    const textQuery = ((query.text_query ?? query.textQuery) ?? {}) as Record<string, unknown>;
    const keywords = ((textQuery.keywords ?? []) as string[]).map((keyword) => keyword.toLowerCase());

    const objects = ss.catalogItems
      .all()
      .filter((item) => item.merchant_id === merchant.merchant_id)
      .filter((item) => keywords.length === 0 || keywords.some((keyword) => item.name.toLowerCase().includes(keyword)))
      .map((item) =>
        formatItem(
          item,
          item.category_id ? ss.catalogCategories.findOneBy("category_id", item.category_id) : undefined,
          ss.serviceVariations.all().filter((variation) => variation.item_id === item.item_id),
          merchant
        )
      );

    return c.json({ objects });
  });

  app.get("/v2/catalog/list", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const types = (c.req.query("types") ?? "").split(",").filter(Boolean);

    const objects: unknown[] = [];
    if (types.length === 0 || types.includes("CATEGORY")) {
      objects.push(
        ...ss.catalogCategories
          .all()
          .filter((category) => category.merchant_id === merchant.merchant_id)
          .map((category) => ({
            type: "CATEGORY",
            id: category.category_id,
            category_data: { name: category.name },
          }))
      );
    }
    if (types.length === 0 || types.includes("ITEM")) {
      objects.push(
        ...ss.catalogItems
          .all()
          .filter((item) => item.merchant_id === merchant.merchant_id)
          .map((item) =>
            formatItem(
              item,
              item.category_id ? ss.catalogCategories.findOneBy("category_id", item.category_id) : undefined,
              ss.serviceVariations.all().filter((variation) => variation.item_id === item.item_id),
              merchant
            )
          )
      );
    }

    return c.json({ objects });
  });

  app.get("/v2/catalog/object/:id", (c) => {
    const merchant = requireMerchant(c, store);
    if (merchant instanceof Response) return merchant;
    const id = c.req.param("id");

    const item = ss.catalogItems.findOneBy("item_id", id);
    if (item && item.merchant_id === merchant.merchant_id) {
      return c.json({
        object: formatItem(
          item,
          item.category_id ? ss.catalogCategories.findOneBy("category_id", item.category_id) : undefined,
          ss.serviceVariations.all().filter((variation) => variation.item_id === item.item_id),
          merchant
        ),
      });
    }

    const variation = ss.serviceVariations.findOneBy("variation_id", id);
    if (variation && variation.merchant_id === merchant.merchant_id) {
      const parent = ss.catalogItems.findOneBy("item_id", variation.item_id)!;
      return c.json({ object: formatVariation(variation, parent, merchant) });
    }

    return c.json({ errors: [{ code: "NOT_FOUND", detail: "Catalog object not found" }] }, 404);
  });
}
