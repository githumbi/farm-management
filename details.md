📄 Product Specification
Product Name (working)

ShambaTrack (you can rename later)

1. 🎯 Product Overview

ShambaTrack is a simple farm management and bookkeeping system designed for farm owners who manage operations remotely.

It enables:

Real-time expense tracking
Structured farm activity logging
Season-based profit/loss tracking
Centralized storage of receipts and progress updates

The system uses a WhatsApp-first approach for farm managers and a web dashboard for owners.

2. 👥 Target Users
Primary User: Farm Owner
Owns or leases farmland
Not physically present daily
Needs visibility on costs, progress, and profitability
Concerned about financial tracking and compliance
Secondary User: Farm Manager
On-site operator
Handles daily farm activities
Not tech-heavy
Uses WhatsApp regularly
3. 🧩 Core Problem Statements
No clear visibility into profit or loss per season
Poor tracking of expenses and categories
Receipts and records are scattered (paper/WhatsApp)
Lack of structured progress reporting
High dependence on trust with little verification
4. 🧠 Product Goals
Make expense tracking effortless (≤15 seconds per entry)
Provide real-time financial visibility
Create a single source of truth for farm operations
Enable season-based performance tracking
Support basic compliance (record keeping for KRA)
5. 🏗️ System Architecture (High Level)
Input Layer
WhatsApp (primary for managers)
Web app (owners + optional manager use)
Processing Layer
Message parsing (manual → automated later)
Categorization engine
Data storage (expenses, activities, media)
Output Layer
Web dashboard
Reports (downloadable)
6. 🔑 Core Features
6.1 Farm Setup (Owner)

Description:
Owner creates and configures farm(s)

Fields:

Farm name
Location
Size (e.g. 1 acre, 2 acres)
Ownership type (rented/owned)
Cost (rent/purchase)
6.2 Season Management

Description:
Define farming cycles for tracking performance

Fields:

Season name (e.g. Jan–April 2026)
Crop type (maize, potatoes, etc.)
Start date
End date

Behavior:

All expenses and activities are linked to a season
Multiple seasons per farm supported
6.3 Expense Tracking

Input Methods:

WhatsApp message
Web form

Fields:

Amount
Category (fertilizer, seeds, labor, transport, etc.)
Date (auto or manual)
Notes (optional)
Receipt image (optional but encouraged)

WhatsApp Example Inputs:

“Spent 3,500 on fertilizer”
“Paid labor 2,000”
Image upload → auto-tag as receipt
6.4 Activity / Progress Logging

Description:
Track farm operations beyond expenses

Inputs:

Text updates
Images/videos

Examples:

“Planted 2 acres potatoes”
“Spraying done today”
Photo of crop progress

Output:

Timeline feed (chronological)
6.5 Dashboard (Owner View)
Summary View
Total cost (per season)
Total revenue (manual input initially)
Profit/Loss
Cost breakdown by category
Detailed Views
Expense list (filterable)
Activity timeline
Receipt gallery
6.6 Profit & Loss Calculation

Formula:

Profit = Revenue – Total Costs

Displayed per:

Season
Farm
6.7 Receipt Vault

Features:

All uploaded images stored centrally
Linked to expenses
Search/filter capability

6.8 Reports & Export


Includes:

Expense summary
Category breakdown
Receipts list
7. 📲 WhatsApp Integration (Critical Feature)
Supported Actions
Log expense
Upload receipt
Log activity
Send progress images
Message Parsing (MVP)

Start simple:

Detect numbers → amount
Detect keywords → category
Everything else → notes
Future Enhancement
Structured prompts:
“Reply with category”
“Confirm entry”
8. 🧭 User Flows
Flow 1: Owner Setup
Create account
Add farm
Create season
Invite/link manager
Flow 2: Manager Logs Expense (WhatsApp)
Sends message
System parses and stores
Optional confirmation message
Flow 3: Owner Checks Performance
Opens dashboard
Selects farm + season
Views:
Total cost
Breakdown
Timeline
Profit/Loss
9. ⚙️ Non-Functional Requirements
Mobile-first web experience
Fast load times (low bandwidth environments)
Offline tolerance (graceful failure)
Secure data storage
Simple UI (low learning curve)
10. 🚀 MVP Scope (Phase 1)

Include:

Farm setup
Season creation
Expense tracking (manual + basic WhatsApp)
Dashboard (cost summary only)
Image upload (receipts & progress)

Exclude:

Advanced analytics
AI automation
Multi-user roles (keep simple)
11. 📈 Success Metrics
% of expenses logged vs actual
Weekly active usage (manager)
Number of seasons tracked
Owner retention rate
Report exports
12. 🔮 Future Enhancements
Automated WhatsApp parsing (AI)
Revenue tracking integrations
Multi-farm comparison
Alerts:
“Costs unusually high this week”
Benchmarking across farms
Input recommendations
🔥 Final Product Positioning

“A simple way to track your farm’s money, progress, and proof — all in one place.”