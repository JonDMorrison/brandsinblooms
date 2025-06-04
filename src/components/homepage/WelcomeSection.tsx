
import { getSeasonalGreeting } from './SeasonalContent';

export const WelcomeSection = () => {
  const seasonal = getSeasonalGreeting();

  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center gap-3 mb-4">
        <span className="seasonal-emoji">{seasonal.emoji}</span>
        <h1 className="text-4xl font-bold text-black">
          Welcome back! {seasonal.text}
        </h1>
      </div>
      <p className="text-xl text-black font-medium mb-2">
        Here's what's happening this week at your garden center
      </p>
    </div>
  );
};
