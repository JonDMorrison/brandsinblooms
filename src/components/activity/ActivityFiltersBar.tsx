import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCRMCustomers } from "@/hooks/useCRMCustomers";
import { useAllSegments } from "@/hooks/useAllSegments";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import {
  parseCsvParam,
  parseDateParam,
  toCsvParam,
  isUuid,
} from "@/lib/activityUtils";
import { addActivitySavedView, deleteActivitySavedView, loadActivitySavedViews } from "@/lib/activitySavedViews";
import { Calendar as CalendarIcon, Filter, Layers, Save, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const start = parseDateParam(searchParams.get("start"));
  const end = parseDateParam(searchParams.get("end"));
  const group = searchParams.get("group") ?? "campaign";

  const [savedViews, setSavedViews] = useState(() => {
    if (typeof window === "undefined") return [];
    return loadActivitySavedViews();
  });
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  useEffect(() => {
    // Refresh saved views when the component mounts.
    setSavedViews(loadActivitySavedViews());
  }, []);

  const {
    customers,
    setSearchTerm,
    searchTerm,
    loading: customersLoading,
  } = useCRMCustomers();
  const { segments } = useAllSegments();
  const { personas } = useAllPersonas();

  const uuidSegments = useMemo(
    () => segments.filter((s) => isUuid(String((s as any).id))),
    [segments],
  );
  const uuidPersonas = useMemo(
    () => personas.filter((p) => isUuid(String((p as any).id))),
    [personas],
  );

  const [customerOpen, setCustomerOpen] = useState(false);
  const [segmentsOpen, setSegmentsOpen] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const setParams = (updater: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    updater(next);
    setSearchParams(next, { replace: true });
  };

  const applySavedView = (query: string) => {
    const next = new URLSearchParams(query);
    setSearchParams(next, { replace: true });
  };

  const activeCount =
    (customerId ? 1 : 0) +
    (search ? 1 : 0) +
    status.length +
    actor.length +
    source.length +
    type.length +
    segment.length +
    persona.length +
    (start ? 1 : 0) +
    (end ? 1 : 0);

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Layers className="h-4 w-4" />
              Views
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => {
                setNewViewName("");
                setSaveDialogOpen(true);
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save current view…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setManageDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Manage…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {savedViews.length ? (
              savedViews.slice(0, 10).map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => applySavedView(v.query)}>
                  {v.name}
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">No saved views yet.</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Group: {group === "campaign" ? "Campaign" : "None"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel>Grouping</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={group}
              onValueChange={(value) => setParams((p) => updateParam(p, "group", value || null))}
            >
              <DropdownMenuRadioItem value="campaign">By campaign</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              {customerId ? "Customer: selected" : "Customer"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[340px] p-0">
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
          </PopoverContent>
        </Popover>

        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <CalendarIcon className="h-4 w-4" />
              {start || end ? "Date range" : "Date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3">
            <div className="text-sm font-medium mb-2">Start</div>
            <Calendar
              mode="single"
              selected={start ?? undefined}
              onSelect={(d) =>
                setParams((p) =>
                  updateParam(p, "start", d ? d.toISOString() : null),
                )
              }
              initialFocus
            />
            <div className="text-sm font-medium mt-4 mb-2">End</div>
            <Calendar
              mode="single"
              selected={end ?? undefined}
              onSelect={(d) =>
                setParams((p) =>
                  updateParam(p, "end", d ? d.toISOString() : null),
                )
              }
            />
            {start || end ? (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() =>
                    setParams((p) => {
                      updateParam(p, "start", null);
                      updateParam(p, "end", null);
                    })
                  }
                >
                  Clear dates
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover open={segmentsOpen} onOpenChange={setSegmentsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Segments {segment.length ? `(${segment.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-3">
            <div className="text-sm font-medium mb-2">Segments (UUID only)</div>
            <div className="max-h-64 overflow-auto space-y-2">
              {uuidSegments.map((s: any) => {
                const id = String(s.id);
                const checked = segment.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "w-full text-left rounded-md border p-2 text-sm hover:bg-muted/40",
                      checked && "border-brand-teal",
                    )}
                    onClick={() => {
                      const next = checked
                        ? segment.filter((x) => x !== id)
                        : [...segment, id];
                      setParams((p) =>
                        updateParam(p, "segment", toCsvParam(next)),
                      );
                    }}
                  >
                    <div className="font-medium">{s.name}</div>
                    {s.description ? (
                      <div className="text-xs text-muted-foreground">
                        {s.description}
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {!uuidSegments.length ? (
                <div className="text-sm text-muted-foreground">
                  No UUID segments available.
                </div>
              ) : null}
            </div>
            {segment.length ? (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() =>
                    setParams((p) => updateParam(p, "segment", null))
                  }
                >
                  Clear segments
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        <Popover open={personasOpen} onOpenChange={setPersonasOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Personas {persona.length ? `(${persona.length})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[320px] p-3">
            <div className="text-sm font-medium mb-2">Personas (UUID only)</div>
            <div className="max-h-64 overflow-auto space-y-2">
              {uuidPersonas.map((p: any) => {
                const id = String(p.id);
                const checked = persona.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "w-full text-left rounded-md border p-2 text-sm hover:bg-muted/40",
                      checked && "border-brand-teal",
                    )}
                    onClick={() => {
                      const next = checked
                        ? persona.filter((x) => x !== id)
                        : [...persona, id];
                      setParams((sp) =>
                        updateParam(sp, "persona", toCsvParam(next)),
                      );
                    }}
                  >
                    <div className="font-medium">{p.persona_name}</div>
                    {p.persona_description ? (
                      <div className="text-xs text-muted-foreground">
                        {p.persona_description}
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {!uuidPersonas.length ? (
                <div className="text-sm text-muted-foreground">
                  No UUID personas available.
                </div>
              ) : null}
            </div>
            {persona.length ? (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() =>
                    setParams((p) => updateParam(p, "persona", null))
                  }
                >
                  Clear personas
                </Button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="activity-view-name">Name</Label>
            <Input
              id="activity-view-name"
              value={newViewName}
              placeholder="e.g. Failed automations"
              onChange={(e) => setNewViewName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name = newViewName.trim();
                if (!name) return;
                addActivitySavedView(name, searchParams);
                setSavedViews(loadActivitySavedViews());
                setSaveDialogOpen(false);
              }}
              disabled={!newViewName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage saved views</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {savedViews.length ? (
              savedViews.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <button
                    type="button"
                    className="text-left min-w-0"
                    onClick={() => {
                      applySavedView(v.query);
                      setManageDialogOpen(false);
                    }}
                  >
                    <div className="font-medium truncate">{v.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.query || "(no filters)"}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      deleteActivitySavedView(v.id);
                      setSavedViews(loadActivitySavedViews());
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No saved views.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {customerId ? (
          <Badge variant="outline">customer={customerId}</Badge>
        ) : null}
        {search ? <Badge variant="outline">q={search}</Badge> : null}
        {start ? <Badge variant="outline">start</Badge> : null}
        {end ? <Badge variant="outline">end</Badge> : null}
      </div>
    </div>
  );
}
