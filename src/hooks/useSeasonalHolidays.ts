
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface Holiday {
  id: string;
  holiday_name: string;
  category: string;
  holiday_date: string;
  description: string;
  garden_relevance: string;
  is_active: boolean;
}

interface HolidayContentState {
  [holidayId: string]: {
    hasContent: boolean;
    contentTasks: any[];
    campaignId?: string;
  };
}

export const useSeasonalHolidays = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayContentState, setHolidayContentState] = useState<HolidayContentState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolidayContentState = async (holidayIds: string[]) => {
    if (!user || holidayIds.length === 0) return;

    try {
      console.log('Fetching content state for holidays:', holidayIds);
      
      // Build query based on tenant vs user model
      let query = supabase
        .from('content_tasks')
        .select('*')
        .in('holiday_id', holidayIds);

      if (tenant?.id) {
        query = query.eq('tenant_id', tenant.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: contentTasks, error: contentError } = await query;

      if (contentError) {
        console.error('Error fetching holiday content state:', contentError);
        return;
      }

      const contentState: HolidayContentState = {};
      
      // Group tasks by holiday ID
      holidayIds.forEach(holidayId => {
        const holidayTasks = contentTasks?.filter(task => task.holiday_id === holidayId) || [];
        const hasContent = holidayTasks.length > 0 && holidayTasks.some(task => task.ai_output);
        
        contentState[holidayId] = {
          hasContent,
          contentTasks: holidayTasks,
          campaignId: holidayTasks[0]?.campaign_id
        };
      });

      console.log('Holiday content state:', contentState);
      setHolidayContentState(contentState);
    } catch (error) {
      console.error('Exception fetching holiday content state:', error);
    }
  };

  const fetchUpcomingHolidays = async () => {
    if (!user) {
      setHolidays([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching holidays for upcoming opportunities');

      const today = new Date();
      
      // First check for holidays in the next 60 days (2 months)
      const twoMonthsDate = new Date();
      twoMonthsDate.setDate(today.getDate() + 60);
      
      const todayStr = today.toISOString().split('T')[0];
      const twoMonthsStr = twoMonthsDate.toISOString().split('T')[0];

      console.log('Checking 2-month range:', todayStr, 'to', twoMonthsStr);

      const { data: twoMonthData, error: twoMonthError } = await supabase
        .from('holidays')
        .select('*')
        .eq('is_active', true)
        .gte('holiday_date', todayStr)
        .lte('holiday_date', twoMonthsStr)
        .order('holiday_date', { ascending: true });

      if (twoMonthError) {
        console.error('Error fetching 2-month holidays:', twoMonthError);
        setError(twoMonthError.message);
        setHolidays([]);
        return;
      }

      console.log('2-month holidays found:', twoMonthData?.length || 0);

      let finalHolidays = [];

      // If there are exactly 8 opportunities in 2 months, show all 8
      if (twoMonthData && twoMonthData.length === 8) {
        console.log('Showing all 8 holidays from 2-month period');
        finalHolidays = twoMonthData;
      } else {
        // Otherwise, fetch up to 6 holidays from 90-day range
        const threeMonthsDate = new Date();
        threeMonthsDate.setDate(today.getDate() + 90);
        const threeMonthsStr = threeMonthsDate.toISOString().split('T')[0];

        console.log('Fetching 6 holidays from 3-month range:', todayStr, 'to', threeMonthsStr);

        const { data: threeMonthData, error: threeMonthError } = await supabase
          .from('holidays')
          .select('*')
          .eq('is_active', true)
          .gte('holiday_date', todayStr)
          .lte('holiday_date', threeMonthsStr)
          .order('holiday_date', { ascending: true })
          .limit(6);

        if (threeMonthError) {
          console.error('Error fetching 3-month holidays:', threeMonthError);
          setError(threeMonthError.message);
          setHolidays([]);
          return;
        }

        console.log('Showing', threeMonthData?.length || 0, 'holidays from 3-month period');
        finalHolidays = threeMonthData || [];
      }

      setHolidays(finalHolidays);
      
      // Fetch content state for these holidays
      if (finalHolidays.length > 0) {
        const holidayIds = finalHolidays.map(h => h.id);
        await fetchHolidayContentState(holidayIds);
      }
    } catch (error) {
      console.error('Exception fetching holidays:', error);
      setError('Failed to fetch holidays');
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  };

  const generateHolidayContent = async (holidayId: string) => {
    if (!user?.id) {
      console.error('❌ No user ID available for content generation');
      toast.error('Authentication error', {
        description: 'Please refresh the page and try again',
        duration: 5000,
      });
      throw new Error('User not authenticated');
    }

    try {
      console.log('🎯 Generating holiday content for:', holidayId, 'User:', user.id, 'Tenant:', tenant?.id || 'none');
      
      // Check if user has company profile first
      const { data: companyProfile, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Error fetching company profile:', profileError);
        toast.error('Profile error', {
          description: 'Unable to fetch your company profile. Please try again.',
          duration: 5000,
        });
        throw new Error('Failed to fetch company profile');
      }

      if (!companyProfile) {
        console.error('❌ No company profile found for user:', user.id);
        toast.error('Company profile required', {
          description: 'Please complete your company profile setup first.',
          duration: 8000,
        });
        throw new Error('Company profile not found');
      }

      console.log('✅ Found company profile:', companyProfile.company_name || 'Unnamed');
      
      // Get holiday details
      const { data: holiday, error: holidayError } = await supabase
        .from('holidays')
        .select('*')
        .eq('id', holidayId)
        .single();

      if (holidayError || !holiday) {
        console.error('❌ Holiday fetch error:', holidayError);
        toast.error('Holiday not found', {
          description: holidayError?.message || 'Could not find holiday details',
          duration: 5000,
        });
        throw new Error(`Holiday not found: ${holidayError?.message || 'Unknown error'}`);
      }

      console.log('✅ Found holiday:', holiday.holiday_name);

      // Create a campaign title based on the holiday
      const campaignTitle = `${holiday.holiday_name} - ${holiday.category}`;
      const campaignDescription = `${holiday.description} - ${holiday.garden_relevance}`;

      // Generate content for each type using the working generate-content function
      const contentTypes = ['facebook', 'instagram', 'video', 'newsletter', 'email'];
      const createdTasks = [];

      console.log('📝 Generating content for', contentTypes.length, 'types');

      for (const contentType of contentTypes) {
        try {
          console.log(`🔄 Generating ${contentType} content...`);
          
          // Use the existing working generate-content function
          const { data: contentData, error: contentError } = await supabase.functions.invoke('generate-content', {
            body: {
              postType: contentType,
              campaignTitle: campaignTitle,
              weekDescription: campaignDescription,
              userId: user.id,
              enforceCompanyName: true
            }
          });

          if (contentError) {
            console.error(`❌ Error generating ${contentType} content:`, contentError);
            toast.warning(`${contentType} content generation failed`, {
              description: contentError.message || 'Will continue with other content types',
              duration: 3000,
            });
            continue; // Skip this type and continue with others
          }

          const content = contentData?.content || contentData?.generatedText;
          
          if (!content) {
            console.error(`❌ No content returned for ${contentType}`);
            toast.warning(`${contentType} content empty`, {
              description: 'Will continue with other content types',
              duration: 3000,
            });
            continue;
          }

          console.log(`✅ Generated ${contentType} content, creating task...`);

          // Create content task with proper tenant/user association
          const taskData: any = {
            holiday_id: holidayId,
            post_type: contentType,
            ai_output: content,
            status: 'review',
            scheduled_date: getScheduledDate(holiday.holiday_date, holiday.category),
            hashtags: getHolidayHashtags(holiday.holiday_name, contentType),
            image_idea: getHolidayImageIdea(holiday.holiday_name, contentType)
          };

          // Set proper ownership based on tenant model
          if (tenant?.id) {
            taskData.tenant_id = tenant.id;
            taskData.created_by_user_id = user.id;
          } else {
            taskData.user_id = user.id;
          }

          const { data: task, error: taskError } = await supabase
            .from('content_tasks')
            .insert(taskData)
            .select()
            .single();

          if (taskError) {
            console.error(`❌ Error creating ${contentType} task:`, taskError);
            toast.warning(`Failed to save ${contentType} content`, {
              description: taskError.message,
              duration: 3000,
            });
          } else {
            createdTasks.push(task);
            console.log(`✅ Created ${contentType} content task with ID:`, task.id);
            
            // Generate images for the content task
            try {
              const imageQuery = `${holiday.holiday_name} garden center ${contentType}`;
              console.log(`🖼️ Generating images for ${contentType} with query:`, imageQuery);
              
              await supabase.functions.invoke('fetch-unsplash-images', {
                body: { 
                  query: imageQuery,
                  contentTaskId: task.id 
                }
              });
              
              console.log(`✅ Image generation triggered for ${contentType}`);
            } catch (imageError) {
              console.log(`⚠️ Image generation failed for ${contentType}, will use placeholders:`, imageError);
              // Images will fall back to placeholders automatically
            }
          }
        } catch (error) {
          console.error(`❌ Exception generating ${contentType} content:`, error);
          toast.warning(`${contentType} generation failed`, {
            description: error instanceof Error ? error.message : 'Unknown error',
            duration: 3000,
          });
          continue; // Continue with other content types
        }
      }

      if (createdTasks.length === 0) {
        toast.error('Content generation failed', {
          description: 'No content could be generated. Please check your internet connection and try again.',
          duration: 8000,
        });
        throw new Error('Failed to generate any content');
      }

      console.log('✅ Successfully created', createdTasks.length, 'content tasks');
      
      // Update content state for this holiday
      setHolidayContentState(prev => ({
        ...prev,
        [holidayId]: {
          hasContent: true,
          contentTasks: createdTasks,
          campaignId: createdTasks[0]?.campaign_id
        }
      }));
      
      toast.success(`Generated ${createdTasks.length} pieces of content!`, {
        description: `Content for ${holiday.holiday_name} is ready for review`,
        duration: 5000,
      });

      return {
        success: true,
        holiday: holiday,
        tasks: createdTasks,
        message: `Generated ${createdTasks.length} pieces of content for ${holiday.holiday_name}`
      };
    } catch (error) {
      console.error('💥 Error in holiday content generation:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Don't show duplicate toast if we already showed a specific error
      if (!errorMessage.includes('Company profile') && !errorMessage.includes('not found')) {
        toast.error('Content generation failed', {
          description: errorMessage,
          duration: 8000,
        });
      }
      
      throw error;
    }
  };

  const refreshHolidayContent = async () => {
    if (holidays.length > 0) {
      const holidayIds = holidays.map(h => h.id);
      await fetchHolidayContentState(holidayIds);
    }
  };

  useEffect(() => {
    fetchUpcomingHolidays();
  }, [user, tenant]);

  return {
    holidays,
    holidayContentState,
    loading,
    error,
    generateHolidayContent,
    refreshHolidays: fetchUpcomingHolidays,
    refreshHolidayContent
  };
};

function getScheduledDate(holidayDate: string, category: string): string {
  const today = new Date()
  const targetDate = new Date(holidayDate)
  
  // For specific dates, schedule a week before for preparation
  if (category === 'Day') {
    const scheduleDate = new Date(targetDate)
    scheduleDate.setDate(targetDate.getDate() - 7)
    return scheduleDate.toISOString().split('T')[0]
  }
  
  // For months, schedule for the beginning of that month
  if (category === 'Month') {
    const scheduleDate = new Date(targetDate)
    scheduleDate.setDate(1)
    return scheduleDate.toISOString().split('T')[0]
  }
  
  // For weeks, schedule at the start of the week
  if (category === 'Week') {
    return targetDate.toISOString().split('T')[0]
  }
  
  // Default to the holiday date itself
  return holidayDate
}

function getHolidayHashtags(holidayName: string, contentType: string): string {
  const baseHashtags = ['#GardenCenter', '#Plants', '#Gardening']
  const holidaySpecific = {
    'Earth Day': ['#EarthDay', '#EcoFriendly', '#Sustainability', '#GreenLiving'],
    'Arbor Day': ['#ArborDay', '#TreePlanting', '#Trees', '#Conservation'],
    'World Bee Day': ['#WorldBeeDay', '#Pollinators', '#SaveTheBees', '#BeeGarden'],
    'National Garden Month': ['#GardenMonth', '#PlantSeason', '#GreenThumb'],
    'National Rose Month': ['#RoseMonth', '#Roses', '#FlowerGarden'],
    'National Indoor Plant Month': ['#IndoorPlants', '#Houseplants', '#PlantParent'],
    'Mother\'s Day': ['#MothersDay', '#FlowersForMom', '#GardenGifts'],
    'Father\'s Day': ['#FathersDay', '#GardenDad', '#PlantGifts'],
    'Valentine\'s Day': ['#ValentinesDay', '#LovePlants', '#RomanticGarden']
  }
  
  let specific = ['#SeasonalGardening']
  for (const [key, tags] of Object.entries(holidaySpecific)) {
    if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
      specific = tags
      break
    }
  }
  
  return [...baseHashtags, ...specific].join(' ')
}

function getHolidayImageIdea(holidayName: string, contentType: string): string {
  const imageIdeas = {
    'Earth Day': 'Hands planting seedlings in rich soil with composting materials nearby',
    'Arbor Day': 'Young tree being planted with gardening tools and fresh soil',
    'World Bee Day': 'Bee-friendly flowers in bloom with pollinator garden display',
    'National Garden Month': 'Vibrant garden beds with diverse plants and flowers in peak condition',
    'National Rose Month': 'Beautiful rose garden display with various colored roses',
    'National Indoor Plant Month': 'Collection of healthy houseplants in decorative containers',
    'Mother\'s Day': 'Beautiful flowering hanging baskets and colorful spring planters',
    'Father\'s Day': 'Garden tools with vegetable plants and herbs arranged attractively',
    'Valentine\'s Day': 'Romantic red and pink flowering plants with heart-shaped planters'
  }
  
  for (const [key, idea] of Object.entries(imageIdeas)) {
    if (holidayName.includes(key.replace('National ', '').replace('World ', ''))) {
      return idea
    }
  }
  
  return 'Seasonal garden display appropriate for the holiday theme with relevant plants and decorations'
}
