import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  CustomDropdown,
  CustomDropdownItem,
} from "@/components/ui/custom-dropdown";
import { useCRMCustomers } from "@/hooks/useCRMCustomers";
import { parseCsvParam, parseDateParam, toCsvParam } from "@/lib/activityUtils";
import {
  Calendar as CalendarIcon,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const STATUS_OPTIONS = ["success", "failed", "pending", "warning"] as const;
const ACTOR_OPTIONS = ["user", "automation", "integration", "system"] as const;
const SOURCE_OPTIONS = ["ui", "automation", "webhook", "sync"] as const;

function updateParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value === null || value === "") params.delete(key);
  else params.set(key, value);
}

export interface ActivityFiltersBarProps {
  className?: string;
}

export function ActivityFiltersBar({ className }: ActivityFiltersBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const customerId = searchParams.get("customer");
  const search = searchParams.get("q") ?? "";
  const status = parseCsvParam(searchParams.get("status"));
  const actor = parseCsvParam(searchParams.get("actor"));
  const source = parseCsvParam(searchParams.get("source"));
  const type = parseCsvParam(searchParams.get("type"));
  const segment = parseCsvParam(searchParams.get("segment"));
  const persona = parseCsvParam(searchParams.get("persona"));
  const end = parseDateParam(searchParams.get("end"));
  const group = searchParams.get("group") ?? "campaign";

  const [groupOpen, setGroupOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  useEffect(() => {
    // Date range support was removed in favor of a single cutoff date.
    // If an old URL/view still has `start`, drop it to avoid confusing behavior.
    if (!searchParams.get("start")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("start");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    customers,
    setSearchTerm,
    searchTerm,
    loading: customersLoading,
  } = useCRMCustomers();

  const [customerOpen, setCustomerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [newTypeInput, setNewTypeInput] = useState("");
  const [typeSearch, setTypeSearch] = useState("");
  const [activityTypeOptions, setActivityTypeOptions] = useState<string[]>([]);
  const [activityTypesLoading, setActivityTypesLoading] = useState(false);
  const [activityTypesError, setActivityTypesError] = useState<string | null>(
    null,
  );
  const [activityTypesFetchNonce, setActivityTypesFetchNonce] = useState(0);
  const activityTypesReqIdRef = useRef(0);

  const setParams = (updater: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next, { replace: true });
  };

  const toggleCsv = (key: string, value: string) => {
    setParams((p) => {
      const existing = parseCsvParam(p.get(key));
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      updateParam(p, key, toCsvParam(next));
    });
  };

  const removeCsv = (key: string, value: string) => {
    setParams((p) => {
      const existing = parseCsvParam(p.get(key));
      updateParam(p, key, toCsvParam(existing.filter((v) => v !== value)));
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function loadActivityTypes() {
      if (!moreFiltersOpen) return;
      if (activityTypeOptions.length) return;
      if (activityTypesLoading) return;

      setActivityTypesError(null);
      setActivityTypesLoading(true);
      const reqId = ++activityTypesReqIdRef.current;

      const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
        let timer: any;
        const timeout = new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), ms);
        });
        try {
          return await Promise.race([promise, timeout]);
        } finally {
          clearTimeout(timer);
        }
      };

      // Prefer the same RPC the feed uses (more likely to work with RLS/tenant scoping).
      let data: any = null;
      let error: any = null;
      try {
        const rpcResult = await withTimeout(
          supabase.rpc("get_activity_feed", {
            p_customer_id: null,
            p_limit: 300,
            p_offset: 0,
            p_search: null,
            p_status: null,
            p_actor_types: null,
            p_sources: null,
            p_activity_types: null,
            p_start: null,
            p_end: null,
            p_segment_ids: null,
            p_persona_ids: null,
          }),
          8000,
        );

        data = (rpcResult as any)?.data;
        error = (rpcResult as any)?.error;

        if (error) {
          const fallback = await withTimeout(
            supabase
              .from("crm_activity_events")
              .select("activity_type")
              .order("timestamp", { ascending: false })
              .limit(500),
            8000,
          );
          data = (fallback as any)?.data;
          error = (fallback as any)?.error;
        }

        if (cancelled) return;
        if (activityTypesReqIdRef.current !== reqId) return;

        if (error) {
          console.warn(
            "[ActivityFiltersBar] Failed to load activity types",
            error,
          );
          setActivityTypesError(
            String((error as any)?.message ?? "Failed to load"),
          );
          return;
        }

        const unique = new Set<string>();
        for (const row of data ?? []) {
          const value = String((row as any)?.activity_type ?? "").trim();
          if (value) unique.add(value);
        }
        setActivityTypeOptions(
          Array.from(unique).sort((a, b) => a.localeCompare(b)),
        );
      } catch (e: any) {
        if (cancelled) return;
        if (activityTypesReqIdRef.current !== reqId) return;
        const msg = String(e?.message ?? e ?? "Failed to load");
        setActivityTypesError(
          msg === "timeout" ? "Timed out loading activity types." : msg,
        );
      } finally {
        if (cancelled) return;
        if (activityTypesReqIdRef.current !== reqId) return;
        setActivityTypesLoading(false);
      }
    }

    loadActivityTypes();
    return () => {
      cancelled = true;
    };
  }, [
    activityTypeOptions.length,
    activityTypesFetchNonce,
    activityTypesLoading,
    moreFiltersOpen,
  ]);

  const activeCount =
    (customerId ? 1 : 0) +
    (search ? 1 : 0) +
    status.length +
    actor.length +
    source.length +
    type.length +
    segment.length +
    persona.length +
    (end ? 1 : 0);

  const cutoffLabel = useMemo(() => {
    if (!end) return null;
    return end.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [end]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="font-medium">Filters</div>
          {activeCount ? (
            <Badge variant="secondary">{activeCount}</Badge>
          ) : null}
        </div>

        <div className="flex-1 min-w-[240px]">
          <Input
            value={search}
            placeholder="Search (title or customer)…"
            onChange={(e) => {
              const value = e.target.value;
              setParams((p) => updateParam(p, "q", value || null));
            }}
          />
        </div>

        <CustomDropdown
          open={groupOpen}
          onOpenChange={setGroupOpen}
          align="start"
          trigger={(props) => (
            <Button {...props} variant="outline" size="sm" className="h-9">
              Group: {group === "campaign" ? "Campaign" : "None"}
            </Button>
          )}
        >
          <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
            Grouping
          </div>
          <CustomDropdownItem
            onSelect={() => {
              setGroupOpen(false);
              setParams((p) => updateParam(p, "group", "campaign"));
            }}
            className={cn(group === "campaign" && "bg-muted/60")}
          >
            By campaign
          </CustomDropdownItem>
          <CustomDropdownItem
            onSelect={() => {
              setGroupOpen(false);
              setParams((p) => updateParam(p, "group", "none"));
            }}
            className={cn(group === "none" && "bg-muted/60")}
          >
            None
          </CustomDropdownItem>
        </CustomDropdown>

        <CustomDropdown
          open={moreFiltersOpen}
          onOpenChange={setMoreFiltersOpen}
          align="start"
          contentClassName="w-[340px]"
          trigger={(props) => (
            <Button
              {...props}
              variant="outline"
              size="sm"
              className="h-9 gap-2"
            >
              <Filter className="h-4 w-4" />
              Add filters
            </Button>
          )}
        >
          <div className="px-2 py-2 text-xs font-medium text-muted-foreground">
            Quick filters
          </div>

          <div className="px-2 py-1">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => {
                const checked = status.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleCsv("status", s)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      checked
                        ? "border-brand-teal bg-brand-teal/10 text-foreground"
                        : "bg-background hover:bg-muted/40",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-2 py-1">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Actor
            </div>
            <div className="flex flex-wrap gap-2">
              {ACTOR_OPTIONS.map((a) => {
                const checked = actor.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleCsv("actor", a)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      checked
                        ? "border-brand-teal bg-brand-teal/10 text-foreground"
                        : "bg-background hover:bg-muted/40",
                    )}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-2 py-1">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Source
            </div>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((s) => {
                const checked = source.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleCsv("source", s)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      checked
                        ? "border-brand-teal bg-brand-teal/10 text-foreground"
                        : "bg-background hover:bg-muted/40",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-2 py-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Activity type
            </div>

            <div className="mb-2">
              <Input
                value={typeSearch}
                placeholder="Search activity types…"
                onChange={(e) => setTypeSearch(e.target.value)}
                className="h-8"
              />
            </div>

            <div className="max-h-44 overflow-auto rounded-lg border bg-background p-2">
              {activityTypesLoading ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  Loading activity types…
                </div>
              ) : null}

              {!activityTypesLoading && activityTypesError ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  <div className="mb-2">{activityTypesError}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setActivityTypeOptions([]);
                      setActivityTypesFetchNonce((n) => n + 1);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {!activityTypesLoading &&
              !activityTypesError &&
              activityTypeOptions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">
                  No activity types found.
                </div>
              ) : null}

              {!activityTypesLoading
                ? activityTypeOptions
                    .filter((t) => {
                      const q = typeSearch.trim().toLowerCase();
                      if (!q) return true;
                      return t.toLowerCase().includes(q);
                    })
                    .slice(0, 100)
                    .map((t) => {
                      const checked = type.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={cn(
                            "w-full text-left rounded-md px-2 py-1.5 text-xs",
                            "hover:bg-muted/40",
                            checked && "bg-brand-teal/10 text-foreground",
                          )}
                          onClick={() => toggleCsv("type", t)}
                        >
                          {t}
                        </button>
                      );
                    })
                : null}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Input
                value={newTypeInput}
                placeholder="Add custom type…"
                onChange={(e) => setNewTypeInput(e.target.value)}
                className="h-8"
              />
              <Button
                size="sm"
                className="h-8"
                onClick={() => {
                  const next = newTypeInput.trim();
                  if (!next) return;
                  if (type.includes(next)) return;
                  setParams((p) =>
                    updateParam(p, "type", toCsvParam([...type, next])),
                  );
                  setNewTypeInput("");
                }}
              >
                Add
              </Button>
            </div>

            {type.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {type.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => removeCsv("type", t)}
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </CustomDropdown>

        <CustomDropdown
          open={customerOpen}
          onOpenChange={setCustomerOpen}
          align="start"
          contentClassName="w-[360px] p-0"
          trigger={(props) => (
            <Button {...props} variant="outline" size="sm" className="h-9">
              {customerId ? "Customer: selected" : "Customer"}
            </Button>
          )}
        >
          <Command>
            <CommandInput
              placeholder="Search customers…"
              value={searchTerm}
              onValueChange={(v) => setSearchTerm(v)}
            />
            <CommandList>
              <CommandEmpty>
                {customersLoading ? "Loading…" : "No customers found"}
              </CommandEmpty>
              <CommandGroup heading="Customers">
                {customers.slice(0, 20).map((c) => {
                  const label =
                    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
                    c.email;
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        setParams((p) => updateParam(p, "customer", c.id));
                        setCustomerOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.email}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {customerId ? (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() =>
                  setParams((p) => updateParam(p, "customer", null))
                }
              >
                Clear customer
              </Button>
            </div>
          ) : null}
        </CustomDropdown>

        <CustomDropdown
          open={dateOpen}
          onOpenChange={setDateOpen}
          align="end"
          contentClassName="w-[420px] max-w-[calc(100vw-16px)] p-3 overflow-hidden"
          trigger={(props) => (
            <Button
              {...props}
              variant="outline"
              size="sm"
              className="h-9 gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {end ? `Before ${cutoffLabel}` : "Date"}
            </Button>
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Before (inclusive)</div>
              <div className="text-xs text-muted-foreground truncate">
                {cutoffLabel
                  ? `Selected: ${cutoffLabel}`
                  : "No cutoff selected"}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  const d = new Date();
                  d.setHours(23, 59, 59, 999);
                  setParams((p) => {
                    updateParam(p, "start", null);
                    updateParam(p, "end", d.toISOString());
                  });
                  setDateOpen(false);
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={!end}
                onClick={() => {
                  setParams((p) => {
                    updateParam(p, "start", null);
                    updateParam(p, "end", null);
                  });
                  setDateOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-xl border bg-background p-2 overflow-hidden">
            <Calendar
              mode="single"
              className="w-full p-0"
              classNames={{
                months: "w-full flex flex-col space-y-0",
                month: "w-full space-y-4",
                caption: "flex w-full items-center justify-between pt-1",
                caption_label: "text-sm font-medium",
                nav: "flex items-center gap-1",
                nav_button_previous: "",
                nav_button_next: "",
                // react-day-picker v9 layout keys (rdp-weekdays / rdp-week / etc)
                month_grid: "w-full",
                weekdays: "grid w-full grid-cols-7 gap-1",
                weekday:
                  "text-muted-foreground rounded-md font-normal text-[0.8rem] text-center",
                weeks: "grid gap-1",
                week: "grid w-full grid-cols-7 gap-1",
                day: "p-0",
                day_button:
                  "h-9 w-full rounded-md p-0 font-normal aria-selected:opacity-100",

                // Legacy keys (safe to keep; ignored by v9)
                table: "w-full table-fixed border-collapse",
                head_row: "grid w-full grid-cols-7 gap-1",
                row: "grid w-full grid-cols-7 gap-1 mt-2",
                head_cell:
                  "text-muted-foreground rounded-md font-normal text-[0.8rem] text-center",
                cell: "h-9 w-full text-center text-sm p-0 relative",
              }}
              selected={end ?? undefined}
              onSelect={(d) => {
                setParams((p) => {
                  updateParam(p, "start", null);
                  if (!d) {
                    updateParam(p, "end", null);
                    return;
                  }
                  const inclusiveEnd = new Date(d);
                  inclusiveEnd.setHours(23, 59, 59, 999);
                  updateParam(p, "end", inclusiveEnd.toISOString());
                });
                setDateOpen(false);
              }}
              initialFocus
            />
          </div>
        </CustomDropdown>

        {activeCount ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-2"
            onClick={() => {
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
          >
            <X className="h-4 w-4" />
            Clear all
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {customerId ? (
          <Badge variant="outline" className="inline-flex items-center gap-1">
            customer
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setParams((p) => updateParam(p, "customer", null))}
              aria-label="Clear customer"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {search ? (
          <Badge variant="outline" className="inline-flex items-center gap-1">
            q
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setParams((p) => updateParam(p, "q", null))}
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {status.map((s) => (
          <Badge
            key={`status:${s}`}
            variant="outline"
            className="inline-flex items-center gap-1"
          >
            status:{s}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => removeCsv("status", s)}
              aria-label={`Remove status ${s}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {actor.map((a) => (
          <Badge
            key={`actor:${a}`}
            variant="outline"
            className="inline-flex items-center gap-1"
          >
            actor:{a}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => removeCsv("actor", a)}
              aria-label={`Remove actor ${a}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {source.map((s) => (
          <Badge
            key={`source:${s}`}
            variant="outline"
            className="inline-flex items-center gap-1"
          >
            source:{s}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => removeCsv("source", s)}
              aria-label={`Remove source ${s}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {type.map((t) => (
          <Badge
            key={`type:${t}`}
            variant="outline"
            className="inline-flex items-center gap-1"
          >
            type:{t}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => removeCsv("type", t)}
              aria-label={`Remove type ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {segment.length ? (
          <Badge variant="outline" className="inline-flex items-center gap-1">
            segments:{segment.length}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setParams((p) => updateParam(p, "segment", null))}
              aria-label="Clear segments"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {persona.length ? (
          <Badge variant="outline" className="inline-flex items-center gap-1">
            personas:{persona.length}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => setParams((p) => updateParam(p, "persona", null))}
              aria-label="Clear personas"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        {end ? (
          <Badge variant="outline" className="inline-flex items-center gap-1">
            before:{cutoffLabel}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() =>
                setParams((p) => {
                  updateParam(p, "start", null);
                  updateParam(p, "end", null);
                })
              }
              aria-label="Clear cutoff date"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
