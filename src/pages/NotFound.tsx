import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Home, ArrowLeft } from "lucide-react";

const WiltedPlantSvg = () => (
  <svg
    viewBox="0 0 200 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto"
    aria-hidden="true"
  >
    {/* Pot */}
    <path
      d="M60 160 L72 200 L128 200 L140 160 Z"
      fill="hsl(25, 30%, 65%)"
      stroke="hsl(25, 30%, 50%)"
      strokeWidth="2"
    />
    <rect x="55" y="152" width="90" height="12" rx="3" fill="hsl(25, 30%, 58%)" stroke="hsl(25, 30%, 45%)" strokeWidth="2" />
    {/* Soil */}
    <ellipse cx="100" cy="158" rx="38" ry="4" fill="hsl(30, 25%, 35%)" />

    {/* Stem — droops right */}
    <path
      d="M100 155 C100 130, 100 120, 105 100 C110 80, 125 65, 135 55"
      stroke="hsl(140, 40%, 45%)"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    >
      <animate
        attributeName="d"
        values="
          M100 155 C100 130, 100 120, 105 100 C110 80, 125 65, 135 55;
          M100 155 C100 130, 100 115, 100 95 C100 75, 100 55, 100 35;
          M100 155 C100 130, 100 115, 100 95 C100 75, 100 55, 100 35"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
    </path>

    {/* Flower head — drooping */}
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="35 135 55; 0 100 35; 0 100 35"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0 0; -35 -20; -35 -20"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
        additive="sum"
      />
      {/* Petals */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="135"
          cy="55"
          rx="8"
          ry="16"
          fill="hsl(174, 63%, 57%)"
          opacity="0.8"
          transform={`rotate(${angle} 135 55) translate(0 -12)`}
        />
      ))}
      {/* Center */}
      <circle cx="135" cy="55" r="7" fill="hsl(45, 90%, 60%)" />

      {/* Face — sad then happy */}
      {/* Eyes */}
      <circle cx="131" cy="53" r="1.5" fill="hsl(30, 25%, 35%)">
        <animate attributeName="cy" values="53;53;53" dur="3s" begin="1.5s" fill="freeze" />
      </circle>
      <circle cx="139" cy="53" r="1.5" fill="hsl(30, 25%, 35%)">
        <animate attributeName="cy" values="53;53;53" dur="3s" begin="1.5s" fill="freeze" />
      </circle>
      {/* Sad mouth becomes smile */}
      <path
        d="M132 59 Q135 56, 138 59"
        stroke="hsl(30, 25%, 35%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      >
        <animate
          attributeName="d"
          values="M132 59 Q135 56, 138 59;M132 57 Q135 60, 138 57;M132 57 Q135 60, 138 57"
          keyTimes="0;0.6;1"
          dur="3s"
          begin="1.5s"
          fill="freeze"
        />
      </path>
    </g>

    {/* Left leaf */}
    <path
      d="M95 125 C80 115, 65 120, 60 130"
      stroke="hsl(140, 40%, 45%)"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    >
      <animate
        attributeName="d"
        values="M95 125 C80 115, 65 120, 60 130;M98 110 C80 100, 65 95, 55 100;M98 110 C80 100, 65 95, 55 100"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
    </path>
    <ellipse
      cx="62" cy="128" rx="12" ry="6"
      fill="hsl(140, 45%, 50%)"
      opacity="0.7"
      transform="rotate(-20 62 128)"
    >
      <animate attributeName="cx" values="62;57;57" keyTimes="0;0.6;1" dur="3s" begin="1.5s" fill="freeze" />
      <animate attributeName="cy" values="128;98;98" keyTimes="0;0.6;1" dur="3s" begin="1.5s" fill="freeze" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="-20 62 128;-15 57 98;-15 57 98"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
    </ellipse>

    {/* Right leaf */}
    <path
      d="M108 110 C120 100, 135 105, 140 115"
      stroke="hsl(140, 40%, 45%)"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    >
      <animate
        attributeName="d"
        values="M108 110 C120 100, 135 105, 140 115;M103 100 C115 85, 135 80, 145 85;M103 100 C115 85, 135 80, 145 85"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
    </path>
    <ellipse
      cx="138" cy="113" rx="12" ry="6"
      fill="hsl(140, 45%, 50%)"
      opacity="0.7"
      transform="rotate(20 138 113)"
    >
      <animate attributeName="cx" values="138;143;143" keyTimes="0;0.6;1" dur="3s" begin="1.5s" fill="freeze" />
      <animate attributeName="cy" values="113;83;83" keyTimes="0;0.6;1" dur="3s" begin="1.5s" fill="freeze" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="20 138 113;15 143 83;15 143 83"
        keyTimes="0;0.6;1"
        dur="3s"
        begin="1.5s"
        fill="freeze"
      />
    </ellipse>

    {/* Sparkles that appear when plant perks up */}
    <circle cx="70" cy="40" r="3" fill="hsl(45, 90%, 60%)" opacity="0">
      <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.5;0.7;1" dur="3s" begin="1.5s" fill="freeze" />
    </circle>
    <circle cx="145" cy="25" r="2" fill="hsl(174, 63%, 57%)" opacity="0">
      <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.55;0.75;1" dur="3s" begin="1.5s" fill="freeze" />
    </circle>
    <circle cx="55" cy="60" r="2.5" fill="hsl(45, 90%, 60%)" opacity="0">
      <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.6;0.8;1" dur="3s" begin="1.5s" fill="freeze" />
    </circle>
  </svg>
);

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-teal-50 px-4">
      <div className="text-center max-w-lg">
        <WiltedPlantSvg />

        <p className="text-6xl sm:text-7xl font-bold text-brand-teal mt-2 mb-3 tracking-tight">
          404
        </p>

        <h1 className="text-xl sm:text-2xl font-semibold text-brand-navy mb-2">
          This page went to seed
        </h1>

        <p className="text-gray-500 mb-8 leading-relaxed max-w-sm mx-auto">
          We couldn't find what you were looking for — but don't worry, not every seed sprouts on the first try.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        <p className="mt-8 text-xs text-gray-400">
          If this keeps happening, reach out to{" "}
          <a href="/support" className="text-brand-teal hover:underline">
            support
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default NotFound;
