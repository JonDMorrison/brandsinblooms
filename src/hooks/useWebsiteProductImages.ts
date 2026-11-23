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

/**
 * Product photos from the tenant's connected website, through the
 * authenticated connected-content function (the same catalog the
 * "Add from website" picker uses). Only products with an image are returned.
 */
export function useWebsiteProductImages(search: string, enabled: boolean) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  return useQuery({
    queryKey: ["website-product-images", tenantId, search],
    enabled: enabled && Boolean(tenantId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<WebsiteProductImage[]> => {
      const data = await connectedContentRequest<ConnectedContentResponse>({
        action: "catalog",
        type: "products",
        q: search,
        limit: 24,
      });
      return data.items
        .filter((item) => Boolean(item.imageUrl))
        .map((item) => ({
          id: item.id,
          title: stripProductSizeSuffix(item.title),
          altText: item.title,
          imageUrl: item.imageUrl as string,
        }));
    },
  });
}
