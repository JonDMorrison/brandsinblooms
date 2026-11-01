import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Search, ArrowRight, ChevronDown } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { bloomSupport, PRODUCT_LABEL, type KnowledgeProduct } from "@/lib/bloomSupport/api";

export const KnowledgeBasePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [product, setProduct] = useState<KnowledgeProduct | undefined>();
  const articles = useQuery({ queryKey: ["bloom-help", product], queryFn: () => bloomSupport.publicKnowledge(product), staleTime: 60000 });
  const needle = search.trim().toLowerCase();
  const matches = (articles.data ?? []).filter((article) => `${article.title} ${article.body}`.toLowerCase().includes(needle));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Helmet>
        <title>Help Centre | BloomSuite</title>
        <meta name="description" content="Find reviewed answers for BloomSuite, BloomSites and BloomSuite POS, or contact Bloom Support." />
        <link rel="canonical" href="https://bloomsuite.app/knowledge-base" />
      </Helmet>
      <LandingPageHeader onLogin={() => navigate("/auth")} />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-28 lg:pt-36">
        <p className="mb-3 text-sm font-semibold tracking-wide text-slate-500">BLOOM HELP CENTRE</p>
        <h1 className="text-4xl font-bold leading-tight lg:text-5xl" style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}>How can we help?</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">Practical answers reviewed by our team. If you need a hand, send us a request and follow the conversation in one place.</p>
        <label className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 shadow-sm">
          <Search size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search help articles</span>
          <input type="search" className="w-full bg-transparent text-base outline-none" placeholder="Search questions and answers" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <div className="my-6 flex flex-wrap gap-2" aria-label="Filter help by product">
          {([undefined, "crm", "cms", "pos"] as const).map((value) => <button key={value ?? "all"} type="button" aria-pressed={product === value} onClick={() => setProduct(value)} className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${product === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>{value ? PRODUCT_LABEL[value] : "All products"}</button>)}
        </div>
        <div aria-live="polite" aria-busy={articles.isLoading}>
          {articles.isLoading && <p className="py-8 text-slate-500">Loading answers…</p>}
          {articles.error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">We couldn’t load the help articles. You can still contact support below. <button type="button" className="ml-2 underline" onClick={() => articles.refetch()}>Try again</button></div>}
          {!articles.isLoading && !articles.error && matches.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="text-lg font-semibold">{needle ? "No matching answers yet" : "More answers are on the way"}</h2><p className="mt-2 text-slate-600">Send your question to Bloom Support. We’ll keep the request and replies together.</p></div>}
          <div className="space-y-3">
            {matches.map((article) => <details key={article.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px]"><span>{article.title}<span className="mt-1 block text-xs font-normal text-slate-500">{article.product === "platform" ? "All products" : PRODUCT_LABEL[article.product]}</span></span><ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><p className="whitespace-pre-wrap break-words border-t border-slate-100 px-5 py-5 leading-relaxed text-slate-700">{article.body}</p></details>)}
          </div>
        </div>
        <section className="mt-10 flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
          <div><h2 className="text-lg font-semibold">Still need help?</h2><p className="mt-1 text-sm text-slate-600">Report a problem, ask a question, or request a change.</p><a className="mt-2 inline-block break-all text-sm underline underline-offset-4" href="mailto:bloom@support.bloomsuite.app">bloom@support.bloomsuite.app</a></div>
          <Link to="/support/contact" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">Contact support <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      </main>
    </div>
  );
};

export default KnowledgeBasePage;
