# @cervos/ui

The shared component library for every Cervos screen: web, POS, supplier, and owner views.

## Rules

1. **No emojis.** Not in labels, buttons, toasts, chat, or docs. Use the `Icon` component. `npm run check:emoji` fails the build if one slips in.
2. **Plain words.** Short sentences. Sentence case. Verbs on buttons ("Add to sale", "Take payment", "Send"). No exclamation marks, no buzzwords.
3. **Grounded colors.** Warm stone surfaces, deep ink text, one calm teal for actions. Green, amber, red, and blue only for status.
4. **Readable sizes.** Body text is 16px. Key numbers are 30px to 36px. Buttons are at least 44px tall.
5. **Depth is a choice.** Cards are flat by default. `elevation="depth"` gives a solid 3D edge for dashboards that need it.

## Use

```tsx
import { Button, Card, Stat, Money } from "@cervos/ui";

<Card elevation="raised">
  <Stat label="Sales today" value={<Money amount={1284000} />} change="+12% vs yesterday" trend="up" />
  <Button icon="cart">Add to sale</Button>
</Card>
```

## Tokens (`src/tokens.ts`)

| Token | Value | Use |
| --- | --- | --- |
| `color.canvas` | `#F5F3EE` | Page background |
| `color.surface` | `#FFFFFF` | Cards |
| `color.border` | `#DDD8CE` | Lines and borders |
| `color.ink` | `#1E2522` | Main text |
| `color.inkMuted` | `#545C57` | Secondary text |
| `color.primary` | `#1F5F5B` | Main actions |
| `color.success` | `#2F6F45` | Paid, in stock |
| `color.warning` | `#8A5A10` | Expires soon |
| `color.danger` | `#A23B2F` | Expired, errors |
| `color.info` | `#2D5486` | On the way |

Spacing uses a 4px step. Radius: 4, 8, 12, 16. `cervosTailwindPreset` exposes all of this to Tailwind as `cv-*` classes.

## Components

| Component | What it is |
| --- | --- |
| `Button` | Primary, secondary, ghost, or danger. Sizes sm, md, lg. Optional icon and busy state. |
| `Card`, `CardHeader` | Container. Elevation flat, raised, or depth (3D edge). |
| `Badge` | Status label. Tones neutral, primary, success, warning, danger, info. `slanted` for a ribbon shape. |
| `Input` | Labeled text field with hint and error text. |
| `Stat` | Large number with label and change note. |
| `Notice` | Inline message for success, warning, danger, or info. |
| `EmptyState` | Shown when a list has nothing in it. |
| `ProgressRing` | Concentric rings for goals. |
| `BarChart` | Simple SVG bar chart. `depth` draws 3D blocks. |
| `ChatPanel` | Assistant chat with suggestions. Light or dark tone. |
| `Icon` | Line icons. See `ICON_NAMES`. |
| `Money` | TZS amount with tabular figures. |
| `ExpiryBadge` | Batch expiry status (FEFO). |
| `StakeholderPill` | User role label. |
| `ConfirmModal` | Confirm or cancel dialog. |
| `CervosCommandBar` | Ctrl+K jump menu. |

See every component live at `/design-lab`, at the bottom of the page.
