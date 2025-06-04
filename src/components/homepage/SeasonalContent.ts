

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
          content: `🌸 Spring has officially sprung at Green Thumb Garden Center, and we couldn't be more excited to share this magical season with you! Our greenhouse is absolutely bursting with fresh seedlings, vibrant annuals, and everything you need to transform your outdoor space into a spring paradise.

Whether you're a seasoned gardener or just starting your green journey, our expert team is here to guide you through selecting the perfect plants for your unique space and growing conditions. From colorful pansies and cheerful marigolds to hardy perennials that will return year after year, we've carefully curated a selection that thrives in our local climate.

This week, we're featuring our premium organic soil amendments and natural fertilizers that will give your plants the nutrients they need to flourish. Plus, don't miss our Spring Plant Sale happening all month long - it's the perfect time to stock up on your garden favorites!

What's first on your spring planting list? Drop a comment below and let us know what you're most excited to grow this season! 🌱✨

#SpringGardening #FreshStart #GreenThumb #PlantLovers #SpringSale #OrganicGardening #LocalNursery #GardenLife`,
          hashtags: '#SpringGardening #FreshStart #GreenThumb #PlantLovers #SpringSale #OrganicGardening #LocalNursery #GardenLife',
          imageIdea: 'Colorful spring flowers display in greenhouse with customers browsing'
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
          content: `🌿 Ever wondered what happens behind the scenes at Green Thumb Garden Center? Let us take you on a journey through our morning routine! Every single day starts before dawn, when our dedicated team arrives to care for thousands of plants that call our nursery home.

From carefully watering delicate seedlings to arranging stunning displays that inspire your garden dreams, every detail matters in creating the exceptional garden center experience you've come to love. We check soil moisture, adjust lighting, monitor temperatures, and ensure each plant receives the individual attention it deserves.

Our team's passion for plants shines through in everything we do - whether it's propagating new varieties, creating seasonal displays, or sharing expert advice with fellow plant enthusiasts like you. We believe that gardening is more than just a hobby; it's a way to connect with nature, create beauty, and nurture life.

Thank you for supporting our local, family-owned business and being part of our growing garden community. Your enthusiasm for plants and gardening motivates us every day to continue providing the highest quality plants and unmatched customer service! 🙏💚

#BehindTheScenes #LocalBusiness #PlantCare #TeamWork #GardenCenter #PlantPassion #CommunitySupport #FamilyOwned`,
          hashtags: '#BehindTheScenes #LocalBusiness #PlantCare #TeamWork #GardenCenter #PlantPassion #CommunitySupport #FamilyOwned',
          imageIdea: 'Staff watering plants in early morning light with mist and golden hour atmosphere'
        }
      ]
    };
  } else if (month >= 6 && month <= 8) {
    // Summer content
    return {
      posts: [
        {
          type: 'instagram',
          content: `☀️ Summer heat got you worried about your garden? Don't sweat it! Our incredible collection of drought-resistant beauties are here to save the day and keep your outdoor space looking absolutely stunning even during the hottest months of the year.

These hardy perennials, succulents, and heat-loving annuals are nature's champions - they've evolved to thrive in challenging conditions while still providing the color, texture, and beauty you want in your garden. From striking agaves and colorful sedums to vibrant lantana and resilient lavender, these plants prove that water-wise doesn't mean sacrificing style.

Our gardening experts have hand-selected varieties that not only survive but actually flourish in summer heat, requiring minimal water once established. This means more time enjoying your garden and less time worrying about water bills or plant stress!

Stop by this week for personalized advice on creating a drought-resistant garden that works with your specific space, soil, and style preferences. We'll help you design a landscape that's both environmentally responsible and absolutely gorgeous! 🌵🏜️

#SummerGardening #DroughtResistant #HeatTolerant #WaterWise #SustainableGardening #XericGardening #LowMaintenance #EcoFriendly`,
          hashtags: '#SummerGardening #DroughtResistant #HeatTolerant #WaterWise #SustainableGardening #XericGardening #LowMaintenance #EcoFriendly',
          imageIdea: 'Display of drought-resistant plants and succulents in summer garden setting'
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
          content: `🦋 Our pollinator garden is absolutely buzzing with activity, and we couldn't be happier about it! This special section of our garden center showcases the incredible power of bee-friendly plants to transform any space into a thriving ecosystem that supports our precious local pollinators.

These carefully selected plants don't just provide essential nectar and pollen for bees, butterflies, and other beneficial insects - they also add incredible beauty, intoxicating fragrance, and year-round interest to your garden. From early spring crocuses to late-season asters, there's always something blooming to keep our pollinator friends happy and well-fed.

Creating a pollinator garden is one of the most rewarding ways to garden with purpose. You'll be amazed at the increased activity in your garden as it becomes a hub for beneficial insects that help pollinate your vegetables, fruits, and flowering plants. Plus, there's nothing quite like the peaceful buzz of happy bees and the graceful dance of butterflies to make your outdoor space feel truly alive!

Which bee-friendly beauties are you planning to add to your garden this year? We'd love to help you create your own pollinator paradise! 🐝🌼

#PollinatorGarden #BeesFriendly #EcoGardening #Biodiversity #SustainableGardening #NativePlants #PollinatorSupport #GardenWithPurpose`,
          hashtags: '#PollinatorGarden #BeesFriendly #EcoGardening #Biodiversity #SustainableGardening #NativePlants #PollinatorSupport #GardenWithPurpose',
          imageIdea: 'Bees and butterflies on flowering plants with vibrant blooms'
        }
      ]
    };
  } else if (month >= 9 && month <= 11) {
    // Fall content
    return {
      posts: [
        {
          type: 'instagram',
          content: `🍂 Fall is absolutely nature's grand finale, and right now our garden center is putting on the most spectacular show of the year! Our stunning mums in every shade imaginable, gorgeous asters painting the landscape in purples and whites, and vibrant ornamental kales are creating a breathtaking autumn display that celebrates the season in all its glory.

But here's a secret that many gardeners don't know: fall is actually one of THE BEST times to plant trees and shrubs! While everyone else is thinking about winding down their gardening for the year, smart gardeners are taking advantage of cooler temperatures and autumn rains to establish new plantings that will have months to develop strong root systems before next summer's heat arrives.

Our fall selection includes everything from classic shade trees that will provide years of beauty and cooling comfort, to flowering shrubs that will welcome spring with early blooms, to evergreens that add structure and winter interest to your landscape. The cooler weather means less stress on newly planted specimens, and fall's natural moisture helps them establish more easily than summer plantings.

What fall colors are calling to your garden this year? Come explore our autumn wonderland and discover the perfect additions to your landscape! 🌳🍁

#FallColors #Mums #TreePlanting #AutumnGarden #LandscapePlanting #FallPlanting #SeasonalGardening #GardenDesign`,
          hashtags: '#FallColors #Mums #TreePlanting #AutumnGarden #LandscapePlanting #FallPlanting #SeasonalGardening #GardenDesign',
          imageIdea: 'Colorful fall mums and ornamental plants display with autumn trees in background'
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
          content: `🎃 There's truly nothing quite like the satisfaction of going from garden to table with your own homegrown harvest! Right now, our seasonal vegetable section is overflowing with the most beautiful fall produce that's perfect for all your autumn cooking adventures - from hearty soups and roasted vegetable medleys to festive holiday centerpieces.

Our fresh winter squash varieties offer incredible versatility in the kitchen, whether you're making creamy butternut squash soup, roasted delicata squash rings, or stuffed acorn squash for a show-stopping dinner. The pumpkins aren't just for carving - they make incredible pies, breads, and savory dishes that celebrate the season's bounty.

And don't overlook those late-season tomatoes! While the summer varieties are winding down, our fall tomatoes are still producing incredible flavor that's perfect for green tomato recipes, end-of-season salsas, and preserving the last taste of summer.

Growing your own food connects you to the seasons, provides unmatched freshness and flavor, and creates a sense of accomplishment that no store-bought produce can match. What's growing in your fall garden right now? We'd love to see your harvest photos! 🥕🌽

#HarvestSeason #VegetableGarden #FreshProduce #FallHarvest #GrowYourOwn #GardenToTable #SeasonalEating #HomegrownGoodness`,
          hashtags: '#HarvestSeason #VegetableGarden #FreshProduce #FallHarvest #GrowYourOwn #GardenToTable #SeasonalEating #HomegrownGoodness',
          imageIdea: 'Basket of fresh fall vegetables and pumpkins in rustic garden setting'
        }
      ]
    };
  } else {
    // Winter content
    return {
      posts: [
        {
          type: 'instagram',
          content: `❄️ Think winter means your garden has to disappear until spring? Think again! Winter gardening is one of our absolute favorite topics because there are so many ways to keep beauty, color, and life thriving in your outdoor space even during the coldest months of the year.

Our carefully selected evergreens provide the backbone of winter interest - from towering spruces and fragrant pines to compact junipers and elegant hollies. These year-round champions don't just survive winter; they define it with their rich textures, varied forms, and steadfast presence that creates structure in your landscape when everything else has gone dormant.

But evergreens are just the beginning! Winter berries add pops of brilliant color against snowy backdrops - think bright red winterberry holly, orange persimmon fruits, and deep purple beautyberry clusters. Cold-hardy ornamental grasses sway gracefully in winter breezes, their golden and bronze plumes catching light and adding movement to the winter garden.

And here's the perfect time for the most important garden task of all: planning next year's garden! Winter's quiet months are ideal for dreaming, researching, and designing the garden transformations you want to make when spring returns. ❄️🌲

#WinterGarden #Evergreens #GardenPlanning #WinterBeauty #SeasonalInterest #WinterLandscape #GardenDesign #YearRoundGarden`,
          hashtags: '#WinterGarden #Evergreens #GardenPlanning #WinterBeauty #SeasonalInterest #WinterLandscape #GardenDesign #YearRoundGarden',
          imageIdea: 'Evergreen plants and winter berry displays with snow accents'
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
          content: `🪴 Winter doesn't have to mean saying goodbye to your green friends! In fact, it's the perfect time to fall in love with houseplants and create an indoor jungle that brings life, color, and fresh air into your home during the colder months. Our houseplant collection is absolutely thriving right now, and we're here to help you discover the joy of indoor gardening!

These amazing green beauties do so much more than just look gorgeous (though they definitely do that!). They're working around the clock to purify your indoor air, removing toxins and releasing fresh oxygen that makes your home healthier and more comfortable. Studies have shown that houseplants can reduce stress, boost creativity, and even improve your mood during the darker winter months.

From low-light champions like pothos and snake plants that thrive in any corner, to statement-making fiddle leaf figs and dramatic monstera deliciosas, there's a perfect plant personality for every space and every skill level. Whether you're a complete beginner or a seasoned plant parent, we love helping you find the ideal green companions for your home.

Which houseplants are currently brightening your winter days? And if you're new to indoor gardening, what questions can we answer to help you get started? 🌿✨

#Houseplants #IndoorGardening #WinterGreen #PlantParent #IndoorJungle #AirPurifyingPlants #PlantTherapy #WinterWellness`,
          hashtags: '#Houseplants #IndoorGardening #WinterGreen #PlantParent #IndoorJungle #AirPurifyingPlants #PlantTherapy #WinterWellness',
          imageIdea: 'Variety of healthy houseplants in cozy winter home setting'
        }
      ]
    };
  }
};

