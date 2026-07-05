import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// ─── Product Categories & Products ────────────────────────────────────────────

async function seedProductCategories() {
  const existing = await prisma.productCategory.count();
  if (existing > 0) return;

  const categories = [
    { name: "Protein", slug: "protein", description: "Plant-based protein powders and BCAAs", sortOrder: 1 },
    { name: "Supplements", slug: "supplements", description: "Essential vitamins and minerals for vegans", sortOrder: 2 },
    { name: "Superfoods", slug: "superfoods", description: "Nutrient-dense whole food powders", sortOrder: 3 },
    { name: "Snacks", slug: "snacks", description: "Healthy vegan snacks and energy bites", sortOrder: 4 },
    { name: "Beverages", slug: "beverages", description: "Cold-pressed juices and functional drinks", sortOrder: 5 },
  ];

  await prisma.productCategory.createMany({ data: categories });
  console.log("[seed] Created 5 product categories");
}

async function seedProducts() {
  const existing = await prisma.product.count();
  if (existing > 0) return;

  const categories = await prisma.productCategory.findMany();
  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const products = [
    {
      categoryId: bySlug["protein"],
      name: "Plant Power Protein — Chocolate",
      slug: "plant-power-protein-chocolate",
      description:
        "Premium pea & rice protein blend with 25g protein per serving. Rich chocolate flavor, smooth texture, zero bloating.",
      price: 39.99,
      comparePrice: 49.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1622485831930-34643eddefd7?w=600&h=450&fit=crop",
      ],
      tags: ["25g Protein", "Low Sugar", "Soy Free", "Non-GMO"],
      status: "ACTIVE" as const,
      stock: 120,
      isVegan: true,
      isFeatured: true,
    },
    {
      categoryId: bySlug["supplements"],
      name: "Omega-3 DHA+EPA Algae Capsules",
      slug: "omega-3-dha-epa-algae-capsules",
      description:
        "Sustainably sourced algae-based Omega-3. 500mg DHA + 250mg EPA per capsule. No fish, no mercury.",
      price: 29.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&h=450&fit=crop",
      ],
      tags: ["Algae-Based", "Mercury Free", "Sustainable", "60 Capsules"],
      status: "ACTIVE" as const,
      stock: 85,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["superfoods"],
      name: "Organic Spirulina Powder",
      slug: "organic-spirulina-powder",
      description:
        "Pure organic spirulina packed with iron, B-vitamins, and complete protein. Add to smoothies or energy bowls.",
      price: 24.99,
      comparePrice: 29.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=600&h=450&fit=crop",
      ],
      tags: ["65% Protein", "Iron Rich", "Organic", "200g"],
      status: "ACTIVE" as const,
      stock: 64,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["protein"],
      name: "Vegan BCAA Recovery Mix",
      slug: "vegan-bcaa-recovery-mix",
      description:
        "Fermented plant-based BCAAs in a 2:1:1 ratio. Tropical mango flavor. Supports muscle recovery.",
      price: 34.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1593095948071-474c5cc2c7c8?w=600&h=450&fit=crop",
      ],
      tags: ["2:1:1 Ratio", "Fermented", "30 Servings", "Mango"],
      status: "ACTIVE" as const,
      stock: 97,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["snacks"],
      name: "Raw Cacao Energy Bites (12pk)",
      slug: "raw-cacao-energy-bites-12pk",
      description:
        "Delicious raw cacao energy bites made with dates, almonds, cacao, and coconut. No added sugar.",
      price: 18.99,
      comparePrice: 22.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=600&h=450&fit=crop",
      ],
      tags: ["No Added Sugar", "12 Bites", "Raw", "Gluten Free"],
      status: "ACTIVE" as const,
      stock: 200,
      isVegan: true,
      isFeatured: true,
    },
    {
      categoryId: bySlug["supplements"],
      name: "Vitamin B12 Methylcobalamin",
      slug: "vitamin-b12-methylcobalamin",
      description:
        "High-potency methylcobalamin B12 — the most bioavailable form. 1000mcg per tablet. 90-day supply.",
      price: 15.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&h=450&fit=crop",
      ],
      tags: ["1000mcg", "Methylcobalamin", "90 Tablets", "Essential"],
      status: "ACTIVE" as const,
      stock: 310,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["protein"],
      name: "Plant Power Protein — Vanilla",
      slug: "plant-power-protein-vanilla",
      description:
        "Smooth vanilla bean protein with 25g protein from pea and brown rice. Naturally sweetened with stevia.",
      price: 39.99,
      comparePrice: 49.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1627735747015-a4e0b535eff0?w=600&h=450&fit=crop",
      ],
      tags: ["25g Protein", "Stevia", "Pea + Rice", "Non-GMO"],
      status: "ACTIVE" as const,
      stock: 108,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["beverages"],
      name: "Cold-Pressed Green Juice (6pk)",
      slug: "cold-pressed-green-juice-6pk",
      description:
        "Cold-pressed blend of kale, spinach, celery, cucumber, apple, and ginger. 6 bottles, refrigerated.",
      price: 42.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600&h=450&fit=crop",
      ],
      tags: ["Cold-Pressed", "6 Bottles", "No Preservatives", "Organic"],
      status: "ACTIVE" as const,
      stock: 45,
      isVegan: true,
      isFeatured: true,
    },
    {
      categoryId: bySlug["supplements"],
      name: "Ashwagandha + Rhodiola Complex",
      slug: "ashwagandha-rhodiola-complex",
      description:
        "Adaptogenic stress-relief combining KSM-66 Ashwagandha and Rhodiola Rosea. Supports cortisol balance.",
      price: 27.99,
      comparePrice: 32.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&h=450&fit=crop",
      ],
      tags: ["KSM-66", "Adaptogenic", "60 Capsules", "Stress Relief"],
      status: "ACTIVE" as const,
      stock: 73,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["superfoods"],
      name: "Organic Maca Root Powder",
      slug: "organic-maca-root-powder",
      description:
        "Premium gelatinized maca root for better absorption. Supports energy, hormonal balance, and endurance.",
      price: 19.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&h=450&fit=crop",
      ],
      tags: ["Gelatinized", "Energy Boost", "Organic", "250g"],
      status: "ACTIVE" as const,
      stock: 91,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["snacks"],
      name: "Protein Peanut Butter Cups (8pk)",
      slug: "protein-peanut-butter-cups-8pk",
      description:
        "Dark chocolate peanut butter cups with 8g protein each. Made with organic cacao. Guilt-free.",
      price: 14.99,
      comparePrice: null,
      imageUrls: [
        "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&h=450&fit=crop",
      ],
      tags: ["8g Protein", "Dark Chocolate", "8 Cups", "Low Sugar"],
      status: "ACTIVE" as const,
      stock: 185,
      isVegan: true,
      isFeatured: false,
    },
    {
      categoryId: bySlug["supplements"],
      name: "Vegan Vitamin D3 + K2 Drops",
      slug: "vegan-vitamin-d3-k2-drops",
      description:
        "Lichen-derived Vitamin D3 with K2 (MK-7) for optimal calcium absorption. Liquid drops.",
      price: 21.99,
      comparePrice: 26.99,
      imageUrls: [
        "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&h=450&fit=crop",
      ],
      tags: ["Lichen D3", "K2 MK-7", "60ml Drops", "Vegan"],
      status: "ACTIVE" as const,
      stock: 142,
      isVegan: true,
      isFeatured: true,
    },
  ];

  await prisma.product.createMany({ data: products });
  console.log(`[seed] Created ${products.length} products`);
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

async function seedRecipes() {
  const existing = await prisma.recipe.count();
  if (existing > 0) return;

  const recipes = [
    {
      name: "High-Protein Tofu Scramble",
      image:
        "https://images.unsplash.com/photo-1546007600-8c2e5a9b8ea7?auto=format&fit=crop&w=800&q=80",
      category: "MUSCLE_BUILD" as const,
      description:
        "A protein-packed vegan breakfast scramble with firm tofu, turmeric, nutritional yeast, and fresh vegetables.",
      ingredients: [
        "400g firm tofu, crumbled",
        "1 tbsp olive oil",
        "1/2 tsp turmeric",
        "2 tbsp nutritional yeast",
        "1 cup baby spinach",
        "1/2 red bell pepper, diced",
        "Salt and pepper to taste",
        "2 slices sourdough toast",
        "1 ripe avocado",
      ],
      steps: [
        "Heat olive oil in a non-stick pan over medium heat.",
        "Add crumbled tofu and cook for 3-4 minutes.",
        "Stir in turmeric, nutritional yeast, salt, and pepper.",
        "Add spinach and bell pepper; cook until wilted.",
        "Toast sourdough bread. Smash avocado with salt and lemon.",
        "Serve scramble on toast topped with smashed avocado.",
      ],
      calories: 380,
      protein: 24,
      carbs: 30,
      fats: 12,
      isCheatMeal: false,
    },
    {
      name: "Quinoa Buddha Bowl",
      image:
        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
      category: "LIFESTYLE" as const,
      description:
        "A balanced and colourful bowl packed with roasted chickpeas, quinoa, sweet potato, and lemon tahini dressing.",
      ingredients: [
        "1 cup cooked quinoa",
        "1 can chickpeas, rinsed",
        "1 medium sweet potato, cubed",
        "2 cups kale, massaged",
        "1 cup red cabbage, shredded",
        "2 tbsp tahini",
        "1 lemon, juiced",
        "1 garlic clove, minced",
        "1 tbsp olive oil",
      ],
      steps: [
        "Preheat oven to 200°C. Toss chickpeas and sweet potato with olive oil and roast 25 min.",
        "Cook quinoa according to package instructions.",
        "Whisk tahini, lemon juice, garlic, and 2 tbsp water for dressing.",
        "Assemble bowl with quinoa, kale, cabbage, roasted chickpeas, and sweet potato.",
        "Drizzle with tahini dressing and serve.",
      ],
      calories: 450,
      protein: 18,
      carbs: 60,
      fats: 14,
      isCheatMeal: false,
    },
    {
      name: "Chickpea Curry Bowl",
      image:
        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
      category: "LIFESTYLE" as const,
      description:
        "A warming, spiced chickpea curry with coconut milk and tomatoes. Served over basmati rice.",
      ingredients: [
        "2 cans chickpeas, drained",
        "1 can coconut milk",
        "1 can diced tomatoes",
        "1 onion, diced",
        "3 garlic cloves, minced",
        "1 tbsp curry powder",
        "1 tsp garam masala",
        "1 tsp cumin",
        "2 cups basmati rice, cooked",
        "Fresh coriander to garnish",
      ],
      steps: [
        "Sauté onion and garlic in oil until softened, about 5 minutes.",
        "Add curry powder, garam masala, and cumin; cook 1 minute.",
        "Add chickpeas, tomatoes, and coconut milk. Stir well.",
        "Simmer on low heat for 20 minutes until thickened.",
        "Serve over basmati rice garnished with fresh coriander.",
      ],
      calories: 420,
      protein: 15,
      carbs: 65,
      fats: 12,
      isCheatMeal: false,
    },
    {
      name: "Green Protein Smoothie",
      image:
        "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=800&q=80",
      category: "MUSCLE_BUILD" as const,
      description:
        "A quick pre- or post-workout smoothie loaded with plant protein, greens, and natural energy.",
      ingredients: [
        "1 scoop plant protein powder (vanilla)",
        "1 frozen banana",
        "1 tbsp peanut butter",
        "250ml oat milk",
        "1 handful baby spinach",
        "1/2 tsp spirulina powder",
        "Ice cubes",
      ],
      steps: [
        "Add all ingredients to a high-speed blender.",
        "Blend for 60 seconds until completely smooth.",
        "Taste and adjust sweetness with a Medjool date if needed.",
        "Pour into a glass and serve immediately.",
      ],
      calories: 280,
      protein: 20,
      carbs: 30,
      fats: 8,
      isCheatMeal: false,
    },
    {
      name: "Lentil Shepherd's Pie",
      image:
        "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80",
      category: "MUSCLE_BUILD" as const,
      description:
        "A hearty plant-based shepherd's pie with a rich red lentil and mushroom filling topped with creamy mash.",
      ingredients: [
        "1.5 cups red lentils",
        "250g mushrooms, chopped",
        "1 onion, diced",
        "2 carrots, diced",
        "2 garlic cloves",
        "1 can diced tomatoes",
        "1 cup vegetable stock",
        "1 tsp thyme",
        "800g potatoes, peeled and boiled",
        "3 tbsp plant butter",
        "100ml oat milk",
      ],
      steps: [
        "Cook lentils in stock for 15 minutes until soft.",
        "Sauté onion, garlic, carrots, and mushrooms until softened.",
        "Combine lentils, vegetables, tomatoes, and thyme. Season well.",
        "Mash potatoes with plant butter and oat milk until creamy.",
        "Transfer lentil filling to baking dish, top with mash.",
        "Bake at 190°C for 25 minutes until golden. Rest 5 minutes before serving.",
      ],
      calories: 420,
      protein: 22,
      carbs: 55,
      fats: 10,
      isCheatMeal: false,
    },
    {
      name: "Protein Pancakes",
      image:
        "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=800&q=80",
      category: "MUSCLE_BUILD" as const,
      description:
        "Fluffy high-protein vegan pancakes made with oat flour and plant protein. Perfect post-workout breakfast.",
      ingredients: [
        "1 cup oat flour",
        "1 scoop vanilla plant protein powder",
        "1 tsp baking powder",
        "1 tbsp ground flaxseed + 3 tbsp water (flax egg)",
        "200ml oat milk",
        "1 tbsp maple syrup",
        "1 tsp vanilla extract",
        "Pinch of salt",
        "Fresh berries and maple syrup to serve",
      ],
      steps: [
        "Mix flaxseed and water; let sit 5 minutes to gel.",
        "Combine oat flour, protein powder, baking powder, and salt.",
        "Whisk in oat milk, maple syrup, vanilla, and flax egg.",
        "Rest batter 3 minutes. Heat lightly oiled pan on medium.",
        "Pour 1/4 cup batter per pancake. Cook 2-3 min per side.",
        "Serve stacked with fresh berries and a drizzle of maple syrup.",
      ],
      calories: 340,
      protein: 26,
      carbs: 35,
      fats: 8,
      isCheatMeal: false,
    },
  ];

  await prisma.recipe.createMany({ data: recipes });
  console.log(`[seed] Created ${recipes.length} recipes`);
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

async function seedWorkouts() {
  const existing = await prisma.workout.count();
  if (existing > 0) return;

  const workouts = [
    {
      title: "Vegan Strength Builder — Upper Body",
      description:
        "Compound & isolation movements targeting chest, back, shoulders, and arms. Includes warm-up and cooldown. 6 exercises, 4 sets.",
      type: "GYM" as const,
      goal: "MUSCLE_BUILD" as const,
      durationMin: 45,
      level: "Intermediate",
      imageUrl:
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=340&fit=crop",
      rating: 4.8,
    },
    {
      title: "Fat-Burning HIIT Circuit",
      description:
        "High-intensity intervals with bodyweight movements. No equipment needed. Burns up to 500 calories in 30 minutes. 8 exercises, 3 rounds.",
      type: "HOME" as const,
      goal: "FAT_LOSS" as const,
      durationMin: 30,
      level: "Advanced",
      imageUrl:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=340&fit=crop",
      rating: 4.9,
    },
    {
      title: "Morning Yoga Flow for Athletes",
      description:
        "Dynamic stretching and yoga poses to improve flexibility, prevent injuries, and enhance recovery between training days. 12 poses, 1 flow.",
      type: "HOME" as const,
      goal: "LIFESTYLE" as const,
      durationMin: 25,
      level: "Beginner",
      imageUrl:
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=340&fit=crop",
      rating: 4.7,
    },
    {
      title: "Leg Day Destroyer",
      description:
        "Heavy squats, lunges, and deadlifts to build powerful legs. Includes progressive overload guidance for vegan athletes. 7 exercises, 4 sets.",
      type: "GYM" as const,
      goal: "MUSCLE_BUILD" as const,
      durationMin: 50,
      level: "Intermediate",
      imageUrl:
        "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&h=340&fit=crop",
      rating: 4.8,
    },
    {
      title: "Endurance Run Program — Week 1",
      description:
        "Progressive running program for building cardiovascular endurance. Includes interval training and steady-state runs. 5 sessions/week, 8-week program.",
      type: "HOME" as const,
      goal: "FAT_LOSS" as const,
      durationMin: 40,
      level: "All Levels",
      imageUrl:
        "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&h=340&fit=crop",
      rating: 4.6,
    },
    {
      title: "No-Equipment Home Workout",
      description:
        "Full body workout using only bodyweight. Perfect for travel, home training, or when you can't make it to the gym. 10 exercises, 2 rounds.",
      type: "HOME" as const,
      goal: "LIFESTYLE" as const,
      durationMin: 20,
      level: "Beginner",
      imageUrl:
        "https://images.unsplash.com/photo-1597452485669-2c7bb5fef90d?w=600&h=340&fit=crop",
      rating: 4.9,
    },
  ];

  await prisma.workout.createMany({ data: workouts });
  console.log(`[seed] Created ${workouts.length} workouts`);
}

// ─── Gym Trainer Catalog ───────────────────────────────────────────────────────

async function seedGymTrainerCatalog() {
  const existing = await prisma.gymTrainer.count();
  if (existing > 0) return;

  await prisma.gymTrainer.createMany({
    data: [
      {
        name: "Jordan Kim",
        title: "Strength & mobility",
        bio: "Competition prep and sustainable vegan strength.",
        imageUrl:
          "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80",
        sortOrder: 1,
      },
      {
        name: "Sam Rivera",
        title: "Hypertrophy & rehab",
        bio: "Joint-friendly progressions and weekly check-ins.",
        imageUrl:
          "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=400&q=80",
        sortOrder: 2,
      },
      {
        name: "Alex Morgan",
        title: "Performance nutrition",
        bio: "Plant-first fueling for heavy training blocks.",
        imageUrl:
          "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80",
        sortOrder: 3,
      },
    ],
  });
  console.log("[seed] Created 3 gym trainers");
}

// ─── Demo Trainer User ────────────────────────────────────────────────────────

async function linkDemoTrainerUser() {
  if (process.env.VEGANFIT_SKIP_TRAINER_LINK === "true") {
    console.log("[seed] Skipping trainer user link (VEGANFIT_SKIP_TRAINER_LINK=true)");
    return;
  }

  const email = (
    process.env.VEGANFIT_SEED_TRAINER_EMAIL || "trainer@veganfit.dev"
  )
    .toLowerCase()
    .trim();
  const plainPassword =
    process.env.VEGANFIT_SEED_TRAINER_PASSWORD || "ChangeMeTrainer!24";

  const primary = await prisma.gymTrainer.findFirst({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (!primary) {
    console.warn("[seed] No GymTrainer rows — run catalog seed first.");
    return;
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await hash(plainPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        name: "Demo Gym Trainer",
        role: "GYM_TRAINER",
        onboardingDone: true,
        passwordHash,
        goal: "MUSCLE_BUILD",
        gender: "OTHER",
        activityLevel: "MODERATE",
        heightCm: 175,
        weightKg: 75,
        age: 32,
      },
    });
    console.log(
      `[seed] Created trainer user ${email} (role GYM_TRAINER). Password from env or default dev password.`
    );
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: "GYM_TRAINER" },
    });
    console.log(
      `[seed] Existing user ${email} promoted to GYM_TRAINER (password unchanged).`
    );
  }

  await prisma.$transaction([
    prisma.gymTrainer.updateMany({
      where: { linkedUserId: user.id },
      data: { linkedUserId: null },
    }),
    prisma.gymTrainer.update({
      where: { id: primary.id },
      data: { linkedUserId: user.id },
    }),
  ]);

  console.log(
    `[seed] Linked catalog trainer "${primary.name}" (id ${primary.id}) → User ${user.id}.`
  );
}

// ─── Admin User ───────────────────────────────────────────────────────────────

async function seedAdminUser() {
  if (process.env.VEGANFIT_SKIP_ADMIN_SEED === "true") {
    console.log("[seed] Skipping admin user (VEGANFIT_SKIP_ADMIN_SEED=true)");
    return;
  }

  const email = (
    process.env.VEGANFIT_SEED_ADMIN_EMAIL || "admin@veganfit.dev"
  )
    .toLowerCase()
    .trim();
  const plainPassword =
    process.env.VEGANFIT_SEED_ADMIN_PASSWORD || "ChangeMeAdmin!24";

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await hash(plainPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        name: "Platform Admin",
        role: "ADMIN",
        onboardingDone: true,
        passwordHash,
        goal: "LIFESTYLE",
        gender: "OTHER",
        activityLevel: "MODERATE",
        heightCm: 170,
        weightKg: 70,
        age: 30,
      },
    });
    console.log(
      `[seed] Created admin user ${email} (role ADMIN). Password from env or default dev password.`
    );
  } else if (user.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    console.log(
      `[seed] Promoted existing user ${email} to ADMIN (password unchanged).`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[seed] Starting...");
  await seedProductCategories();
  await seedProducts();
  await seedRecipes();
  await seedWorkouts();
  await seedGymTrainerCatalog();
  await linkDemoTrainerUser();
  await seedAdminUser();
  console.log("[seed] Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
