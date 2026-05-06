import { useEffect, useState } from "react";
import { Search, Sparkles, Store, Wand2 } from "lucide-react";

interface WebsiteAnalysisLoaderProps {
  isAnalyzing: boolean;
}

const analysisStatuses = [
  "Analyzing your website...",
  "Scanning your brand...",
  "Generating your profile...",
];

export const WebsiteAnalysisLoader = ({
  isAnalyzing,
}: WebsiteAnalysisLoaderProps) => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    if (!isAnalyzing) {
      setStatusIndex(0);
      setProgress(18);
      return;
    }

    const statusTimer = setInterval(() => {
      setStatusIndex((previous) =>
        previous < analysisStatuses.length - 1 ? previous + 1 : previous,
      );
    }, 1400);

    const progressTimer = setInterval(() => {
      setProgress((previous) => Math.min(92, previous + 9));
    }, 900);

    return () => {
      clearInterval(statusTimer);
      clearInterval(progressTimer);
    };
  }, [isAnalyzing]);

  if (!isAnalyzing) return null;

  return (
    <div className="auth-analysis-loader" role="status" aria-live="polite">
      <div className="auth-analysis-loader__visual" aria-hidden="true">
        <div className="auth-analysis-loader__card auth-analysis-loader__card--store">
          <Store />
        </div>
        <div className="auth-analysis-loader__card auth-analysis-loader__card--sparkles">
          <Sparkles />
        </div>
        <div className="auth-analysis-loader__search-ring">
          <Search />
        </div>
        <div className="auth-analysis-loader__wand">
          <Wand2 />
        </div>
      </div>

      <div className="auth-analysis-loader__copy">
        <h2>{analysisStatuses[statusIndex]}</h2>
        <p>This usually takes 15-30 seconds.</p>
      </div>

      <div className="auth-analysis-loader__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};
