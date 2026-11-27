import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  connectedContentRequest,
  stripProductSizeSuffix,
  type ConnectedContentResponse,
} from "@/lib/connectedContent";

export interface WebsiteProductImage {
  id: string;
  title: string;
  /** Full product title, including any size, for alt text. */
  altText: string;
  imageUrl: string;
}

export interface WebsiteProductImages {
  items: WebsiteProductImage[];
  /** Names of the connected websites that were searched, for empty states. */
  siteNames: string[];
}

/**
 * Product photos from the tenant's connected website, through the
 * authenticated connected-content function (the same catalog the
 * "Add from website" picker uses). Only products with an image are returned.
 * The function does the matching: case-insensitive, partial word, on title,
 * description, category and tags, singular or plural.
 */
export function useWebsiteProductImages(search: string, enabled: boolean) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  return useQuery({
    queryKey: ["website-product-images", tenantId, search],
    enabled: enabled && Boolean(tenantId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WebsiteProductImages> => {
      const data = await connectedContentRequest<ConnectedContentResponse>({
        action: "catalog",
        type: "products",
        q: search,
        // The largest page: products without a photo are dropped below, so
        // a smaller page could hide matches that do have one.
        limit: 50,
      });
      const items = data.items.flatMap((item): WebsiteProductImage[] =>
        item.imageUrl
          ? [{
              id: item.id,
              title: stripProductSizeSuffix(item.title),
              altText: item.title,
              imageUrl: item.imageUrl,
            }]
          : [],
      );
      return {
        items,
        siteNames: data.connections.map((connection) => connection.site_name),
      };
    },
  });
}
