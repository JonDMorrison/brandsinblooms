import React from 'react';
import { useTypingEffect } from '@/hooks/useTypingEffect';
import { DisplayMedium, BodyMedium } from '@/components/ui/typography';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { Sparkles } from 'lucide-react';

// Import Swiper styles
import 'swiper/css';

const BlinkingCursor = ({ show }: { show: boolean }) => (
  <span className={`inline-block w-0.5 h-5 bg-current ml-1 ${show ? 'animate-pulse' : ''}`}>
    |
  </span>
);

interface NewsletterEmptyStateProps {
  onPromptClick?: (prompt: string) => void;
}

export const NewsletterEmptyState: React.FC<NewsletterEmptyStateProps> = ({ onPromptClick }) => {
  const inspirationalText = "Writing should never feel like a struggle. That's why we created an AI assistant designed to capture your raw ideas and refine them into something impactful.";
  
  const { displayedText, isComplete, hasStarted } = useTypingEffect({
    text: inspirationalText,
    delay: 1500,
    speed: 30
  });

  const samplePrompts = [
    "Weekly tech updates for software developers",
    "Monthly gardening tips and seasonal care guides",
    "Fashion trends and styling advice for millennials",
    "Small business marketing strategies and success stories",
    "Healthy recipes and nutrition tips for busy professionals",
    "Travel destinations and budget-friendly vacation ideas",
    "Personal finance advice for young entrepreneurs",
    "Home improvement DIY projects and decor inspiration",
    "Productivity hacks and work-life balance tips",
    "Fitness routines and wellness advice for beginners",
    "Book recommendations and literary discussions",
    "Photography techniques and creative inspiration"
  ];

  const handlePromptClick = (prompt: string) => {
    if (onPromptClick) {
      onPromptClick(prompt);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center space-y-12">
      {/* Main Heading */}
      <div className="space-y-2">
        <DisplayMedium className="text-brand-teal leading-tight">
          Great ideas
        </DisplayMedium>
        <DisplayMedium className="text-foreground leading-tight">
          few lines away
        </DisplayMedium>
      </div>
      
      {/* Typing Animation */}
      <div className="max-w-2xl">
        <p className="text-lg font-mono text-muted-foreground leading-relaxed">
          {hasStarted && (
            <>
              {displayedText}
              <BlinkingCursor show={!isComplete || displayedText.length > 0} />
            </>
          )}
        </p>
      </div>

      {/* Sample Prompts Swiper */}
      {isComplete && (
        <div className="w-full max-w-4xl animate-fade-in">
          <div className="mb-6">
            <BodyMedium className="text-muted-foreground mb-2">
              Get inspired with these sample prompts
            </BodyMedium>
            <div className="flex items-center justify-center gap-2 text-sm text-brand-teal">
              <Sparkles size={16} />
              <span>Swipe to explore</span>
              <Sparkles size={16} />
            </div>
          </div>
          
          <Swiper
            modules={[Autoplay]}
            spaceBetween={16}
            slidesPerView="auto"
            grabCursor={true}
            centeredSlides={true}
            navigation={false}
            autoplay={{
              delay: 3000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true
            }}
            className="sample-prompts-slider !pb-4 !pt-4 [&_.swiper-button-next]:!hidden [&_.swiper-button-prev]:!hidden"
            breakpoints={{
              320: {
                slidesPerView: 1.2,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 1.8,
                spaceBetween: 14,
              },
              768: {
                slidesPerView: 2.2,
                spaceBetween: 16,
              },
              1024: {
                slidesPerView: 2.8,
                spaceBetween: 18,
              },
            }}
          >
            {samplePrompts.map((prompt, index) => (
              <SwiperSlide key={index} className="!h-auto">
                <div className="group cursor-pointer" onClick={() => handlePromptClick(prompt)}>
                  <div className="bg-white backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-teal/50 hover:bg-white hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-brand-teal rounded-full mt-2 opacity-60 group-hover:opacity-100 transition-opacity group-hover:scale-125"></div>
                      <p className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900 transition-colors">
                        "{prompt}"
                      </p>
                    </div>
                    <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="text-xs text-brand-teal font-medium">Click to generate ideas →</div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      )}
    </div>
  );
};