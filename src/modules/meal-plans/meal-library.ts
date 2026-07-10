/**
 * Curated vegan meal library the plan generator composes weeks from.
 * Macros are per single serving. Tags drive dietary filtering:
 *  - allergen tags: "soy" | "gluten" | "nuts" (excluded by soy-free etc.)
 *  - style tags:    "high-protein" | "low-carb" (used for plan scoring)
 */

export type MealSlot = "breakfast" | "snack" | "lunch" | "dinner";

export interface LibraryMeal {
  name: string;
  slot: MealSlot;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string[];
  instructions: string;
  tags: string[];
}

export const MEAL_LIBRARY: LibraryMeal[] = [
  /* ── Breakfasts ── */
  {
    name: "Protein Oatmeal with Berries",
    slot: "breakfast", calories: 420, protein: 22, carbs: 62, fat: 9, fiber: 11,
    ingredients: ["80g rolled oats", "30g pea protein powder", "150g mixed berries", "250ml soy milk", "1 tbsp chia seeds"],
    instructions: "Cook oats in soy milk, stir in protein powder off the heat, top with berries and chia.",
    tags: ["gluten", "soy", "high-protein"],
  },
  {
    name: "Tofu Scramble on Toast",
    slot: "breakfast", calories: 380, protein: 24, carbs: 38, fat: 14, fiber: 8,
    ingredients: ["200g firm tofu", "2 slices wholegrain bread", "1/2 tsp turmeric", "50g spinach", "1 tsp olive oil"],
    instructions: "Crumble tofu, fry with turmeric and spinach 5 min, serve on toasted bread.",
    tags: ["soy", "gluten", "high-protein"],
  },
  {
    name: "Chia Pudding with Mango",
    slot: "breakfast", calories: 350, protein: 12, carbs: 45, fat: 14, fiber: 13,
    ingredients: ["40g chia seeds", "250ml oat milk", "150g mango", "1 tbsp maple syrup", "20g coconut flakes"],
    instructions: "Soak chia in oat milk overnight, top with mango and coconut before serving.",
    tags: [],
  },
  {
    name: "Peanut Butter Banana Smoothie Bowl",
    slot: "breakfast", calories: 450, protein: 20, carbs: 58, fat: 16, fiber: 9,
    ingredients: ["2 bananas", "2 tbsp peanut butter", "30g soy protein", "200ml almond milk", "20g granola"],
    instructions: "Blend bananas, peanut butter, protein and milk; top with granola.",
    tags: ["nuts", "soy", "gluten", "high-protein", "comfort"],
  },
  {
    name: "Quinoa Breakfast Porridge",
    slot: "breakfast", calories: 390, protein: 14, carbs: 60, fat: 10, fiber: 8,
    ingredients: ["90g quinoa", "250ml coconut milk (light)", "1 apple, diced", "1 tsp cinnamon", "1 tbsp pumpkin seeds"],
    instructions: "Simmer quinoa in coconut milk 15 min, stir in apple and cinnamon, top with seeds.",
    tags: [],
  },
  {
    name: "Avocado Chickpea Smash Toast",
    slot: "breakfast", calories: 410, protein: 15, carbs: 44, fat: 19, fiber: 12,
    ingredients: ["1 avocado", "100g chickpeas", "2 slices sourdough", "lemon juice", "chili flakes"],
    instructions: "Mash avocado and chickpeas with lemon, pile onto toasted sourdough, finish with chili.",
    tags: ["gluten", "comfort"],
  },
  {
    name: "Buckwheat Pancakes with Berries",
    slot: "breakfast", calories: 400, protein: 13, carbs: 66, fat: 9, fiber: 8,
    ingredients: ["100g buckwheat flour", "200ml oat milk", "1 flax egg", "100g blueberries", "1 tbsp maple syrup"],
    instructions: "Whisk batter, cook 3 pancakes per side 2-3 min, serve with berries and syrup.",
    tags: ["comfort"],
  },
  {
    name: "Green Protein Smoothie",
    slot: "breakfast", calories: 320, protein: 25, carbs: 38, fat: 7, fiber: 7,
    ingredients: ["30g pea protein", "1 banana", "50g spinach", "200ml water", "1 tbsp hemp seeds"],
    instructions: "Blend everything until smooth. Best ice cold.",
    tags: ["high-protein", "low-carb"],
  },

  /* ── Snacks ── */
  {
    name: "Roasted Chickpeas",
    slot: "snack", calories: 180, protein: 9, carbs: 24, fat: 5, fiber: 7,
    ingredients: ["120g chickpeas", "1 tsp olive oil", "smoked paprika", "sea salt"],
    instructions: "Toss chickpeas with oil and spices, roast 25 min at 200°C until crispy.",
    tags: [],
  },
  {
    name: "Apple with Almond Butter",
    slot: "snack", calories: 210, protein: 6, carbs: 26, fat: 11, fiber: 6,
    ingredients: ["1 apple", "1.5 tbsp almond butter"],
    instructions: "Slice apple, dip in almond butter.",
    tags: ["nuts"],
  },
  {
    name: "Edamame with Sea Salt",
    slot: "snack", calories: 150, protein: 13, carbs: 12, fat: 6, fiber: 5,
    ingredients: ["150g edamame in pods", "sea salt"],
    instructions: "Steam edamame 5 min, sprinkle with salt.",
    tags: ["soy", "high-protein", "low-carb"],
  },
  {
    name: "Protein Energy Balls",
    slot: "snack", calories: 220, protein: 12, carbs: 22, fat: 9, fiber: 5,
    ingredients: ["40g oats", "20g pea protein", "2 tbsp peanut butter", "1 tbsp maple syrup", "10g cacao nibs"],
    instructions: "Mix, roll into 4 balls, chill 30 min.",
    tags: ["gluten", "nuts", "high-protein", "comfort"],
  },
  {
    name: "Carrot & Cucumber with Hummus",
    slot: "snack", calories: 160, protein: 6, carbs: 18, fat: 8, fiber: 6,
    ingredients: ["2 carrots", "1/2 cucumber", "60g hummus"],
    instructions: "Cut veggies into sticks, dip in hummus.",
    tags: ["low-carb"],
  },
  {
    name: "Soy Yogurt with Granola",
    slot: "snack", calories: 200, protein: 10, carbs: 26, fat: 6, fiber: 4,
    ingredients: ["150g unsweetened soy yogurt", "30g granola", "50g raspberries"],
    instructions: "Layer yogurt, granola and berries.",
    tags: ["soy", "gluten", "comfort"],
  },
  {
    name: "Rice Cakes with Avocado",
    slot: "snack", calories: 170, protein: 4, carbs: 20, fat: 9, fiber: 5,
    ingredients: ["2 rice cakes", "1/2 avocado", "cherry tomatoes", "black pepper"],
    instructions: "Smash avocado on rice cakes, top with halved tomatoes.",
    tags: ["comfort"],
  },

  /* ── Lunches ── */
  {
    name: "Lentil Buddha Bowl",
    slot: "lunch", calories: 560, protein: 26, carbs: 78, fat: 15, fiber: 18,
    ingredients: ["150g cooked green lentils", "100g brown rice", "100g roasted sweet potato", "50g kale", "2 tbsp tahini dressing"],
    instructions: "Assemble bowl with lentils, rice, sweet potato and kale; drizzle tahini.",
    tags: ["high-protein"],
  },
  {
    name: "Chickpea Quinoa Salad",
    slot: "lunch", calories: 520, protein: 22, carbs: 68, fat: 16, fiber: 15,
    ingredients: ["150g chickpeas", "120g cooked quinoa", "cucumber & cherry tomatoes", "30g olives", "lemon-olive oil dressing"],
    instructions: "Toss everything with dressing; season with oregano.",
    tags: [],
  },
  {
    name: "Tempeh Stir-fry with Rice",
    slot: "lunch", calories: 580, protein: 32, carbs: 66, fat: 18, fiber: 12,
    ingredients: ["150g tempeh", "150g jasmine rice", "200g mixed vegetables", "2 tbsp tamari", "1 tsp sesame oil"],
    instructions: "Sear tempeh cubes, stir-fry veg, combine with tamari over rice.",
    tags: ["soy", "high-protein"],
  },
  {
    name: "Black Bean Burrito Bowl",
    slot: "lunch", calories: 590, protein: 24, carbs: 82, fat: 16, fiber: 19,
    ingredients: ["150g black beans", "120g rice", "corn & salsa", "1/2 avocado", "lime & coriander"],
    instructions: "Layer rice, beans, corn, salsa; top with avocado and lime.",
    tags: ["comfort"],
  },
  {
    name: "Tofu Poke Bowl",
    slot: "lunch", calories: 540, protein: 28, carbs: 64, fat: 17, fiber: 10,
    ingredients: ["180g marinated tofu", "150g sushi rice", "edamame", "cucumber & carrot", "sriracha mayo (vegan)"],
    instructions: "Cube marinated tofu, arrange over rice with veg, drizzle sauce.",
    tags: ["soy", "high-protein", "comfort"],
  },
  {
    name: "Mediterranean Wrap",
    slot: "lunch", calories: 480, protein: 17, carbs: 58, fat: 19, fiber: 11,
    ingredients: ["1 large wholewheat wrap", "80g hummus", "roasted red peppers", "rocket", "20g sun-dried tomatoes"],
    instructions: "Spread hummus, layer veg, roll tightly and halve.",
    tags: ["gluten", "comfort"],
  },
  {
    name: "Split Pea Soup with Bread",
    slot: "lunch", calories: 470, protein: 23, carbs: 68, fat: 9, fiber: 17,
    ingredients: ["200g split peas", "1 carrot & celery stick", "vegetable stock", "1 slice rye bread"],
    instructions: "Simmer peas with veg in stock 40 min, blend half, serve with bread.",
    tags: ["gluten", "high-protein"],
  },
  {
    name: "Zucchini Noodles with White Beans",
    slot: "lunch", calories: 430, protein: 19, carbs: 44, fat: 18, fiber: 13,
    ingredients: ["2 zucchini, spiralized", "150g cannellini beans", "cherry tomatoes", "2 tbsp pesto (vegan)", "pine nuts"],
    instructions: "Warm beans and tomatoes, toss with zoodles and pesto, top with pine nuts.",
    tags: ["nuts", "low-carb"],
  },

  /* ── Dinners ── */
  {
    name: "Chickpea Coconut Curry",
    slot: "dinner", calories: 550, protein: 19, carbs: 70, fat: 21, fiber: 15,
    ingredients: ["200g chickpeas", "200ml light coconut milk", "tomato & onion base", "120g basmati rice", "spinach"],
    instructions: "Simmer chickpeas in spiced coconut-tomato sauce 20 min, stir in spinach, serve over rice.",
    tags: [],
  },
  {
    name: "Lentil Bolognese with Pasta",
    slot: "dinner", calories: 580, protein: 26, carbs: 88, fat: 12, fiber: 16,
    ingredients: ["150g red lentils", "120g wholewheat spaghetti", "passata & garlic", "carrot & celery", "nutritional yeast"],
    instructions: "Cook lentils in passata with soffritto 25 min, serve over pasta with nooch.",
    tags: ["gluten", "high-protein", "comfort"],
  },
  {
    name: "Teriyaki Tofu with Broccoli",
    slot: "dinner", calories: 520, protein: 30, carbs: 58, fat: 16, fiber: 9,
    ingredients: ["200g extra-firm tofu", "250g broccoli", "3 tbsp teriyaki sauce", "130g rice", "sesame seeds"],
    instructions: "Pan-fry tofu until golden, glaze with teriyaki, steam broccoli, serve over rice.",
    tags: ["soy", "gluten", "high-protein", "comfort"],
  },
  {
    name: "Stuffed Bell Peppers",
    slot: "dinner", calories: 460, protein: 18, carbs: 62, fat: 15, fiber: 13,
    ingredients: ["2 bell peppers", "120g quinoa", "100g black beans", "corn & tomato", "vegan cheese shreds"],
    instructions: "Stuff peppers with quinoa-bean mix, top with cheese, bake 25 min at 190°C.",
    tags: [],
  },
  {
    name: "Mushroom Lentil Shepherd's Pie",
    slot: "dinner", calories: 540, protein: 22, carbs: 74, fat: 16, fiber: 14,
    ingredients: ["150g brown lentils", "200g mushrooms", "400g mashed potato", "peas & carrots", "thyme gravy"],
    instructions: "Cook lentil-mushroom filling, top with mash, bake until golden.",
    tags: ["comfort"],
  },
  {
    name: "Tempeh Tacos",
    slot: "dinner", calories: 510, protein: 27, carbs: 56, fat: 19, fiber: 12,
    ingredients: ["150g tempeh, crumbled", "3 corn tortillas", "taco spices", "cabbage slaw", "lime crema (vegan)"],
    instructions: "Brown spiced tempeh, fill tortillas, top with slaw and crema.",
    tags: ["soy", "high-protein", "comfort"],
  },
  {
    name: "Cauliflower Chickpea Traybake",
    slot: "dinner", calories: 440, protein: 16, carbs: 48, fat: 20, fiber: 13,
    ingredients: ["1/2 cauliflower", "150g chickpeas", "harissa & olive oil", "60g couscous", "parsley & lemon"],
    instructions: "Roast cauliflower and chickpeas in harissa oil 30 min, serve over couscous.",
    tags: ["gluten"],
  },
  {
    name: "Thai Green Vegetable Curry",
    slot: "dinner", calories: 490, protein: 14, carbs: 60, fat: 22, fiber: 10,
    ingredients: ["green curry paste (vegan)", "200ml light coconut milk", "mixed thai vegetables", "120g jasmine rice", "thai basil"],
    instructions: "Simmer veg in curry sauce 15 min, serve over rice with basil.",
    tags: ["low-carb", "comfort"],
  },
  {
    name: "High-Protein Seitan Steak Plate",
    slot: "dinner", calories: 560, protein: 42, carbs: 44, fat: 20, fiber: 8,
    ingredients: ["200g seitan", "300g roasted vegetables", "150g baby potatoes", "chimichurri", "1 tsp olive oil"],
    instructions: "Sear seitan 3 min per side, plate with potatoes and veg, spoon over chimichurri.",
    tags: ["gluten", "high-protein"],
  },
];
