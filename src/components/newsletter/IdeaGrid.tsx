import React, { useState, useRef, useEffect } from 'react';
import { IdeaCard } from './IdeaCard';
import { NewsletterEmptyState } from './NewsletterEmptyState';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { Swiper, SwiperSlide } from 'swiper/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Import Swiper styles
import 'swiper/css';

interface IdeaGridProps {
  ideas: NewsletterIdea[];
  onSelectIdea: (idea: NewsletterIdea) => void;
  onGenerateIdeas?: (prompt: string) => void;
  loading?: boolean;
  className?: string;
}

const IdeaCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-3xl aspect-[3/4] animate-pulse">
    {/* Gradient Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 opacity-90" />
    
    {/* Content */}
    <div className="relative z-10 h-full flex flex-col justify-between p-6 text-white">
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl animate-pulse"></div>
        <div className="space-y-2 w-full">
          <div className="h-6 w-3/4 bg-white/20 rounded mx-auto"></div>
          <div className="h-4 w-full bg-white/20 rounded"></div>
          <div className="h-4 w-2/3 bg-white/20 rounded mx-auto"></div>
        </div>
        <div className="h-10 w-32 bg-white/20 rounded-full"></div>
      </div>
      
      {/* Bottom accent */}
      <div className="flex justify-center mt-4">
        <div className="w-12 h-1 bg-white/30 rounded-full">
          <div className="w-6 h-1 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
    
    {/* Labels */}
    <div className="absolute top-4 left-4 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
      <div className="w-12 h-3 bg-white/20 rounded"></div>
    </div>
  </div>
);

export const IdeaGrid: React.FC<IdeaGridProps> = ({ 
  ideas, 
  onSelectIdea, 
  onGenerateIdeas,
  loading = false, 
  className 
}) => {
  // Calculate initial slide based on current week number
  const currentWeek = getCurrentWeekNumber();
  const currentWeekIndex = ideas.findIndex(idea => idea.weekNumber === currentWeek);
  const initialSlide = currentWeekIndex >= 0 ? currentWeekIndex : 0;
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const swiperRef = useRef<any>(null);

  useEffect(() => {
    // Force swiper to center on the initial slide after mount
    if (swiperRef.current && initialSlide > 0) {
      setTimeout(() => {
        swiperRef.current.slideTo(initialSlide, 0);
      }, 300);
    }
  }, [initialSlide]);

  const handleSwiper = (swiper: any) => {
    swiperRef.current = swiper;
  };

  if (loading) {
    return (
      <div className={cn("py-8", className)}>
        <Swiper
          grabCursor={true}
          centeredSlides={true}
            slidesPerView="auto"
            spaceBetween={16}
            initialSlide={0}
            breakpoints={{
              320: {
                slidesPerView: "auto",
                spaceBetween: 12,
              },
              640: {
                slidesPerView: "auto",
                spaceBetween: 14,
              },
              768: {
                slidesPerView: "auto",
                spaceBetween: 16,
              },
              1024: {
                slidesPerView: "auto",
                spaceBetween: 20,
              },
            }}
            className="!pb-16 newsletter-idea-slider"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <SwiperSlide key={index} className="!h-auto">
                <div className="scale-95 opacity-70">
                  <IdeaCardSkeleton />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className={cn("py-8", className)}>
        <NewsletterEmptyState 
          onPromptClick={onGenerateIdeas}
          onSelectIdea={onSelectIdea}
        />
      </div>
    );
  }

  console.log('📧 IdeaGrid: Current week:', currentWeek, 'Ideas:', ideas.length, 'initialSlide:', initialSlide);

  return (
    <div className={cn("py-8 relative", className)}>
      <div className="max-w-6xl mx-auto">
        <div className="h-full w-full relative">
          {/* Left Navigation Handle */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 rounded-full shadow-lg hover:shadow-xl transition-all"
            onClick={() => swiperRef.current?.slidePrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Right Navigation Handle */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 rounded-full shadow-lg hover:shadow-xl transition-all"
            onClick={() => swiperRef.current?.slideNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <Swiper
            grabCursor={true}
            centeredSlides={true}
            centerInsufficientSlides={true}
            slideToClickedSlide={true}
            slidesPerView="auto"
            slidesPerGroup={1}
            spaceBetween={16}
            initialSlide={initialSlide}
            speed={600}
            longSwipesRatio={0.5}
            resistance={true}
            resistanceRatio={0.85}
            onSwiper={handleSwiper}
            onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
            breakpoints={{
              320: {
                slidesPerView: "auto",
                spaceBetween: 12,
                centeredSlides: true,
              },
              640: {
                slidesPerView: "auto",
                spaceBetween: 14,
                centeredSlides: true,
              },
              768: {
                slidesPerView: "auto",
                spaceBetween: 16,
                centeredSlides: true,
              },
              1024: {
                slidesPerView: "auto",
                spaceBetween: 20,
                centeredSlides: true,
              },
            }}
            className="!pb-16 !pt-8 newsletter-idea-slider !h-[calc(100vh-280px)] !relative !z-40 overflow-visible [&_.swiper-slide]:!w-auto"
          >
            {ideas.map((idea, index) => {
              const isActive = index === currentSlide;
              return (
                <SwiperSlide key={idea.id} className="!h-auto">
                  <IdeaCard
                    idea={idea}
                    onSelect={onSelectIdea}
                    isActive={isActive}
                    slideIndex={index}
                  />
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </div>
  );
};