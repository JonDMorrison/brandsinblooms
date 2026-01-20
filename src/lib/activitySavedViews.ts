export interface ActivitySavedView {
  id: string;
  name: string;
  query: string; // without leading '?'
  createdAt: string;
}

const STORAGE_KEY = "activity:savedViews:v1";

export function loadActivitySavedViews(): ActivitySavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivitySavedView[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => v && typeof v.id === "string" && typeof v.name === "string");
  } catch {
    return [];
  }
}

export function saveActivitySavedViews(views: ActivitySavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function addActivitySavedView(name: string, searchParams: URLSearchParams): ActivitySavedView {
  const id = crypto.randomUUID();
  const query = searchParams.toString();
  const view: ActivitySavedView = {
    id,
    name,
    query,
    createdAt: new Date().toISOString(),
  };

  const existing = loadActivitySavedViews();
  saveActivitySavedViews([view, ...existing]);
  return view;
}

export function deleteActivitySavedView(id: string) {
  const existing = loadActivitySavedViews();
  saveActivitySavedViews(existing.filter((v) => v.id !== id));
}
