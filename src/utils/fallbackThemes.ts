
interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

export const getFallbackThemes = (): WeeklyTheme[] => {
  return [
    { 
      week: 1, 
      title: "New Year Garden Planning", 
      description: "Start the year with garden planning and goal setting. Focus on what plants and projects customers want to tackle this year.", 
      content_ideas: ["Garden planning worksheets", "Goal setting tips", "Year-round planning calendar"] 
    },
    { 
      week: 2, 
      title: "Winter Plant Care", 
      description: "Essential winter care tips for houseplants and outdoor gardens. Help customers keep their plants healthy during cold months.", 
      content_ideas: ["Winter watering schedules", "Indoor humidity tips", "Protecting outdoor plants"] 
    },
    { 
      week: 3, 
      title: "Seed Starting Prep", 
      description: "Get ready for seed starting season. Showcase supplies and techniques for starting seeds indoors.", 
      content_ideas: ["Seed starting supplies", "Timing charts", "Germination tips"] 
    },
    { 
      week: 4, 
      title: "Houseplant Spotlight", 
      description: "Feature popular houseplants perfect for winter months. Focus on low-light and air-purifying varieties.", 
      content_ideas: ["Plant care guides", "Air-purifying plants", "Low-light options"] 
    },
    { 
      week: 5, 
      title: "Garden Tool Maintenance", 
      description: "Winter is perfect for cleaning and maintaining garden tools. Share tips for tool care and storage.", 
      content_ideas: ["Tool cleaning tips", "Sharpening guides", "Storage solutions"] 
    }
  ];
};
