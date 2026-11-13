# FUTUREFIELD
## Intelligent Farm Planning for a Changing Climate

### Figma Master Prompt — High-Fidelity Responsive Product Prototype

Design a complete, high-fidelity, production-ready web application called:

# **FutureField**

### Tagline
**From Earth Observation to Better Farm Decisions**

FutureField is a **NASA Earth-observation-powered agricultural decision-support platform** that helps farmers understand their fields, monitor environmental conditions, compare crop options, generate multi-season crop rotation scenarios, and explore how those plans may respond to changing rainfall, temperature, water availability, and farmer priorities.

The platform combines:

**NASA Earth Observations + Local Soil Information + Crop Characteristics + Farm History + Farmer Priorities**

to produce:

**Field Intelligence → Crop Suitability → Rotation Scenarios → Explainable Decisions → What-If Analysis**

FutureField is NOT simply a satellite-data dashboard.

The main product value is:

> **Turn complex Earth-observation data into understandable, explainable, practical farm-planning decisions.**

---

# 01 — CORE PRODUCT EXPERIENCE

The entire application should revolve around one connected journey:

**Select Farm → Select Field → Understand Conditions → Explore Candidate Crops → Set Priorities → Generate Rotation Scenarios → Compare Scenarios → Understand Why → Test What-If Conditions → Save Plan → Export Report**

Every screen must preserve the selected:

**Farm**
**Field**
**Season**
**Data period**

across the application.

The farmer should never feel like they are moving between unrelated dashboards.

---

# 02 — PRIMARY USER

The primary user is a **farmer**.

The interface must therefore be:

- simple
- visual
- practical
- readable
- trustworthy
- responsive
- touch-friendly
- understandable without technical knowledge

The farmer should not need to understand remote sensing terminology to use the core product.

Use progressive disclosure.

### Example

Instead of showing only:

**SMAP L4 Soil Moisture**

show:

**Soil Moisture**

**31%**

**Below your recent historical range**

Then provide:

**View NASA SMAP data →**

Technical information should remain accessible, but should not dominate the primary experience.

---

# 03 — PRODUCT PERSONALITY

FutureField should feel:

**Practical**
**Scientific**
**Human**
**Calm**
**Trustworthy**
**Agricultural**
**Data-driven**
**Modern**

It should feel like a serious agricultural technology platform rather than a student dashboard.

Avoid:

- futuristic AI aesthetics
- excessive glassmorphism
- neon colors
- glowing cards
- cyberpunk visuals
- huge typography
- excessive gradients
- generic SaaS aesthetics
- excessive rounded cards
- fake 3D agriculture graphics
- robotic AI illustrations
- stock-photo-heavy layouts

The product should visually combine:

**GIS software + NASA Earth observation + precision agriculture + climate analytics**

---

# 04 — VISUAL DESIGN SYSTEM

## Color palette

### Primary green
Muted agricultural green.

Use for:

- healthy vegetation
- positive status
- primary actions
- selected agricultural elements

### Navy / charcoal

Use for:

- sidebar
- top navigation
- important UI structure

### Warm neutral

Use for:

- page background
- panels
- report surfaces

### Earth brown

Use for:

- soil-related information
- field/land context

### Water blue

Use for:

- rainfall
- water availability
- soil moisture
- irrigation

### Amber

Use for:

- moderate risk
- warnings
- monitoring states

### Red

Use only for:

- severe risk
- critical alerts

Do not use color decoratively.

Color must have a clear information purpose.

---

# 05 — TYPOGRAPHY

Use:

**Inter**

or another clean modern UI font.

Use strong hierarchy but avoid oversized typography.

Typography levels:

- application title
- page title
- section title
- metric
- label
- supporting text
- data source
- metadata
- chart labels

Prioritize readability over visual drama.

---

# 06 — APPLICATION NAVIGATION

Create a persistent desktop sidebar.

## Main navigation

**FutureField logo**

**Dashboard**

**My Fields**

**Rotation Planner**

**Climate Insights**

**Simulations**

**Data Explorer**

**Reports**

Divider

**Alerts**

**Help**

Bottom:

**Farmer Profile**

**Settings**

---

# 07 — TOP NAVIGATION

Create a consistent application top bar.

Left:

Current farm / field selector

Example:

**Green Valley Farm**
**Field 01**

Middle:

Search

Right:

Date range

Notifications

Profile

Also show small application status:

**NASA data updated**

or

**Latest available observations**

Never imply live data if the prototype data is illustrative or cached.

---

# 08 — FARM / LOCATION CONTEXT

The prototype should be visually grounded in a **realistic Bangladesh agricultural environment**.

For the primary demo experience, use a fictional farm in Bangladesh, preferably a visually plausible rural/agricultural landscape inspired by regions such as **Chattogram / Chattogram Division**.

Do NOT create an exaggerated tropical illustration.

The map should contain believable:

- rice fields
- ponds
- small waterways
- roads
- villages
- irregular field boundaries
- vegetation patches
- agricultural parcels
- natural terrain

Use realistic map geometry and satellite-style imagery.

The map should feel like a genuine GIS product.

---

# 09 — PAGE 1: DASHBOARD

## Page title

**Good morning, Rahim**

Subtitle:

**Here’s the current condition of your farm.**

At the top show:

**3 Active Fields**

**24.8 ha Total Area**

**31% Soil Moisture**

**Moderate Water Stress**

**Current Season**

---

## Dashboard composition

The largest visual element should be the farm map.

Place the map on the left / center.

Place a compact:

**Field Intelligence**

panel on the right.

Below the map, use compact environmental metrics.

---

# 10 — DASHBOARD MAP

Show:

**Field 01**
**Field 02**
**Field 03**

with realistic agricultural polygons.

Field 01 is selected.

Selected field gets:

- stronger outline
- subtle fill
- label
- hover state
- active state

Map controls:

- zoom
- current location
- search
- layers
- satellite/map toggle
- measure
- field selection

---

# 11 — MAP LAYERS

Allow farmers to toggle:

**Soil Moisture**
NASA SMAP

**Rainfall**
NASA GPM

**Temperature**
NASA POWER / MODIS / VIIRS

**Vegetation Health**
NDVI

**Water Stress**

**Drought Risk**

**Heat Stress**

Each layer must change the map visualization and legend.

Example:

### Soil Moisture

Dry ←────────────→ Wet

The map layer should visually resemble a real environmental raster rather than a collection of random colored blobs.

---

# 12 — FIELD INTELLIGENCE PANEL

When Field 01 is selected:

### Field 01

**12.4 ha**

**Current crop: Alfalfa**

**Condition: Moderately healthy**

### Metrics

Soil Moisture

**31%**

Rainfall

**42 mm**

NDVI

**0.62**

Evapotranspiration

**4.8 mm/day**

Water Stress

**Moderate**

---

Buttons:

**Open Field Intelligence**

**Plan Next Crop**

**View History**

---

# 13 — PAGE 2: MY FIELDS

This page must be **more interactive and lively**, not just a static table.

## Title

**My Fields**

Subtitle:

**Monitor your fields and explore what is changing.**

---

## Field cards

Create large but compact interactive field cards.

Example:

### Field 01

**12.4 ha**

Current crop:

**Alfalfa**

Condition:

**Moderately healthy**

Soil moisture:

**31%**

Water stress:

**Moderate**

NDVI:

**0.62**

---

When the farmer hovers:

Card subtly expands.

Reveal:

**Last updated**
**7 hours ago**

**Rainfall trend**
Below average

**Temperature**
Above recent average

CTA:

**View Field**

---

# 14 — MY FIELDS INTERACTIONS

Make each option visibly interactive.

### Click Field

Open detailed field drawer.

### Click “View Field”

Navigate to:

**Field Intelligence**

### Click “Monitor”

Add field to monitoring list.

Change button to:

**Monitoring ✓**

### Click “History”

Open crop and environmental history.

### Click “Plan Next Crop”

Open:

**Rotation Planner**

### Click field map icon

Zoom directly to the field.

### Click status

Open explanation.

Example:

**Why moderate water stress?**

---

# 15 — ADD FIELD EXPERIENCE

Primary CTA:

**+ Add Field**

Opening the flow:

### Step 1

**Choose location**

### Step 2

**Draw field boundary**

or

**Upload boundary**

### Step 3

**Farm information**

Area

Irrigation

Soil type

### Step 4

**Current crop**

### Step 5

**Crop history**

### Step 6

**Farmer priorities**

### Step 7

**Analyze Field**

Use a clear progress indicator.

---

# 16 — PAGE 3: FIELD INTELLIGENCE

## Title

**Field Intelligence**

Subtitle:

**Understand what is happening in Field 01.**

This is the main analytical page.

---

## Top section

Large field map preview.

Next to it:

### Current condition

**Moderate water stress**

Then environmental metrics:

**Soil Moisture**
31%

**Rainfall**
42 mm

**NDVI**
0.62

**ET**
4.8 mm/day

---

# 17 — HISTORICAL ENVIRONMENTAL TRENDS

Create interactive charts.

### Soil Moisture

30-day line chart.

Show:

Current

Historical average

Range

---

### Rainfall

14-day / 30-day precipitation.

---

### NDVI

Vegetation trend.

---

### Temperature

Temperature anomaly.

---

Time controls:

**7D**
**30D**
**3M**
**1Y**
**5Y**

---

# 18 — “SO WHAT?” DESIGN PRINCIPLE

Every major metric must have context.

Example:

### Soil moisture

**31%**

Below recent historical range.

### Rainfall

**42 mm**

18% below historical average.

### NDVI

**0.62**

Stable compared with previous period.

### Temperature

**31.2°C**

Above recent average.

Never show numbers without interpretation.

---

# 19 — FIELD CONDITION ANALYZER

Create a clean section:

# **Current Field Condition**

Overall indicator:

**72 / 100**

**Moderately Healthy**

Breakdown:

Soil Moisture

**78**

Rainfall

**81**

Temperature

**62**

Vegetation Health

**76**

Drought Risk

**58**

Water Availability

**65**

Use horizontal indicators rather than oversized gauges.

---

# 20 — KEY OBSERVATIONS

Examples:

**Soil moisture is below the recent historical range.**

**Rainfall has been lower than the recent baseline.**

**Vegetation health remains relatively stable.**

**Higher temperatures may increase water demand.**

---

# 21 — DATA SOURCES

Throughout the product, show small source badges.

Examples:

**NASA SMAP**

**NASA GPM**

**NASA NDVI**

**NASA POWER**

**Local Soil Profile**

**Crop Database**

Clicking a source opens a small metadata drawer.

Include:

Data source

Last updated

Variable

Resolution

Period

Use clear provenance.

---

# 22 — PAGE 4: CROP ANALYSIS

## Title

**Crop Analysis**

Subtitle:

**Explore crops that match the current field conditions.**

Do NOT make this page look like a generic AI ranking page.

Create a clean comparison interface.

---

# 23 — CANDIDATE CROPS

Create candidate crop cards.

Use prototype crops such as:

**Wheat**

**Sorghum**

**Soybean**

**Corn**

**Cover Crop**

Where values are not backed by actual agronomic data, clearly label them:

**Illustrative**

Each card shows:

Water demand

Growing duration

Nitrogen demand

Climate sensitivity

Rotation compatibility

Suitability

---

# 24 — CROP SUITABILITY

Create a professional comparison table.

Columns:

Crop

Suitability

Water Demand

Heat Tolerance

Soil Compatibility

Climate Sensitivity

Rotation Compatibility

Why?

---

Use realistic prototype values but label demo values appropriately.

Example:

**Wheat — 76%**

**Sorghum — 82%**

**Soybean — 71%**

**Corn — 68%**

**Cover Crop — 79%**

Do not label any crop:

**BEST**

Instead:

**Suitability**

---

# 25 — CROP “WHY?” INTERACTION

Clicking:

**Why?**

opens a right-side drawer.

Example:

# Why is Sorghum suitable?

### Field condition

Soil moisture:

**31%**

Rainfall:

**Below average**

Temperature:

**Above recent average**

Water stress:

**Moderate**

### Crop characteristics

Water demand:

Moderate

Heat sensitivity:

Lower

Rotation compatibility:

Good

### Explanation

**Sorghum receives a higher suitability score because the current field profile indicates moderate water stress and relatively warm conditions.**

Add:

**Data used**

NASA SMAP

NASA GPM

NASA temperature data

Local field profile

Crop database

---

# 26 — PAGE 5: ROTATION PLANNER

This is the **core innovation screen**.

Change the page name to:

# **Rotation Planner**

Do NOT call this:

Farm Plan.

The farmer is planning a multi-season rotation.

---

# 27 — ROTATION PLANNER HEADER

Title:

**Rotation Planner**

Subtitle:

**Build crop rotation scenarios based on your field conditions and priorities.**

Top context:

**Field 01 — 12.4 ha**

**Current crop — Alfalfa**

**Current water stress — Moderate**

**Data status — Latest available**

---

# 28 — FARMER PRIORITIES

Place priority controls directly inside the Rotation Planner.

Title:

**What matters most to you?**

Four sliders:

### Water Saving

**40%**

### Soil Health

**30%**

### Climate Resilience

**20%**

### Yield / Productivity

**10%**

Also allow:

**Reset**

**Save Priorities**

Do not make sliders visually flashy.

---

# 29 — PRIORITY EXPLANATION

Beside the sliders:

**Your priorities influence how FutureField evaluates possible rotations.**

Example:

Higher Water Saving:

→ gives more weight to lower-water-demand rotations.

Higher Soil Health:

→ gives more weight to soil-building crops and diverse rotations.

Higher Climate Resilience:

→ gives more weight to crops with better tolerance to modeled climate stress.

---

# 30 — CANDIDATE CROP SELECTION

Below priorities:

### Candidate crops

Create selectable cards:

**Wheat**

**Sorghum**

**Soybean**

**Cover Crop**

**Corn**

Each card contains:

Water demand

Duration

Climate sensitivity

Soil impact

Compatibility

Small checkbox:

**Include**

---

# 31 — GENERATE ROTATION SCENARIOS

Large primary CTA:

# **Generate Rotation Scenarios**

When clicked, create an elegant loading state.

Do NOT simply show a spinner.

Display:

**Analyzing your field…**

Then show steps:

✓ Reading field history

✓ Analyzing NASA soil moisture

✓ Checking rainfall patterns

✓ Reviewing vegetation trends

✓ Reviewing climate conditions

✓ Comparing crop requirements

✓ Applying your priorities

✓ Building rotation scenarios

Then transition to:

**3 rotation scenarios generated**

---

# 32 — SCENARIO RESULTS

Create three large scenario cards.

## Scenario A

# Water Saver

Description:

**Prioritizes lower water demand and resilience under drier conditions.**

---

## Scenario B

# Soil Builder

Description:

**Prioritizes soil recovery, crop diversity, and inclusion of a soil-improving crop or cover crop.**

---

## Scenario C

# Balanced Rotation

Description:

**Balances water demand, soil considerations, productivity, and climate resilience.**

---

IMPORTANT:

Never call one:

**Best**

Never imply one universally wins.

The interface should help the farmer compare trade-offs.

---

# 33 — SCENARIO SCORING

Each scenario should show separate dimensions.

### Water

████████░░

### Soil

███████░░░

### Climate

███████░░░

### Diversity

██████░░░░

### Yield Stability

███████░░░

Do not collapse everything into one giant score.

A small summary may show:

**Fit to your priorities**

but keep dimensions separate.

---

# 34 — PLAUSIBLE ROTATION TIMELINE

Inside each scenario card, show an example multi-season rotation.

### Water Saver

**2026**
Current crop

Alfalfa

↓

**2027**
Wheat

↓

**2028**
Cover Crop

↓

**2029**
Sorghum

---

### Soil Builder

**2026**
Alfalfa

↓

**2027**
Soybean

↓

**2028**
Cover Crop

↓

**2029**
Wheat

---

### Balanced Rotation

**2026**
Alfalfa

↓

**2027**
Sorghum

↓

**2028**
Soybean

↓

**2029**
Cover Crop

---

All example values and crop sequences should be clearly treated as **illustrative prototype outputs** until connected to validated agronomic datasets.

---

# 35 — SCENARIO “WHY?”

Each scenario card must have:

**Why this scenario?**

When clicked, open an explanation drawer.

This is where the previous standalone Explainability page is now integrated.

---

# 36 — ROTATION EXPLAINABILITY DRAWER

Title:

# **Why was this rotation generated?**

Show a transparent reasoning chain.

## 01 — Field conditions

Soil moisture:

**31%**

Recent rainfall:

**Below historical range**

Temperature:

**Above recent average**

Water stress:

**Moderate**

---

## 02 — Crop characteristics

Water-demand profile

Climate sensitivity

Soil considerations

Previous crop compatibility

Crop diversity

---

## 03 — Farmer priorities

Water Saving:

**40%**

Soil Health:

**30%**

Climate:

**20%**

Yield:

**10%**

---

## 04 — Scenario logic

Example:

**The scenario places greater emphasis on lower water demand because water conservation is a high-priority objective and the field is currently experiencing moderate water stress.**

---

## 05 — Score breakdown

Water:

**0.90**

Soil:

**0.50**

Climate:

**0.40**

Diversity:

**0.30**

Show how the final scenario score is derived from these dimensions.

---

# 37 — DATA-SOURCE BADGES

Every explanation should have small badges:

**NASA SMAP**

**NASA GPM**

**NASA NDVI**

**Local Soil Data**

**Crop Database**

Clicking the badge opens source information.

---

# 38 — SCENARIO DETAIL

When clicking:

**View Scenario**

show a detailed 4-year rotation timeline.

For every year show:

Crop

Water demand

Soil considerations

Climate considerations

Rotation compatibility

Important factors

---

At the top:

**Scenario: Water Saver**

**Generated from current field conditions and saved priorities**

---

# 39 — PAGE 6: SCENARIO COMPARISON

Title:

# **Compare Rotation Scenarios**

Create three-column desktop comparison.

Each column contains:

Scenario name

Description

4-year timeline

Water demand

Soil impact

Climate sensitivity

Crop diversity

Yield stability

---

Under each scenario:

**Why this scenario?**

expandable explanation.

---

# 40 — MOBILE SCENARIO COMPARISON

Do NOT keep three columns on mobile.

Convert to:

Scenario A

↓

Scenario B

↓

Scenario C

with horizontal swipe comparison or expandable cards.

---

# 41 — PAGE 7: SCENARIO LAB / WHAT-IF

Title:

# **Scenario Lab**

Subtitle:

**Change environmental conditions and see how your rotation scenarios respond.**

This should feel scientific but understandable.

---

# 42 — WHAT-IF CONTROLS

## Rainfall

Historical

↓10%

↓20%

↓30%

---

## Temperature

Historical

+1°C

+2°C

+3°C

---

## Water Availability

High

Medium

Low

---

## Soil Recovery Priority

Low

Medium

High

---

Use interactive controls.

---

# 43 — WHAT-IF RESPONSE

When a scenario changes, update:

Crop suitability

Water stress

Drought risk

Rotation scenario

Field resilience

---

Create a clear:

# Current vs Scenario

comparison.

Example:

### Current

Rainfall:

100%

Temperature:

31°C

Water availability:

100%

Field resilience:

78

---

### Scenario

Rainfall:

80%

Temperature:

+2°C

Water availability:

70%

Field resilience:

64

---

Label:

**Modeled scenario**

---

# 44 — SCENARIO RESPONSE VISUALIZATION

Create a responsive chart:

**Scenario response under changing conditions**

Show multiple scenario lines.

Allow the farmer to see how:

Water Saver

Soil Builder

Balanced Rotation

respond differently.

Use smooth animation between states.

Avoid visual clutter.

---

# 45 — PAGE 8: FIELD RESILIENCE

Title:

# **Field Resilience**

Subtitle:

**Understand how your current plan handles environmental stress.**

Show:

# 78 / 100

**Field Resilience**

Then:

Drought resilience

74

Heat resilience

61

Water resilience

82

Rainfall resilience

76

Soil resilience

84

---

# 46 — RESILIENCE EXPLANATION

Section:

### Main vulnerabilities

Increasing temperature

Irrigation dependency

Moderate drought exposure

Section:

### Potential improvements

Increase water-efficient crop selection

Introduce soil-improving crops

Monitor soil moisture more frequently

Keep explanations neutral and transparent.

---

# 47 — PAGE 9: CLIMATE INSIGHTS

Title:

# **Climate Insights**

Show:

Rainfall

Temperature

Soil Moisture

NDVI

Evapotranspiration

Each includes:

Current value

Historical comparison

Trend

Data source

Last update

---

# 48 — PAGE 10: ALERTS

Title:

# **Field Alerts**

Example:

### WATER STRESS

**Field 01 soil moisture is below its recent historical range.**

Severity:

Moderate

Field:

Field 01

Date:

27 Sep 2026

Source:

NASA SMAP

---

### RAIN EVENT

**Recent rainfall may affect field conditions.**

---

### VEGETATION CHANGE

**NDVI has changed compared with the previous period.**

Use neutral language.

Do not make dangerous or excessively authoritative agricultural instructions.

---

# 49 — ALERT DETAIL DRAWER

Click an alert.

Show:

What happened?

Which field?

What data supports it?

When was it observed?

Data source

What to monitor

Use:

**Review field conditions**

rather than overly prescriptive instructions.

---

# 50 — AI ASSISTANT

Do NOT create a separate full AI page.

Create a small persistent button in the application.

## Button

Bottom-right:

**AI Assistant**

or

**Ask FutureField**

Keep it subtle.

---

# 51 — AI ASSISTANT OPEN STATE

Clicking the button opens a compact side drawer or bottom sheet.

Title:

# **FutureField Assistant**

Subtitle:

**Ask about your field, crops, or rotation scenarios.**

Suggested questions:

**Why is water stress increasing?**

**Why was this scenario generated?**

**How did rainfall affect the plan?**

**What changed from last season?**

**Explain this chart**

---

# 52 — AI RESPONSE DESIGN

Example:

User:

**Why did you generate the Soil Builder scenario?**

Assistant:

**FutureField generated this scenario because soil health has a high priority in your current settings, the field is showing moderate water stress, and the rotation increases crop diversity through a soil-improving phase.**

Then show:

### Sources used

NASA SMAP

NASA GPM

NASA NDVI

Local Soil Profile

Crop Database

---

If information is missing:

**I don't have enough field-specific data to answer that confidently.**

Never allow the assistant to fabricate field information.

---

# 53 — AI ASSISTANT DISCLAIMER

Small footer:

**FutureField provides decision support and does not replace local agronomic advice.**

---

# 54 — PAGE 11: DATA EXPLORER

Title:

# **Data Explorer**

For advanced users.

Controls:

Dataset

Region

Variable

Date

Resolution

---

Datasets:

NASA SMAP

NASA GPM

NASA POWER

MODIS / VIIRS

NDVI

Landsat / OpenET

Local Soil Data

---

Layout:

Map

Chart

Metadata

---

Metadata:

Source

Acquisition date

Spatial resolution

Temporal resolution

Processing status

---

# 55 — DATA PROVENANCE

Create a dedicated modal:

# **Data Sources**

Show:

### NASA SMAP
Soil Moisture

### NASA GPM
Precipitation

### NASA POWER
Climate variables

### NASA NDVI / MODIS / VIIRS
Vegetation condition

### Landsat / OpenET
Evapotranspiration

### Local Soil Data
Soil characteristics

### Crop Database
Crop requirements and characteristics

Each source:

Description

Data type

Last updated

View source

---

# 56 — PAGE 12: REPORT

Title:

# **Field 01 — Seasonal Decision Report**

Create a professional report preview.

Sections:

Field overview

Current conditions

Environmental observations

Soil profile

Crop history

Candidate crops

Rotation scenarios

Scenario comparison

What-if scenario

Field resilience

Key uncertainties

Data sources

---

Primary button:

**Export Report**

Secondary:

**Share with Agronomist**

The report must look professional enough for:

- farmer use
- agronomist review
- researcher review
- NASA Space Apps judging

---

# 57 — LANDING / FIRST-TIME EXPERIENCE

Create a simple onboarding page.

Hero:

# **Make smarter farm plans for a changing climate.**

Subtext:

**FutureField combines Earth observation data, field conditions, crop information, and your priorities to help you explore resilient crop rotations.**

Buttons:

**Explore Demo Farm**

**Add My Field**

Secondary:

**See How It Works**

---

# 58 — ONBOARDING FLOW

### Step 1

**Tell us about your farm**

### Step 2

**Choose your field**

### Step 3

**Add soil information**

### Step 4

**Add crop history**

### Step 5

**Set your priorities**

### Step 6

**Analyze your field**

Keep the flow simple.

---

# 59 — DEMO FARM

Use a fictional demo farm:

# **Green Valley Farm**

Location:

**Chattogram, Bangladesh**

Example field:

**Field 01**

Area:

**12.4 ha**

Current crop:

**Rice**

Use realistic-looking but clearly illustrative prototype values.

Example:

Soil moisture:

**31%**

14-day rainfall:

**42 mm**

NDVI:

**0.62**

ET:

**4.8 mm/day**

Water stress:

**Moderate**

Historical rainfall:

**18% below recent average**

Clearly show:

**Demo data**

where relevant.

Do not imply these values are live measurements.

---

# 60 — DATA UNCERTAINTY

FutureField must communicate uncertainty.

When data is unavailable:

**Some observations are unavailable. Results use the latest available data.**

When data is estimated:

**Modeled**

When value is prototype data:

**Illustrative**

When data has a historical comparison:

**Compared with historical baseline**

This is essential for user trust.

---

# 61 — LOADING STATES

Create polished loading states.

Example:

**Connecting to Earth observation data…**

**Analyzing field conditions…**

**Building rotation scenarios…**

Use progress steps rather than generic loaders.

---

# 62 — ERROR STATES

Example:

**We couldn't retrieve the latest observation.**

Button:

**Try Again**

---

Partial data:

**Some datasets are temporarily unavailable. Results are based on the latest available observations.**

---

No field:

**No field selected**

**Select or add a field to begin.**

---

# 63 — INTERACTION REQUIREMENTS

The Figma prototype must be genuinely clickable.

Connect:

Dashboard

→ field selection

Field selection

→ Field Intelligence

Field Intelligence

→ Crop Analysis

Crop Analysis

→ Rotation Planner

Rotation Planner

→ Generate Scenarios

Generated Scenarios

→ Compare Scenarios

Scenario

→ Why this scenario?

Scenario

→ Scenario Detail

Scenario Detail

→ Scenario Lab

Scenario Detail

→ AI Assistant

Scenario Detail

→ Save Scenario

Saved Scenario

→ Report

---

# 64 — MAP INTERACTION

Click field:

Update:

Field Intelligence panel

Metrics

Charts

Selected state

Field name

---

Click:

**Soil Moisture**

Map changes to soil moisture layer.

---

Click:

**Rainfall**

Map changes to rainfall.

---

Click:

**NDVI**

Map changes to vegetation layer.

---

Click:

**Drought Risk**

Map changes to drought-risk visualization.

---

# 65 — MY FIELDS INTERACTION

Click:

**View Field**

→ Field Intelligence

Click:

**Plan Next Crop**

→ Rotation Planner

Click:

**Monitor**

→ Monitoring state

Click:

**History**

→ Historical data drawer

Hover:

Reveal field summary

Click:

**More**

→ Field actions menu

The page should feel dynamic, not static.

---

# 66 — ROTATION PLANNER INTERACTION

Changing a priority slider should immediately update:

Priority percentage

Priority summary

Candidate crop emphasis

Scenario generation inputs

Changing candidate crop selection should update the selected crop list.

Clicking:

**Generate Rotation Scenarios**

shows a loading sequence.

After generation:

Three scenarios appear.

Clicking:

**Why this scenario?**

opens explanation drawer.

Click:

**Compare Scenarios**

opens comparison screen.

---

# 67 — WHAT-IF INTERACTION

Changing:

Rainfall

Temperature

Water availability

must visually update:

Scenario metrics

Crop suitability

Water stress

Resilience

Charts

Use smooth transitions.

Clearly indicate:

**Modeled scenario**

---

# 68 — SAVE STATES

When farmer saves:

Change:

**Save Scenario**

to:

**Saved ✓**

Display subtle toast:

**Rotation scenario saved.**

---

# 69 — RESPONSIVE DESIGN

Design:

### Desktop

1440 × 900

### Laptop

1280 × 800

### Tablet

1024 × 1366

### Mobile

390 × 844

---

# 70 — MOBILE NAVIGATION

Bottom navigation:

**Home**

**Fields**

**Planner**

**Alerts**

**More**

AI Assistant remains a floating button.

---

# 71 — MOBILE DASHBOARD

Show immediately:

Current field

Soil moisture

Rainfall

NDVI

Water stress

Primary CTA:

# **Plan Next Crop**

Map should become full-width.

Metrics stack vertically.

---

# 72 — MOBILE ROTATION PLANNER

Priority sliders become vertically stacked.

Candidate crops become cards.

Scenario comparison becomes swipeable cards.

Timeline becomes vertical.

Explanation drawer becomes bottom sheet.

What-if controls remain touch-friendly.

---

# 73 — ACCESSIBILITY

Ensure:

Strong contrast

Readable font sizes

Touch-friendly controls

Visible focus states

Keyboard navigation

Text labels alongside color

Accessible chart labels

Do not communicate risk using color alone.

Example:

**Moderate Risk**

plus amber indicator.

---

# 74 — COMPONENT LIBRARY

Create reusable Figma components.

## Navigation

Sidebar

Top bar

Bottom navigation

Breadcrumbs

---

## Maps

Field polygon

Selected field

Field marker

Layer control

Legend

Map controls

---

## Data

Metric card

Compact metric

Sparkline

Line chart

Bar chart

Progress bar

Status badge

Data-source badge

---

## Agricultural

Field card

Crop card

Scenario card

Timeline item

Rotation card

Resilience component

Alert card

---

## Inputs

Slider

Toggle

Dropdown

Search

Date picker

Checkbox

---

## Interaction

Drawer

Modal

Tooltip

Toast

Command/action menu

---

## AI

Assistant button

Assistant drawer

Suggested question

AI response

Source badge

---

# 75 — COMPONENT STATES

Create variants for:

Default

Hover

Active

Selected

Disabled

Loading

Success

Warning

Error

---

# 76 — REALISTIC DATA VISUALIZATION

Charts must feel scientific.

Use:

- line charts for trends
- horizontal bars for comparisons
- sparklines for compact metrics
- stacked or grouped charts where meaningful
- radar chart only when useful for resilience dimensions

Avoid:

- 3D charts
- decorative graphs
- fake precision
- unexplained numbers
- excessive chart types

---

# 77 — MAP REALISM

The Bangladesh demo environment must feel believable.

Include:

- irregular agricultural plots
- rice fields
- ponds
- small waterways
- roads
- scattered settlements
- vegetation
- realistic terrain

Use satellite-style textures without making the interface visually noisy.

---

# 78 — NASA BRANDING

NASA should be visible as a **data source**, not dominate the branding.

Use:

**Powered by NASA Earth Observations**

or:

**NASA SMAP**

**NASA GPM**

**NASA NDVI**

Do NOT invent NASA branding assets.

Do NOT make FutureField look like an official NASA product.

FutureField is its own product.

---

# 79 — TRUST MODEL

FutureField should not look like an AI that commands the farmer.

It should look like a tool that helps the farmer understand choices.

The interface should communicate:

### What do we observe?

Field data.

### What does it mean?

Condition analysis.

### What are the options?

Crop candidates.

### How do they differ?

Scenario comparisons.

### Why was this scenario generated?

Explainability.

### What happens if conditions change?

Scenario Lab.

### What should the farmer decide?

The farmer decides.

---

# 80 — CORE VALUE PROPOSITION

The main innovation of FutureField should visually revolve around:

# **Rotation Planner + Scenario Generation + Explainability + What-If Analysis**

not simply:

**“Satellite dashboard.”**

The platform should clearly demonstrate that NASA Earth observations are being transformed into a **farm-planning workflow**.

---

# 81 — HERO PRESENTATION SCREEN

Create one especially polished screen that can serve as the main NASA Space Apps presentation image.

Composition:

### Left

FutureField navigation.

### Center

Large realistic Bangladesh agricultural map.

### Right

**Field Intelligence**

panel.

### Bottom

**Rotation Scenarios**

preview.

### Top

NASA data status.

Show a subtle flow:

**NASA Earth Data**

↓

**Field Intelligence**

↓

**Rotation Scenarios**

↓

**What-If Planning**

This single image should immediately explain the product.

---

# 82 — FINAL DEMO STORY

The prototype should support this exact story:

### 01

Farmer opens FutureField.

### 02

Farmer selects:

**Green Valley Farm**

### 03

Farmer selects:

**Field 01**

### 04

FutureField displays:

Soil moisture

Rainfall

NDVI

Temperature

Water stress

### 05

Farmer opens:

**Field Intelligence**

### 06

Farmer explores historical trends.

### 07

Farmer clicks:

**Rotation Planner**

### 08

Farmer adjusts:

Water Saving

Soil Health

Climate Resilience

Yield

### 09

Farmer selects candidate crops.

### 10

Farmer clicks:

**Generate Rotation Scenarios**

### 11

FutureField generates:

**Water Saver**

**Soil Builder**

**Balanced Rotation**

### 12

Farmer compares the scenarios.

### 13

Farmer clicks:

**Why this scenario?**

The explanation shows:

Field conditions

Crop requirements

Previous crop

Farmer priorities

Scoring breakdown

Data sources

### 14

Farmer opens:

**Scenario Lab**

### 15

Farmer changes:

Rainfall −20%

Temperature +2°C

Water availability ↓

### 16

FutureField updates:

Crop suitability

Water stress

Scenario response

Field resilience

### 17

Farmer opens:

**AI Assistant**

and asks:

**“Why did the Soil Builder scenario change?”**

The assistant answers using available field data and cites its sources.

### 18

Farmer saves the scenario.

### 19

Farmer generates:

**Seasonal Decision Report**

---

# 83 — DESIGN PRIORITY

Do NOT spend equal effort on every screen.

The most polished screens must be:

### Priority 1

**Dashboard**

**Field Intelligence**

**Rotation Planner**

**Scenario Comparison**

**Scenario Lab**

### Priority 2

**My Fields**

**Crop Analysis**

**Field Resilience**

**Climate Insights**

### Priority 3

**Alerts**

**Data Explorer**

**Reports**

**AI Assistant**

The core decision-making flow must receive the highest visual and interaction quality.

---

# 84 — FINAL UX PRINCIPLE

Every important number must answer:

# **“So what?”**

Example:

Not:

**31%**

Instead:

**31% Soil Moisture**

**Below your recent historical range**

Not:

**0.62 NDVI**

Instead:

**Vegetation Health — 0.62**

**Stable compared with previous period**

Not:

**86% suitability**

Instead:

**86% suitability**

**Why?**

Adequate soil moisture

Compatible temperature

Moderate water demand

Good rotation compatibility

---

# 85 — FINAL PRODUCT STATEMENT

FutureField should feel like a real agricultural decision-support platform that bridges:

**NASA Earth Observation**

with

**Local Farm Conditions**

with

**Crop Knowledge**

with

**Farmer Priorities**

to create:

**Understandable → Explainable → Scenario-based → Climate-aware farm planning**

The final Figma prototype must be:

**High fidelity**

**Responsive**

**Interactive**

**Farmer-friendly**

**Scientifically credible**

**Visually polished**

**Data-focused**

**Easy to navigate**

**Presentation-ready**

Most importantly:

## Do not design FutureField as “an AI farm dashboard.”

Design it as:

# **A practical decision-support system that helps farmers explore better crop rotations under changing environmental conditions.**

The central experience should always lead from:

**“What is happening in my field?”**

to:

**“What could I plant next?”**

to:

**“What rotation options do I have?”**

to:

**“Why does this scenario make sense?”**

to:

**“What happens if conditions change?”**

and finally:

**“Which plan fits my farm and my priorities?”**

Create the complete high-fidelity Figma prototype with all responsive layouts, reusable components, realistic states, map interactions, scenario interactions, explanation drawers, farmer-friendly microcopy, and connected prototype transitions described above.

The final product should look strong enough for a **NASA Space Apps Challenge 2026 presentation, technical demonstration, and live product walkthrough.**