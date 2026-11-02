import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Autocomplete from "@mui/joy/Autocomplete";
import { bloomSupport } from "@/lib/bloomSupport/api";

export type PickedClient = { id: string; name: string };

/** Find a client by name. Nobody has to know or paste an account id. */
export function ClientPicker({ value, onChange, placeholder = "Start typing the client's name" }: { value: PickedClient | null; onChange: (c: PickedClient | null) => void; placeholder?: string }) {
  const [search, setSearch] = useState("");
  const accounts = useQuery({
    queryKey: ["bloom-support", "accounts", "search", search],
    queryFn: () => bloomSupport.listAccounts(search),
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });
  return (
    <Autocomplete
      placeholder={placeholder}
      options={(accounts.data ?? []).map((a): PickedClient => ({ id: a.id, name: a.name }))}
      multiple={false}
      freeSolo={false}
      getOptionLabel={(o: PickedClient) => o.name}
      isOptionEqualToValue={(a: PickedClient, b: PickedClient) => a.id === b.id}
      value={value}
      onChange={(_, v: PickedClient | null) => onChange(v)}
      inputValue={search}
      onInputChange={(_, v) => setSearch(v)}
      loading={accounts.isFetching}
      noOptionsText={search.trim().length < 2 ? "Type at least 2 letters" : "No client with that name"}
      filterOptions={(o: PickedClient[]) => o}
    />
  );
}
