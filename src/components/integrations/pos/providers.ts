export interface POSProvider {
  id: "square" | "lightspeed" | "clover" | "vmx" | "counterpoint";
  name: string;
  description: string;
  logoPath: string | null;
  connectionTable:
    | "square_connections"
    | "lightspeed_connections"
    | "clover_connections"
    | "pos_connections"
    | null;
  platformFilter: string | null;
  connectMethod: "oauth" | "api_key" | "csv_or_api" | "coming_soon";
  connectHandler:
    | "square-oauth"
    | "lightspeed-page"
    | "clover-oauth"
    | "vmx-dialog"
    | null;
}

export const PROVIDERS: POSProvider[] = [
  {
    id: "square",
    name: "Square",
    description: "Popular all-in-one POS for retail and garden centers",
    logoPath: "/src/assets/logos/square-new.png",
    connectionTable: "square_connections",
    platformFilter: null,
    connectMethod: "oauth",
    connectHandler: "square-oauth",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    description: "Cloud POS built for complex retail and multi-location",
    logoPath: "/src/assets/logos/lightspeed-x-series.svg",
    connectionTable: "lightspeed_connections",
    platformFilter: null,
    connectMethod: "oauth",
    connectHandler: "lightspeed-page",
  },
  {
    id: "clover",
    name: "Clover",
    description: "Versatile POS with strong payment and loyalty features",
    logoPath: "/src/assets/logos/clover.svg",
    connectionTable: "clover_connections",
    platformFilter: null,
    connectMethod: "oauth",
    connectHandler: "clover-oauth",
  },
  {
    id: "vmx",
    name: "VMX POS",
    description: "Garden center POS with API sync and CSV import",
    logoPath: null,
    connectionTable: "pos_connections",
    platformFilter: "vmx",
    connectMethod: "csv_or_api",
    connectHandler: "vmx-dialog",
  },
  {
    id: "counterpoint",
    name: "Counterpoint",
    description: "Enterprise POS for multi-location garden centers",
    logoPath: null,
    connectionTable: null,
    platformFilter: null,
    connectMethod: "coming_soon",
    connectHandler: null,
  },
];
