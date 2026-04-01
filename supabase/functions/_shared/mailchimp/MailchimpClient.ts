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

export class MailchimpTimeoutError extends Error {
  readonly path: string;
  readonly timeoutMs: number;

  constructor(path: string, timeoutMs: number) {
    super(`Mailchimp request timed out after ${timeoutMs}ms at ${path}`);
    this.name = "MailchimpTimeoutError";
    this.path = path;
    this.timeoutMs = timeoutMs;
  }
}

export class MailchimpClient {
  private static readonly DEFAULT_DC = "us1";
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_RETRY_DELAY_MS = 1000;
  private static readonly REQUEST_TIMEOUT_MS = 15000;

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

  private static isRetryableStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  private static isRetryableTransportError(error: unknown): boolean {
    return (
      error instanceof TypeError ||
      error instanceof DOMException ||
      error instanceof MailchimpTimeoutError
    );
  }

  private static getRetryDelayMs(attempt: number, retryAfterSeconds?: number) {
    if (
      typeof retryAfterSeconds === "number" &&
      Number.isFinite(retryAfterSeconds) &&
      retryAfterSeconds > 0
    ) {
      return retryAfterSeconds * 1000;
    }

    return Math.min(8000, MailchimpClient.BASE_RETRY_DELAY_MS * 2 ** attempt);
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MailchimpClient.MAX_RETRIES; attempt += 1) {
      const timeoutController = new AbortController();
      let timedOut = false;
      let abortedByCaller = false;
      const timeoutId = globalThis.setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, MailchimpClient.REQUEST_TIMEOUT_MS);

      const abortFromParent = () => {
        abortedByCaller = true;
        timeoutController.abort();
      };

      if (options.signal) {
        if (options.signal.aborted) {
          abortedByCaller = true;
          timeoutController.abort();
        } else {
          options.signal.addEventListener("abort", abortFromParent, {
            once: true,
          });
        }
      }

      try {
        const response = await fetch(url, {
          ...options,
          signal: timeoutController.signal,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
          },
        });

        if (!response.ok) {
          const body = await response.text();
          const requestError = new MailchimpRequestError(
            response.status,
            path,
            body,
          );

          if (
            MailchimpClient.isRetryableStatus(response.status) &&
            attempt < MailchimpClient.MAX_RETRIES - 1
          ) {
            const retryAfter = Number.parseInt(
              response.headers.get("Retry-After") ?? "",
              10,
            );
            const retryDelayMs = MailchimpClient.getRetryDelayMs(
              attempt,
              Number.isFinite(retryAfter) ? retryAfter : undefined,
            );
            lastError = requestError;
            console.warn(
              `[MailchimpClient] Retryable Mailchimp error ${response.status} at ${path}. Retrying in ${retryDelayMs}ms.`,
            );
            await new Promise((resolve) =>
              globalThis.setTimeout(resolve, retryDelayMs),
            );
            continue;
          }

          throw requestError;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = timedOut
          ? new MailchimpTimeoutError(path, MailchimpClient.REQUEST_TIMEOUT_MS)
          : error instanceof Error
            ? error
            : new Error(String(error));

        if (error instanceof MailchimpRequestError) {
          throw error;
        }

        if (abortedByCaller) {
          throw lastError;
        }

        if (
          !MailchimpClient.isRetryableTransportError(lastError) ||
          attempt === MailchimpClient.MAX_RETRIES - 1
        ) {
          throw lastError;
        }

        const retryDelayMs = MailchimpClient.getRetryDelayMs(attempt);
        console.warn(
          `[MailchimpClient] Retryable transport error at ${path}. Retrying in ${retryDelayMs}ms.`,
        );
        await new Promise((resolve) =>
          globalThis.setTimeout(resolve, retryDelayMs),
        );
      } finally {
        globalThis.clearTimeout(timeoutId);
        if (options.signal) {
          options.signal.removeEventListener("abort", abortFromParent);
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
