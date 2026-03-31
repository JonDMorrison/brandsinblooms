import { decryptToken } from "../crypto/tokens.ts";
import type {
  MailchimpConnectionCredentials,
  MailchimpList,
  MailchimpListsResponse,
  MailchimpMember,
  MailchimpMembersResponse,
  MailchimpSegment,
  MailchimpSegmentsResponse,
} from "./types.ts";

export class MailchimpRequestError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(status: number, path: string, body: string) {
    super(`Mailchimp API error ${status} at ${path}: ${body}`);
    this.name = "MailchimpRequestError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class MailchimpClient {
  private static readonly DEFAULT_DC = "us1";
  private static readonly MAX_RETRIES = 3;

  private constructor(
    private readonly accessToken: string,
    private readonly baseUrl: string,
  ) {}

  static async fromConnection(
    conn: MailchimpConnectionCredentials,
    decrypt: typeof decryptToken = decryptToken,
  ): Promise<MailchimpClient> {
    const accessToken = await decrypt(conn.encrypted_access_token);
    const dc = MailchimpClient.extractDc(conn.metadata);
    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
    return new MailchimpClient(accessToken, baseUrl);
  }

  private static extractDc(
    metadata: MailchimpConnectionCredentials["metadata"],
  ): string {
    if (typeof metadata?.dc === "string" && metadata.dc.trim().length > 0) {
      return metadata.dc;
    }

    if (typeof metadata?.api_endpoint === "string") {
      const match = metadata.api_endpoint.match(
        /https:\/\/([^.]+)\.api\.mailchimp/i,
      );
      if (match?.[1]) {
        return match[1];
      }
    }

    console.warn(
      "[MailchimpClient] Could not determine DC from metadata, defaulting to us1",
    );
    return MailchimpClient.DEFAULT_DC;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MailchimpClient.MAX_RETRIES; attempt += 1) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
          },
        });

        if (response.status === 429) {
          const retryAfter = Number.parseInt(
            response.headers.get("Retry-After") ?? "60",
            10,
          );
          const retryDelaySeconds = Number.isFinite(retryAfter)
            ? retryAfter
            : 60;
          lastError = new Error(
            `Mailchimp API rate limited at ${path}. Retry-After=${retryDelaySeconds}s`,
          );
          console.warn(
            `[MailchimpClient] Rate limited. Retrying after ${retryDelaySeconds}s.`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelaySeconds * 1000),
          );
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new MailchimpRequestError(response.status, path, body);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof MailchimpRequestError) {
          throw error;
        }

        if (attempt === MailchimpClient.MAX_RETRIES - 1) {
          throw lastError;
        }
      }
    }

    throw (
      lastError ??
      new Error(
        `Mailchimp request failed after ${MailchimpClient.MAX_RETRIES} retries`,
      )
    );
  }

  async getLists(): Promise<MailchimpList[]> {
    const all: MailchimpList[] = [];
    let offset = 0;
    const count = 100;

    while (true) {
      const data = await this.request<MailchimpListsResponse>(
        `/lists?count=${count}&offset=${offset}&fields=lists.id,lists.name,lists.stats.member_count,total_items`,
      );
      all.push(...data.lists);

      if (all.length >= data.total_items || data.lists.length < count) {
        break;
      }

      offset += count;
    }

    return all;
  }

  async getList(listId: string): Promise<MailchimpList> {
    return await this.request<MailchimpList>(`/lists/${listId}`);
  }

  async getSegments(listId: string): Promise<MailchimpSegment[]> {
    const all: MailchimpSegment[] = [];
    let offset = 0;
    const count = 100;

    while (true) {
      const data = await this.request<MailchimpSegmentsResponse>(
        `/lists/${listId}/segments?count=${count}&offset=${offset}&fields=segments.id,segments.name,segments.member_count,segments.type,total_items`,
      );
      all.push(...data.segments);

      if (all.length >= data.total_items || data.segments.length < count) {
        break;
      }

      offset += count;
    }

    return all;
  }

  async getListMembers(
    listId: string,
    offset: number,
    count = 100,
  ): Promise<MailchimpMembersResponse> {
    return await this.request<MailchimpMembersResponse>(
      `/lists/${listId}/members?count=${count}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields,members.tags,members.timestamp_opt,total_items`,
    );
  }

  async getSegmentMembers(
    listId: string,
    segmentId: string,
    offset: number,
    count = 100,
  ): Promise<MailchimpMembersResponse> {
    return await this.request<MailchimpMembersResponse>(
      `/lists/${listId}/segments/${segmentId}/members?count=${count}&offset=${offset}`,
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.request<{ health_status?: string }>("/ping");
      return true;
    } catch {
      return false;
    }
  }
}
