import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";

export const KnowledgeBasePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>Knowledge Base — Coming Soon | BloomSuite</title>
        <meta
          name="description"
          content="The BloomSuite Knowledge Base is coming soon. In the meantime, our team is happy to help — book a demo or email support@brandsinblooms.com."
        />
        <link
          rel="canonical"
          href="https://www.bloomsuite.app/knowledge-base"
        />
      </Helmet>

      <LandingPageHeader onLogin={() => navigate("/auth")} />

      <main className="px-6 py-28 lg:py-36">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#3E7C77]">
            Knowledge Base
          </p>
          <h1
            className="mb-5 text-4xl font-bold leading-tight text-slate-900 lg:text-5xl"
            style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
          >
            Knowledge Base — Coming Soon
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-slate-600">
            We're writing in-depth articles on every part of BloomSuite — POS
            sync, segments, campaigns, storefront, analytics, and more. They'll
            live here when they're ready. In the meantime, our team is happy
            to help — book a demo or email{" "}
            <a
              href="mailto:support@brandsinblooms.com"
              className="font-semibold text-[#3E7C77] hover:text-[#2E605C]"
            >
              support@brandsinblooms.com
            </a>
            .
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-xl bg-[#3E7C77] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E605C]"
            >
              Book a Demo
            </Link>
            <a
              href="mailto:support@brandsinblooms.com"
              className="inline-flex items-center justify-center rounded-xl border border-[#3E7C77]/30 bg-white px-6 py-3 text-sm font-semibold text-[#2E605C] transition hover:border-[#3E7C77]/60 hover:bg-[#E1FFFE]/40"
            >
              Email Support
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default KnowledgeBasePage;
