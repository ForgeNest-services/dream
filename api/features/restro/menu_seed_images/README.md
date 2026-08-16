# Menu seed images

Drop image files here to have them uploaded to MinIO and attached to seeded
menu items on first-time branch setup.

## Filename convention

Match the `image` field in `menu_seed_data.py` exactly (case-sensitive on
Linux):

```
menu_seed_data.py:
    {"category": "Momo", "name": "Steam Momo", ..., "image": "steam-momo.jpg"}

menu_seed_images/
    steam-momo.jpg    ← must be here
```

## Supported formats

- `.jpg` / `.jpeg`
- `.png`
- `.webp`

The seeder infers the MIME type from the extension.

## Sizing recommendations

- **Square** ~512×512 (menu cards render square)
- **Under 200 KB** (page load stays snappy)
- **Under 5 MB** hard cap (matches the `/uploads` endpoint limit)

Images larger than 5 MB will fail to upload; the item still gets created,
just without an image (UI falls back to the built-in placeholder).

## Missing image = no image, no crash

If `menu_seed_data.py` references `steam-momo.jpg` but the file isn't
here, the seeder logs a warning and creates the item without an image.
Add the file later and re-seed by wiping the branch's menu items — the
seeder only runs when the branch's menu is empty.

## After adding / changing images

Because these files are baked into the API container image, you must
rebuild the api container so the new files are visible inside it:

```bash
docker compose build api && docker compose up -d api
```

Then trigger the seed either by:
1. Creating a brand-new branch (auto-runs on first `GET /categories`), or
2. Deleting every menu item in an existing branch (auto-runs on the next
   `GET /menu-items` — via the same "empty triggers reseed" path).
