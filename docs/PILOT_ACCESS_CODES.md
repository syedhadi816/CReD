# Pilot access codes (20 + defaults)

The seed script creates:

| Codes | Purpose |
|--------|---------|
| `123456`, `111111` | Shared dev / broad pilot (`maxUses: 100` each) |
| **`620001` … `620020`** | **Twenty 6-digit numeric codes for individual testers** (`maxUses: 10` each — allows a few retries; change in `backend/scripts/seed.ts` if you want `1`) |

## Full list to copy

```
620001
620002
620003
620004
620005
620006
620007
620008
620009
620010
620011
620012
620013
620014
620015
620016
620017
620018
620019
620020
```

## When they appear in production

On Render, **`npm run render-build`** runs **migrate + seed** on each deploy, so new codes are created on the **next** deploy after this change.

**Already-deployed DB:** If those rows already exist, `upsert` leaves them as-is. First deploy after adding this code creates the 20 rows.

## Changing the pattern or limits

Edit **`backend/scripts/seed.ts`** (search for `620000 + i` and `PILOT_BATCH`).
