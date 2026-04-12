import type { RouteContext } from "@internal/core";

export function mapsRoutes({ app }: RouteContext): void {
  app.get("/maps/api/place/autocomplete/json", (c) => {
    const input = c.req.query("input");
    if (!input) {
      return c.json({ status: "INVALID_REQUEST", predictions: [] });
    }
    return c.json({
      status: "OK",
      predictions: [
        {
          description: "123 Sample St, San Francisco, CA, USA",
          place_id: "ChIJ_sample_place_id",
          structured_formatting: {
            main_text: "123 Sample St",
            secondary_text: "San Francisco, CA, USA"
          }
        }
      ]
    });
  });

  app.get("/maps/api/place/details/json", (c) => {
    const place_id = c.req.query("place_id");
    if (!place_id) {
      return c.json({ status: "INVALID_REQUEST", result: {} });
    }
    return c.json({
      status: "OK",
      result: {
        place_id,
        name: "Sample Place",
        formatted_address: "123 Sample St, San Francisco, CA 94103, USA",
        geometry: {
          location: { lat: 37.7749, lng: -122.4194 }
        },
        address_components: [
          { long_name: "123", short_name: "123", types: ["street_number"] },
          { long_name: "Sample St", short_name: "Sample St", types: ["route"] },
          { long_name: "San Francisco", short_name: "SF", types: ["locality", "political"] },
          { long_name: "California", short_name: "CA", types: ["administrative_area_level_1", "political"] },
          { long_name: "United States", short_name: "US", types: ["country", "political"] },
          { long_name: "94103", short_name: "94103", types: ["postal_code"] }
        ],
        utc_offset: -480
      }
    });
  });

  app.get("/maps/api/timezone/json", (c) => {
    const location = c.req.query("location");
    if (!location) {
      return c.json({ status: "INVALID_REQUEST" });
    }
    return c.json({
      status: "OK",
      dstOffset: 3600,
      rawOffset: -28800,
      timeZoneId: "America/Los_Angeles",
      timeZoneName: "Pacific Daylight Time"
    });
  });
}
