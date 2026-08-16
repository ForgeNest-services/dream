"""Editable default menu — seeded once per branch when the menu is empty.

Add / edit / remove items freely. The seeder looks up each item's category
by NAME (matching one of the auto-provisioned categories in
category_service.DEFAULT_CATEGORIES), so category IDs don't need to be
known ahead of time.

Item shape:
    {
        "category":  str  — must exactly match a seeded category name
        "name":      str  — the menu item name
        "price":     int|float  — for flat-price items (omit if `variants`)
        "variants":  list[{"name": str, "price": number}]  — for variant items
        "image":     str  — path relative to menu_seed_images/, e.g.
                            "fastfood/burger.jpg". Subfolders are supported.
    }

Rules:
 - Exactly one of `price` OR `variants` — never both.
 - `image` is optional; missing file = item created with no image (UI shows
   the placeholder). See menu_seed_images/README.md for image guidelines.
 - Renaming a category in category_service.DEFAULT_CATEGORIES without
   updating "category" strings here will silently skip those items — the
   seeder logs a warning.
 - Combos (is_combo=True) are NOT seeded here — build them via the UI
   after seed, since they reference other items' IDs.
"""


DEFAULT_MENU: list[dict] = [
    # ── Hot Beverages ──────────────────────────────────────────────────
    {"category": "Hot Beverages", "name": "Milk Tea", "price": 60, "image": "hot-beavarage/milk-tea.jpg"},
    {"category": "Hot Beverages", "name": "Black Tea", "price": 40, "image": "hot-beavarage/blacktea.jpg"},
    {"category": "Hot Beverages", "name": "Matka Chiya", "price": 80, "image": "hot-beavarage/matka-chiya.jpg"},

    # ── Cold Beverages / Refreshers ────────────────────────────────────
    {"category": "Cold Beverages / Refreshers", "name": "Virgin Mojito", "price": 220, "image": "cold-beavarages/virgin-mojito.jpg"},

    # ── Hookah ─────────────────────────────────────────────────────────
    {
        "category": "Hookah",
        "name": "Hookah",
        "variants": [
            {"name": "Mint", "price": 700},
            {"name": "Double Apple", "price": 750},
            {"name": "Blueberry", "price": 800},
        ],
        "image": "hookah/hookah.jpg",
    },

    # ── Fast Food ──────────────────────────────────────────────────────
    {"category": "Fast Food", "name": "Aloo Stick", "price": 100, "image": "fastfood/aaloostick.jpg"},
    {"category": "Fast Food", "name": "Chicken Burger", "price": 350, "image": "fastfood/burger.jpg"},
    {"category": "Fast Food", "name": "Chatpate", "price": 80, "image": "fastfood/chatpate.jpg"},
    {
        "category": "Fast Food",
        "name": "Chowmein",
        "variants": [
            {"name": "Veg", "price": 150},
            {"name": "Chicken", "price": 200},
        ],
        "image": "fastfood/chowmein.jpg",
    },
    {
        "category": "Fast Food",
        "name": "French Fries",
        "variants": [
            {"name": "Plain", "price": 180},
            {"name": "Peri Peri", "price": 220},
            {"name": "Cheesy", "price": 260},
        ],
        "image": "fastfood/frenchfries.jpg",
    },
    {"category": "Fast Food", "name": "Keema Noodles", "price": 220, "image": "fastfood/keemanoodles.jpg"},
    {
        "category": "Fast Food",
        "name": "Steam Momo",
        "variants": [
            {"name": "Veg", "price": 160},
            {"name": "Chicken", "price": 200},
            {"name": "Buff", "price": 180},
        ],
        "image": "fastfood/momo.jpg",
    },
    {
        "category": "Fast Food",
        "name": "Pizza",
        "variants": [
            {"name": "Cheese", "price": 400},
            {"name": "Veg", "price": 450},
            {"name": "Chicken", "price": 550},
        ],
        "image": "fastfood/pizza.jpg",
    },
    {"category": "Fast Food", "name": "Saphale", "price": 120, "image": "fastfood/Saphale.png"},

    # ── Thakali Set ────────────────────────────────────────────────────
    {
        "category": "Thakali Set",
        "name": "Thakali Khana Set",
        "variants": [
            {"name": "Veg", "price": 350},
            {"name": "Chicken", "price": 450},
            {"name": "Mutton", "price": 550},
        ],
        "image": "thakali/thakalikhanaset.jpg",
    },

    # ── Newari Khaja ───────────────────────────────────────────────────
    {
        "category": "Newari Khaja",
        "name": "Newari Khaja Set",
        "variants": [
            {"name": "Buff", "price": 250},
            {"name": "Chicken", "price": 270},
        ],
        "image": "newarikhaja/newarikhaja.jpg",
    },

    # ── Cigarettes ─────────────────────────────────────────────────────
    {"category": "Cigarettes", "name": "Shikhar Ice", "price": 25, "image": "cigarettes/shikhar-ice.jpg"},
    {"category": "Cigarettes", "name": "Surya Light", "price": 30, "image": "cigarettes/surya-light.jpg"},
    {"category": "Cigarettes", "name": "Surya Red", "price": 30, "image": "cigarettes/surya-red.jpg"},
]
