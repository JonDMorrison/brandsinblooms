
export const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return { emoji: "🌸", text: "Spring is here!" };
  if (month >= 6 && month <= 8) return { emoji: "☀️", text: "Summer vibes!" };
  if (month >= 9 && month <= 11) return { emoji: "🍂", text: "Fall beauty!" };
  return { emoji: "❄️", text: "Winter magic!" };
};

export const getSeasonalContent = () => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 3 && month <= 5) {
    // Spring content
    return {
      posts: [
        {
          type: 'instagram',
          content: `🌸 Spring has sprung at Green Thumb! Our greenhouse is bursting with fresh seedlings, vibrant annuals, and everything you need for your spring garden. What's first on your planting list? #SpringGardening #FreshStart #GreenThumb`,
          hashtags: '#SpringGardening #FreshStart #GreenThumb #PlantLovers #SpringSale',
          imageIdea: 'Colorful spring flowers display in greenhouse'
        },
        {
          type: 'facebook',
          content: `🌱 Spring Gardening Workshop this Saturday! Join our experts as we share tips for preparing your garden beds, choosing the right plants for your space, and getting the most out of your spring planting. Register now - limited spots available!`,
          hashtags: '#SpringWorkshop #GardeningTips #CommunityEvent',
          imageIdea: 'Workshop setup with gardening tools and soil'
        },
        {
          type: 'email',
          content: `Subject: Your Spring Garden Awaits! 🌻\n\nDear Garden Enthusiasts,\n\nSpring is the perfect time to transform your outdoor space! This week we're featuring our premium soil amendments, organic fertilizers, and a stunning selection of spring perennials. Plus, don't miss our Spring Plant Sale happening all month long.`,
          hashtags: '#SpringNewsletter #PlantSale #GardeningTips',
          imageIdea: 'Newsletter header with spring garden scene'
        },
        {
          type: 'instagram',
          content: `🌿 Behind the scenes: Our team starts each morning caring for thousands of plants! From watering seedlings to arranging displays, every detail matters in creating your perfect garden center experience. Thank you for supporting local! #BehindTheScenes #LocalBusiness #PlantCare`,
          hashtags: '#BehindTheScenes #LocalBusiness #PlantCare #TeamWork',
          imageIdea: 'Staff watering plants in early morning light'
        }
      ]
    };
  } else if (month >= 6 && month <= 8) {
    // Summer content
    return {
      posts: [
        {
          type: 'instagram',
          content: `☀️ Beat the summer heat with our drought-resistant beauties! These hardy perennials and succulents will keep your garden thriving even in the hottest weather. Stop by for expert advice on summer gardening! #SummerGardening #DroughtResistant #HeatTolerant`,
          hashtags: '#SummerGardening #DroughtResistant #HeatTolerant #WaterWise',
          imageIdea: 'Display of drought-resistant plants and succulents'
        },
        {
          type: 'facebook',
          content: `🌻 Summer Herb Workshop Series continues this week! Learn how to grow, harvest, and preserve herbs from your garden. This week we're focusing on basil, oregano, and summer savory. Perfect timing for your summer cooking!`,
          hashtags: '#HerbWorkshop #SummerHerbs #CookingWithHerbs',
          imageIdea: 'Fresh herbs arranged for cooking demonstration'
        },
        {
          type: 'email',
          content: `Subject: Summer Garden Care Made Easy! 🌞\n\nHello Green Thumbs!\n\nSummer gardening doesn't have to be a struggle! Our latest newsletter features water-saving tips, pest management strategies, and the best plants for summer containers. Keep your garden beautiful all season long.`,
          hashtags: '#SummerCare #WaterSaving #ContainerGardening',
          imageIdea: 'Summer container garden arrangements'
        },
        {
          type: 'instagram',
          content: `🦋 Our pollinator garden is buzzing with activity! These bee-friendly plants not only support our local ecosystem but add incredible beauty and fragrance to any space. Which pollinator plants are you growing this year? #PollinatorGarden #BeesFriendly #EcoGardening`,
          hashtags: '#PollinatorGarden #BeesFriendly #EcoGardening #Biodiversity',
          imageIdea: 'Bees and butterflies on flowering plants'
        }
      ]
    };
  } else if (month >= 9 && month <= 11) {
    // Fall content
    return {
      posts: [
        {
          type: 'instagram',
          content: `🍂 Fall is nature's grand finale! Our mums, asters, and ornamental kales are putting on quite the show. Plus, it's the perfect time to plant trees and shrubs before winter. What fall colors are calling to you? #FallColors #Mums #TreePlanting`,
          hashtags: '#FallColors #Mums #TreePlanting #AutumnGarden',
          imageIdea: 'Colorful fall mums and ornamental plants display'
        },
        {
          type: 'facebook',
          content: `🌰 Fall Garden Prep Workshop this weekend! Learn the secrets of preparing your garden for winter, proper mulching techniques, and which plants to divide now for next year's garden. Your future self will thank you!`,
          hashtags: '#FallPrep #WinterReady #GardeningWorkshop',
          imageIdea: 'Garden tools and mulch for fall preparation'
        },
        {
          type: 'email',
          content: `Subject: Fall Into Gardening Success! 🍁\n\nDear Gardening Friends,\n\nFall is the secret season for gardeners! While others are winding down, smart gardeners are planting bulbs for spring, dividing perennials, and preparing for next year's garden. Don't miss our fall bulb sale!`,
          hashtags: '#FallBulbs #GardenPrep #SpringPlanning',
          imageIdea: 'Variety of spring bulbs for fall planting'
        },
        {
          type: 'instagram',
          content: `🎃 From garden to table! Our seasonal vegetables are perfect for your fall harvest cooking. Fresh squash, pumpkins, and late-season tomatoes - there's nothing quite like homegrown flavor. What's growing in your fall garden? #HarvestSeason #VegetableGarden #FreshProduce`,
          hashtags: '#HarvestSeason #VegetableGarden #FreshProduce #FallHarvest',
          imageIdea: 'Basket of fresh fall vegetables and pumpkins'
        }
      ]
    };
  } else {
    // Winter content
    return {
      posts: [
        {
          type: 'instagram',
          content: `❄️ Winter doesn't mean your garden has to sleep! Our evergreens, winter berries, and cold-hardy plants keep the beauty alive all season long. Plus, it's the perfect time to plan next year's garden! #WinterGarden #Evergreens #GardenPlanning`,
          hashtags: '#WinterGarden #Evergreens #GardenPlanning #WinterBeauty',
          imageIdea: 'Evergreen plants and winter berry displays'
        },
        {
          type: 'facebook',
          content: `🌲 Holiday Wreath Workshop this Saturday! Create beautiful, natural decorations using fresh evergreen boughs, berries, and pinecones from local sources. All materials provided - just bring your creativity!`,
          hashtags: '#HolidayWorkshop #WreathMaking #NaturalDecor',
          imageIdea: 'Workshop table with wreath-making materials'
        },
        {
          type: 'email',
          content: `Subject: Winter Garden Magic Awaits! ⛄\n\nWarm Greetings!\n\nWinter is the perfect time for garden planning and indoor plant care. Our houseplant collection is thriving, and we're here to help you bring green life into your home during the colder months.`,
          hashtags: '#WinterNewsletter #Houseplants #IndoorGardening',
          imageIdea: 'Cozy indoor plant display for winter'
        },
        {
          type: 'instagram',
          content: `🪴 Houseplant love in the winter months! These green beauties not only purify your air but bring life and color to your home when the outdoor garden sleeps. Which houseplants are brightening your winter days? #Houseplants #IndoorGardening #WinterGreen`,
          hashtags: '#Houseplants #IndoorGardening #WinterGreen #PlantParent',
          imageIdea: 'Variety of healthy houseplants in winter setting'
        }
      ]
    };
  }
};
