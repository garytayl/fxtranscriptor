# FX Transcriptor - Interface Template Rework Plan

## 🎨 Design Philosophy

The **interface** template embodies an **editorial monochrome design system** with controlled tension and signal clarity. It's built on:

- **Monochrome palette** with **orange accent** (`oklch(0.7 0.2 45)`)
- **IBM Plex Sans/Mono** + **Bebas Neue** typography hierarchy
- **GSAP + Lenis** smooth scroll with scroll-triggered animations
- **Split-flap display** text animations with audio feedback
- **Scramble text** effects on hover
- **Side navigation** with intersection observer
- **Asymmetric grid layouts** for content
- **Noise overlays** and grid backgrounds for texture
- **Editorial card designs** with torn edges and fold effects

---

## 🔄 Transformation Strategy

### Phase 1: Foundation (Design System Migration)

#### 1.1 Global Styles & Colors
- ✅ Replace `app/globals.css` with interface template's design tokens
- ✅ Apply monochrome + orange accent color scheme (oklch)
- ✅ Add noise overlay and grid background
- ✅ Update scrollbar styling to match interface
- ✅ Apply custom selection colors

#### 1.2 Typography System
- ✅ Fonts already loaded in layout (IBM Plex + Bebas Neue)
- ✅ Apply Bebas Neue for display headings (sermon titles, section headers)
- ✅ Use IBM Plex Mono for metadata, dates, counts
- ✅ Use IBM Plex Sans for body text and descriptions

#### 1.3 Layout & Smooth Scroll
- ✅ Add `SmoothScroll` wrapper (Lenis integration)
- ✅ Update layout to include smooth scroll provider
- ✅ Register GSAP ScrollTrigger plugin
- ✅ Add grid background and noise overlay

---

### Phase 2: Hero Section

Transform the header into an **editorial hero** with split-flap animation:

#### Hero Design:
```
┌─────────────────────────────────────────┐
│ [SIDE NAV]  INTERFACE                    │ ← Split-flap text (FX TRANSCRIPTOR)
│            Studies in Sermon Transcription
│                                          │
│            Sermon transcript catalog     │
│            with one-click generation     │
│                                          │
│            [View Sermons] [Sync Catalog] │ ← Scramble text buttons
│                                          │
│                            v.01 / Catalog │
└─────────────────────────────────────────┘
```

**Components Needed:**
- `SplitFlapText` for "FX TRANSCRIPTOR" title
- `SplitFlapAudioProvider` for sound effects
- `ScrambleTextOnHover` for button text
- `AnimatedNoise` overlay
- Vertical label: "SIGNAL" rotated -90deg

**Animation:**
- Hero content fades up on scroll (GSAP ScrollTrigger)
- Split-flap initializes on mount
- Hover scramble effects on CTA buttons

---

### Phase 3: Sermon Catalog Section

Transform sermon cards into **editorial signal cards**:

#### Card Design Evolution:

**Current:** Basic grid cards with title, date, status badge, buttons

**New:** Editorial card design inspired by `SignalsSection`:
```
┌──────────────────────────┐
│ No. 001                  │ ← Issue number (mono, small)
│ ──────────────────────── │ ← Torn edge top
│                          │
│ SERMON TITLE             │ ← Bebas Neue, large
│                          │
│ ───                      │ ← Orange accent line (expands on hover)
│                          │
│ Sermon description here  │ ← Mono, small, muted
│                          │
│ [YouTube] [Podbean]      │ ← Source badges
│                          │
│ ┌──────────┐            │
│ │ Generate │            │ ← CTA button
│ └──────────┘            │
│                     ┌─┐  │ ← Corner fold effect
│                     └─┘  │
└──────────────────────────┘
     └─ Shadow layer (reveals on hover)
```

**Layout Options:**

**Option A: Horizontal Scroll (Like Signals)**
- Horizontal scrolling sermon cards
- Larger cards with more breathing room
- Editorial style with issue numbers

**Option B: Asymmetric Grid (Like Work)**
- Masonry-style grid
- Cards of varying sizes
- Hover reveals description

**Option C: Vertical List (Editorial Magazine)**
- Vertical stacking
- Full-width cards with left border
- Minimal, editorial style

**Recommended: Option A (Horizontal Scroll)**
- Better for browsing many sermons
- More editorial/experimental feel
- Matches interface template's Signals pattern
- Can add filters/categories later

#### Card Components:
- `SignalCard` variant for sermons
- Scroll-triggered fade-in animations
- Hover state with accent color reveal
- Status indicators (completed/generating/failed) as editorial badges
- Date formatting in editorial style (`YYYY.MM.DD`)

---

### Phase 4: Navigation & Structure

#### Side Navigation (Interface Pattern)
```
┌──┐
│  │ ← Index (Hero)
│  │ ← Sermons (Catalog)
│  │ ← Recent (Latest generated)
│  │ ← Settings (Sync, filters)
│  │
│  │
│  │
│  │
└──┘
```

**Nav Items:**
- Index (hero)
- Sermons (catalog)
- Recent (latest generated transcripts)
- Filters (optional: by status, date, source)

**Behavior:**
- Active section highlighting via intersection observer
- Smooth scroll to sections
- Hover reveals label
- Dot indicator with accent color

---

### Phase 5: Transcript Viewer

Transform dialog into **editorial reading experience**:

#### Design:
```
┌──────────────────────────────────────┐
│ SERMON TITLE                    ×    │ ← Bebas Neue, large
│ ──────────────────────────────────── │
│ 2025.01.15  •  YouTube  •  45 min   │ ← Mono, small
│ ──────────────────────────────────── │
│                                      │
│ Transcript content here...           │ ← Mono, readable
│ Line-by-line formatting             │
│ With proper spacing                 │
│                                      │
│ ──────────────────────────────────── │
│ 45,231 characters                   │
│ [Copy All]  [Download .txt]         │
└──────────────────────────────────────┘
```

**Components:**
- Editorial header with title and metadata
- Scrollable transcript area with mono font
- Character count in mono, small
- Action buttons with scramble text on hover

**Animation:**
- Dialog slides in from bottom
- Content fades in with stagger
- Smooth scrolling for long transcripts

---

### Phase 6: Actions & Interactions

#### Sync Catalog Button
- Editorial button style (border, mono font, uppercase)
- Scramble text on hover: "SYNC CATALOG" → scrambles → "SYNCING..."
- Split-flap counter: sermon count
- Status indicator with accent color

#### Generate Button
- Different states:
  - **Pending**: "GENERATE" (accent border)
  - **Generating**: "GENERATING..." (scramble animation)
  - **Completed**: "VIEW" (muted)
  - **Failed**: "RETRY" (destructive accent)

#### Loading States
- Skeleton loaders with editorial style
- Grid background pattern visible through skeleton
- Pulse animation with accent color

---

### Phase 7: Additional Sections (Optional)

#### Recent Transcripts Section
- Horizontal scroll of recently generated transcripts
- Signal-style cards
- Quick preview with "Read More" CTA

#### Statistics Section (Colophon-style)
```
┌─────────────────────────────────────┐
│ STATISTICS                          │
│ ───────────────────────────────────│
│                                     │
│ 818    Sermons                      │
│ 245    Transcripts                  │
│ 67%    Complete                     │
│                                     │
└─────────────────────────────────────┘
```

#### About/Info Section
- Editorial principles section
- System information
- Credits and stack

---

## 📦 Component Migration Strategy

### Components to Copy from Interface:
1. ✅ `SmoothScroll` - Lenis integration
2. ✅ `SplitFlapText` + `SplitFlapAudioProvider` - Hero title
3. ✅ `ScrambleText` / `ScrambleTextOnHover` - Button text
4. ✅ `SideNav` - Navigation (adapt nav items)
5. ✅ `AnimatedNoise` - Texture overlay
6. ✅ `BitmapChevron` - Decorative element
7. ✅ `HighlightText` - Text effects (optional)
8. ✅ Grid background pattern (CSS)
9. ✅ Noise overlay (CSS)

### Components to Adapt:
1. **SignalCard** → **SermonCard**
   - Adapt from signals pattern
   - Add sermon-specific fields (status, sources, dates)
   - Add generate/view actions

2. **WorkSection** → **CatalogSection**
   - Adapt grid layout for sermons
   - Horizontal scroll instead of grid (recommended)
   - Or keep grid, style as editorial cards

3. **HeroSection** → **CatalogHero**
   - Replace "INTERFACE" with "FX TRANSCRIPTOR"
   - Update subtitle and description
   - Update CTAs to sermon catalog actions

### Components to Create:
1. **TranscriptDialog** - Editorial transcript viewer
2. **SermonCard** - Editorial sermon card
3. **StatusBadge** - Editorial status indicator
4. **SourceBadge** - Editorial source badge
5. **LoadingCard** - Editorial skeleton loader

---

## 🎯 Implementation Priority

### Priority 1 (Core Experience):
1. ✅ Global styles migration (colors, fonts, grid, noise)
2. ✅ Smooth scroll integration
3. ✅ Hero section with split-flap title
4. ✅ Side navigation
5. ✅ Sermon cards (editorial style)
6. ✅ Catalog section with scroll animations

### Priority 2 (Polish):
1. Transcript dialog (editorial style)
2. Button scramble effects
3. Loading states (skeleton loaders)
4. Status badges (editorial style)
5. Hover animations

### Priority 3 (Enhancements):
1. Recent transcripts section
2. Statistics section
3. Filters/categories
4. Search functionality
5. Additional sections (principles, about)

---

## 🔧 Technical Dependencies

### New Dependencies Needed:
```json
{
  "gsap": "^3.14.1",           // Already in interface/package.json
  "lenis": "^1.3.15",          // Already in interface/package.json
  "framer-motion": "^12.23.26" // Already in interface/package.json
}
```

### Dependencies Already Available:
- ✅ All Radix UI components
- ✅ Lucide React icons
- ✅ Tailwind CSS v4
- ✅ Next.js 16

### Package Management:
- Interface folder has its own `package.json`
- Need to merge dependencies into main `package.json`
- Or copy components without duplicating dependencies

---

## 🎨 Design Token Mapping

### Color System (Already Defined in Interface):
```css
--background: oklch(0.08 0 0);        /* Dark background */
--foreground: oklch(0.95 0 0);        /* Light text */
--accent: oklch(0.7 0.2 45);          /* Orange accent */
--muted-foreground: oklch(0.55 0 0);  /* Muted text */
--border: oklch(0.25 0 0);            /* Borders */
```

### Typography Scale:
- **Display (Bebas Neue)**: `text-5xl md:text-7xl` (hero, section headers)
- **Title (Bebas Neue)**: `text-2xl md:text-4xl` (sermon titles, card titles)
- **Body (IBM Plex Sans)**: `text-sm md:text-base` (descriptions)
- **Mono (IBM Plex Mono)**: `text-xs` (metadata, dates, counts, labels)

### Spacing System:
- Editorial spacing: `py-32` for sections
- Card padding: `p-8`
- Grid gaps: `gap-6 md:gap-8`
- Left padding (for side nav): `pl-6 md:pl-28`

---

## 🚀 Migration Path

### Step 1: Setup Dependencies
1. Merge interface dependencies into main `package.json`
2. Install GSAP, Lenis, Framer Motion
3. Update `tsconfig.json` if needed

### Step 2: Copy Core Components
1. Copy `SmoothScroll` component
2. Copy `SplitFlapText` + audio provider
3. Copy `ScrambleText` components
4. Copy `SideNav` (adapt nav items)
5. Copy utility components (AnimatedNoise, BitmapChevron)

### Step 3: Update Global Styles
1. Replace `app/globals.css` with interface styles
2. Test color system
3. Test typography
4. Test grid/noise overlays

### Step 4: Update Layout
1. Add `SmoothScroll` wrapper
2. Add noise overlay div
3. Add grid background
4. Register GSAP ScrollTrigger

### Step 5: Create Hero Section
1. Build hero with split-flap title
2. Add subtitle and description
3. Add CTA buttons with scramble text
4. Add scroll animations

### Step 6: Create Side Nav
1. Adapt SideNav component
2. Define nav items (Index, Sermons, Recent, etc.)
3. Wire up intersection observer
4. Test smooth scrolling

### Step 7: Transform Catalog Section
1. Create `SermonCard` component (editorial style)
2. Create `CatalogSection` with horizontal scroll
3. Add scroll-triggered animations
4. Wire up sermon data

### Step 8: Transform Transcript Dialog
1. Create editorial transcript viewer
2. Add metadata display
3. Style transcript content (mono font)
4. Add copy/download actions

### Step 9: Polish & Animations
1. Add hover effects
2. Add loading states
3. Add status badges (editorial style)
4. Fine-tune animations

### Step 10: Testing & Refinement
1. Test on mobile (responsive)
2. Test animations performance
3. Test accessibility
4. Refine spacing and typography

---

## 💡 Key Design Principles from Interface Template

1. **Interface Minimalism**: Reduce until only essential remains
2. **Systems Over Screens**: Design behaviors, not just layouts
3. **Controlled Tension**: Balance between restraint and expression
4. **Signal Clarity**: Communication that cuts through noise

### Application to FX Transcriptor:
- **Minimal UI**: Focus on sermons and transcripts, remove clutter
- **Smart Behaviors**: Auto-sync, smart matching, one-click generation
- **Editorial Design**: Treat sermons as editorial content, not just data
- **Clear Signals**: Status indicators, source badges, clear CTAs

---

## 🎯 Success Metrics

### Visual:
- ✅ Monochrome + orange accent applied consistently
- ✅ Editorial typography hierarchy established
- ✅ Smooth scroll and animations working
- ✅ Editorial card designs implemented
- ✅ Noise and grid overlays visible

### Functional:
- ✅ All existing functionality preserved
- ✅ Sermon catalog displays correctly
- ✅ Transcript generation works
- ✅ Transcript viewer functions
- ✅ Responsive on all devices

### Experience:
- ✅ Page feels premium and editorial
- ✅ Animations enhance, don't distract
- ✅ Navigation is intuitive
- ✅ Content is easily scannable
- ✅ Actions are clear and accessible

---

## 📝 Next Steps

1. **Review this plan** and adjust priorities
2. **Start with Phase 1** (Foundation)
3. **Iterate through phases** systematically
4. **Test at each phase** to ensure functionality
5. **Refine based on feedback**

This rework will transform FX Transcriptor from a functional catalog into a **beautiful editorial experience** that matches the sophistication and beauty of the interface template.
