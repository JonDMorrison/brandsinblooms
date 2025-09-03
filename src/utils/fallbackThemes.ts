
export const getFallbackThemes = (targetMonth?: Date) => {
  // Use target month if provided, otherwise current month
  const monthDate = targetMonth || new Date();
  const currentWeek = Math.ceil(
    ((monthDate.getTime() - new Date(monthDate.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
  );
  
  const month = monthDate.getMonth() + 1;
  let seasonalThemes;
  
  if (month >= 3 && month <= 5) {
    // Spring themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Spring Garden Renaissance - Week ${currentWeek}`,
        description: 'Celebrate the awakening of spring with fresh plantings, soil preparation, and garden renewal activities that capture the excitement of the growing season.',
        content_ideas: [
          'Spring soil preparation and testing',
          'Early season vegetable planting',
          'Spring cleanup and garden renewal',
          'Container garden design for patios'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Early Season Planting Guide`,
        description: 'Focus on early season planting opportunities with cool-weather crops, soil amendments, and garden bed preparation for the growing season ahead.',
        content_ideas: [
          'Cool-weather vegetable varieties',
          'Soil amendment techniques',
          'Garden bed preparation',
          'Spring fertilization schedules'
        ]
      }
    ];
  } else if (month >= 6 && month <= 8) {
    // Summer themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Summer Garden Mastery - Week ${currentWeek}`,
        description: 'Master the art of summer gardening with heat-tolerant plants, water-wise techniques, and harvest celebrations that make the most of peak growing season.',
        content_ideas: [
          'Heat-tolerant plant selections',
          'Water conservation techniques',
          'Summer harvest and preservation',
          'Shade gardening solutions'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Heat & Drought Solutions`,
        description: 'Address summer gardening challenges with drought-resistant plants, efficient watering systems, and heat stress management for thriving gardens.',
        content_ideas: [
          'Drought-resistant plant varieties',
          'Efficient irrigation systems',
          'Heat stress management',
          'Summer mulching techniques'
        ]
      }
    ];
  } else if (month >= 9 && month <= 11) {
    // Autumn themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Autumn Garden Harvest - Week ${currentWeek}`,
        description: 'Embrace fall\'s bounty with harvest preservation, autumn color displays, and winter preparation activities that celebrate the season\'s abundance.',
        content_ideas: [
          'Fall harvest and preservation',
          'Autumn color plant displays',
          'Winter garden preparation',
          'Fall planting opportunities'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Fall Planting & Preparation`,
        description: 'Maximize fall planting opportunities and prepare gardens for winter with strategic plantings, soil care, and protection strategies.',
        content_ideas: [
          'Fall bulb planting schedules',
          'Winter vegetable gardens',
          'Soil preparation for spring',
          'Plant protection strategies'
        ]
      }
    ];
  } else {
    // Winter themes
    seasonalThemes = [
      {
        week: currentWeek,
        title: `Winter Garden Planning - Week ${currentWeek}`,
        description: 'Transform winter into productive planning time with indoor gardening, tool maintenance, and next year\'s garden design and preparation.',
        content_ideas: [
          'Indoor gardening and houseplants',
          'Garden planning and design',
          'Tool maintenance and care',
          'Seed catalog and variety selection'
        ]
      },
      {
        week: currentWeek + 1,
        title: `Indoor Growing & Planning`,
        description: 'Focus on indoor growing opportunities and strategic planning with houseplant care, seed starting preparation, and garden design for the upcoming season.',
        content_ideas: [
          'Houseplant care and propagation',
          'Seed starting preparation',
          'Garden design planning',
          'Winter growing techniques'
        ]
      }
    ];
  }
  
  return seasonalThemes;
};
