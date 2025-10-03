import React, { useState } from 'react';
import { IdeaCard } from './IdeaCard';
import { NewsletterEmptyState } from './NewsletterEmptyState';
import { NewsletterIdea } from '@/types/newsletter';
import { cn } from '@/lib/utils';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation } from 'swiper/modules';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';

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

  if (loading) {
    return (
      <div className={cn("py-8", className)}>
        <Swiper
          modules={[Navigation]}
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
          <Swiper
            modules={[Navigation]}
            grabCursor={true}
            centeredSlides={true}
            slideToClickedSlide={true}
            slidesPerView={7}
            slidesPerGroup={1}
            spaceBetween={16}
            initialSlide={initialSlide}
            navigation={true}
            onSlideChange={(swiper) => setCurrentSlide(swiper.activeIndex)}
            breakpoints={{
              320: {
                slidesPerView: 3,
                spaceBetween: 12,
                centeredSlides: true,
              },
              640: {
                slidesPerView: 5,
                spaceBetween: 14,
                centeredSlides: true,
              },
              768: {
                slidesPerView: 7,
                spaceBetween: 16,
                centeredSlides: true,
              },
              1024: {
                slidesPerView: 7,
                spaceBetween: 20,
                centeredSlides: true,
              },
            }}
            className="!pb-16 !pt-8 newsletter-idea-slider !h-[calc(100vh-280px)] !relative !z-40 overflow-visible [&_.swiper-button-next]:!bg-transparent [&_.swiper-button-prev]:!bg-transparent [&_.swiper-button-next]:!text-gray-600 [&_.swiper-button-prev]:!text-gray-600 [&_.swiper-button-next]:!w-10 [&_.swiper-button-prev]:!w-10 [&_.swiper-button-next]:!h-10 [&_.swiper-button-prev]:!h-10 [&_.swiper-button-next]:!text-xs [&_.swiper-button-prev]:!text-xs [&_.swiper-button-next]:!border-0 [&_.swiper-button-prev]:!border-0 [&_.swiper-button-next]:!border-none [&_.swiper-button-prev]:!border-none [&_.swiper-button-next]:!shadow-none [&_.swiper-button-prev]:!shadow-none [&_.swiper-button-next]:hover:!bg-transparent [&_.swiper-button-prev]:hover:!bg-transparent [&_.swiper-button-next]:hover:!text-gray-800 [&_.swiper-button-prev]:hover:!text-gray-800 [&_.swiper-button-next]:hover:!border-0 [&_.swiper-button-prev]:hover:!border-0 [&_.swiper-button-next]:hover:!shadow-none [&_.swiper-button-prev]:hover:!shadow-none [&_.swiper-button-next]:focus:!bg-transparent [&_.swiper-button-prev]:focus:!bg-transparent [&_.swiper-button-next]:active:!bg-transparent [&_.swiper-button-prev]:active:!bg-transparent [&_.swiper-button-next]:!transition-all [&_.swiper-button-prev]:!transition-all [&_.swiper-button-next]:!duration-300 [&_.swiper-button-prev]:!duration-300"
          >
            {ideas.map((idea, index) => {
              const isActive = index === currentSlide;
              return (
                <SwiperSlide key={idea.id} className="!w-auto !h-full !relative !z-50 !bg-transparent">
                  <div className="!h-full !w-96 relative z-50 flex items-center justify-center">
                    <IdeaCard
                      idea={idea}
                      onSelect={onSelectIdea}
                      isActive={isActive}
                      slideIndex={index}
                      className="!w-full !h-full"
                    />
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </div>
  );
};