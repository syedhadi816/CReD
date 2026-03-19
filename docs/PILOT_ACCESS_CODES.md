# Pilot access codes (20 + defaults)

The seed script creates:

| Codes | Purpose |
|--------|---------|
| `123456`, `111111` | Shared dev / broad pilot (`maxUses: 100` each) |
| **`CRE26-01` … `CRE26-20`** | **Twenty codes to give to individual testers** (`maxUses: 10` each — allows a few retries; change in `backend/scripts/seed.ts` if you want `1`) |

## Full list to copy

```
CRE26-01
CRE26-02
CRE26-03
CRE26-04
CRE26-05
CRE26-06
CRE26-07
CRE26-08
CRE26-09
CRE26-10
CRE26-11
CRE26-12
CRE26-13
CRE26-14
CRE26-15
CRE26-16
CRE26-17
CRE26-18
CRE26-19
CRE26-20
```

## When they appear in production

On Render, **`npm run render-build`** runs **migrate + seed** on each deploy, so new codes are created on the **next** deploy after this change.

**Already-deployed DB:** If those rows already exist, `upsert` leaves them as-is. First deploy after adding this code creates the 20 rows.

## Changing the pattern or limits

Edit **`backend/scripts/seed.ts`** (search for `CRE26-` and `PILOT_BATCH`).
