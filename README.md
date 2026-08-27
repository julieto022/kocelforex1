# Kocel Trade Connect

Kocel Forex Hub — Phase 1: Complete UI/UX Foundation & Account System
MASTER DEVELOPMENT PROMPT
Build Phase 1 of Kocel Forex Hub, a modern, professional, broker-independent MT5 trading platform designed to allow users to create a Kocel account and connect one or more external MT5 broker accounts such as Deriv MT5, Exness MT5, and other supported MT5 brokers.

The application must be designed from the beginning as a scalable platform. Do not hard-code the system around Deriv.

The application name is:

Kocel Forex Hub

Tagline:

One Hub. Any MT5 Broker. Smarter Trading.

1. CORE PRODUCT CONCEPT
   Kocel Forex Hub is not a broker.

Kocel is an independent trading-management and automation platform that connects to users’ MT5 accounts through a Kocel Bridge EA installed on the user’s MT5 terminal.

The architecture must be:

User → Kocel Account → Broker Connection → MT5 Terminal → Kocel Bridge EA → Kocel Platform

Examples:

Kocel → Deriv MT5

Kocel → Exness MT5

Kocel → Future MT5 Broker

Do NOT design the system around:

Deriv OAuth
Deriv login
Deriv API authentication as the primary architecture
Broker-specific Kocel accounts
Asking users to log into Kocel with their broker credentials
The user creates a completely independent Kocel account.

The broker account is then connected separately under Settings.

2. PHASE 1 OBJECTIVE
   Phase 1 must establish the complete visual and functional foundation for Kocel Forex Hub.

Implement:

Landing page
Kocel account registration
Kocel account login
Forgot password UX
User onboarding
Main dashboard
Sidebar navigation
Top navigation
Broker connection management
MT5 connection setup UI
Kocel Bridge EA setup instructions
Account status indicators
Profile/settings
Security settings
Notification settings
Responsive mobile interface
Desktop interface
Dark/light theme
Empty states
Loading states
Error states
Connection states
Modal system
Toast notification system
Reusable UI components
Proper frontend architecture
Backend-ready API structure
Database-ready data models
Phase 1 should NOT attempt to implement the complete trading engine.

However, every UI component must be designed so Phase 2+ can connect real functionality without rebuilding the interface.

3. DESIGN DIRECTION
   Create a premium fintech/trading SaaS interface.

The design should feel like a combination of:

TradingView
MetaTrader
modern fintech dashboards
professional broker platforms
modern SaaS applications
Do NOT copy any company’s interface.

Use an original Kocel design language.

The UI should feel:

Professional
Fast
Clean
Technical
Premium
Trustworthy
Modern
Data-focused
Easy to understand
Avoid excessive gradients, oversized cards, unnecessary animations, and clutter.

4. COLOR SYSTEM
   Primary brand color:

Kocel Green

Use green primarily for:

Primary buttons
Positive values
Connected status
BUY indicators
Success states
Active navigation
Supporting colors:

Deep black
Dark charcoal
White
Light gray
Medium gray
Red for errors/losses
Amber for warnings
Blue for informational states
The application must support:

Dark Mode
Dark trading-terminal appearance.

Light Mode
Clean professional fintech appearance.

Theme switching must be available from Settings.

Persist the user’s selected theme.

5. RESPONSIVE DESIGN
   The application must work perfectly on:

iPhone
Android phones
tablets
laptops
desktops
large monitors
Do not simply shrink the desktop interface on mobile.

Create proper responsive layouts.

Desktop
Use:

Fixed sidebar
Top navigation
Multi-column dashboard
Large data cards
Tables
Charts/placeholders
Tablet
Use:

Collapsible sidebar
Responsive cards
Scrollable tables where necessary
Mobile
Use:

Compact top bar
Bottom navigation or collapsible navigation
Stacked cards
Horizontal scrolling for financial tables
Large touch-friendly controls
Mobile-friendly forms 6. PUBLIC LANDING PAGE
Create a professional public homepage.

Sections:

Hero
Headline:

Trade Smarter. Connect Any MT5 Broker.

Subheadline:

Kocel Forex Hub gives traders one powerful platform to monitor, analyze and automate their MT5 trading across supported brokers.

Buttons:

Create Free Account

Sign In

Add a visual representation of the Kocel trading dashboard.

Broker Compatibility Section
Show:

Connect Your MT5 Broker

Display cards for:

Deriv MT5
Exness MT5
MT5 Broker
More Coming Soon
Do not imply that every broker is already supported.

Use:

Supported

Coming Soon

status labels where appropriate.

Features Section
Cards:

Multi-Broker
Connect multiple MT5 accounts from one Kocel account.

Automated Trading
Run Kocel trading bots through your connected MT5 terminal.

Strategy Engine
Build and apply multiple trading strategies.

Risk Management
Control exposure and trading risk.

Trade Monitoring
Monitor open positions and trading activity.

Performance Analytics
Analyze trading history and performance.

How It Works
Create a 4-step visual process:

Create Kocel Account
Connect MT5 Broker
Install Kocel Bridge EA
Start Trading
Security Section
Explain that:

Kocel accounts are independent from broker accounts.
Broker credentials should not be used as Kocel login credentials.
MT5 connectivity is established through the Kocel Bridge architecture.
Users control which broker accounts are connected.
Trading permissions should be clearly displayed.
Do not make unsupported claims such as “bank-level security” unless actually implemented.

Footer
Include:

Kocel Forex Hub
About
Features
Supported Brokers
Security
Terms
Privacy
Contact
Login
Create Account 7. KOCEL ACCOUNT REGISTRATION
Create a dedicated registration page.

Fields:

Full Name
Username
Email
Password
Confirm Password
Country
Phone Number
Optional:

Referral Code
Checkbox:

I agree to the Terms of Service and Privacy Policy.

Button:

Create Kocel Account

After successful registration:

Redirect to onboarding.

Do not request broker login credentials during registration.

8. LOGIN PAGE
   Create a dedicated Kocel login page.

Fields:

Email or Username
Password
Options:

Remember Me
Forgot Password
Button:

Sign In

Also provide:

Create Account

Important:

The login must authenticate against the Kocel account system.

It must NOT redirect the user to Deriv or another broker for authentication.

9. FORGOT PASSWORD
   Create:

Enter Email
User enters their Kocel account email.

Then show:

Check Your Email

Include a secure password-reset workflow placeholder.

Do not expose whether an email exists in a way that leaks account information.

10. USER ONBOARDING
    After first login, show a clean onboarding wizard.

Step 1 — Welcome
Welcome to Kocel Forex Hub

Explain the platform.

Step 2 — Connect MT5
Explain:

Connect your first MT5 trading account.

Button:

Connect MT5 Account

Option:

Skip for Now

Step 3 — Install Bridge EA
Explain that Kocel uses the Kocel Bridge EA to communicate with the user’s MT5 terminal.

Show:

Download Kocel Bridge EA

Installation Guide

Step 4 — Finish
Display:

Your Kocel workspace is ready.

Button:

Go to Dashboard

Allow users to skip onboarding and return later.

11. MAIN APPLICATION LAYOUT
    After login, use the main Kocel application shell.

Desktop:

Left Sidebar
Logo:

KOCEL

Navigation:

Dashboard
Bots
Strategies
Trades
Analysis
Markets
Divider.

Settings
Then:

Help
Documentation
Bottom:

User profile.

12. TOP BAR
    Top navigation should display:

Left:

Page title
Optional breadcrumb
Right:

Broker/Account selector
Connection status
Notifications
Theme toggle
User avatar
Example:

MT5 Account: Exness — 12345678

Status:

🟢 Connected

Provide a dropdown for switching between connected accounts.

If there are no connected accounts:

No MT5 account connected

Button:

Connect Account

13. DASHBOARD
    Create a professional trading dashboard.

Top section:

Account Summary
Cards:

Balance
Equity
Free Margin
Margin Level
Today’s P/L
Total P/L
If no MT5 account is connected, show:

Connect an MT5 account to see live account information.

Button:

Connect MT5 Account

Do not display fake financial data.

Use skeleton/loading states while data is loading.

14. CONNECTION STATUS
    Create a persistent connection indicator.

Possible states:

Connected
Green:

MT5 Connected

Connecting
Amber:

Connecting…

Disconnected
Red/gray:

MT5 Disconnected

Not Configured
Gray:

Not Connected

Clicking the indicator opens connection details.

15. RECENT TRADES
    Dashboard section:

Recent Trades

Columns:

Symbol
Type
Volume
Entry
Current
SL
TP
P/L
Time
Status
Example empty state:

No trades yet

Do not populate fake trades.

16. MARKET WATCH
    Create a market-watch component.

Columns:

Symbol
Bid
Ask
Spread
Change
Status
Example instruments:

EURUSD
GBPUSD
USDJPY
AUDUSD
XAUUSD
US30
NAS100
These should be UI placeholders in Phase 1 unless real market data is explicitly implemented.

Never simulate fake live prices and present them as real.

17. PERFORMANCE AREA
    Create a dashboard performance section.

Charts/placeholders:

Equity Curve
Daily P/L
Win Rate
Drawdown
When no trading data exists:

Performance data will appear after your connected MT5 account begins providing trading history.

18. BOT OVERVIEW
    Dashboard card:

Active Bots

Show:

Bot Name
Broker
Symbol
Status
P/L
Statuses:

Running
Stopped
Paused
Error
Waiting
Phase 1 should display an empty state if no bots exist.

Button:

Create Bot

The actual bot engine will be implemented in later phases.

19. BROKER CONNECTION SYSTEM
    This is one of the most important Phase 1 components.

Create:

Settings → MT5 Accounts

Page title:

MT5 Broker Accounts

Description:

Connect and manage your MT5 trading accounts from one Kocel workspace.

Button:

- Connect MT5 Account

20. BROKER SELECTION
    When connecting an account, show:

Select Broker
Cards:

Deriv MT5

Status:

Supported

Exness MT5

Status:

Supported

Other MT5 Broker

Status:

Coming Soon / Manual configuration

Architecture must allow future brokers to be added without redesigning the database.

21. MT5 ACCOUNT CONFIGURATION
    After selecting a broker, display:

MT5 Account Details
Fields:

Account Name
Broker
MT5 Login/Account Number
Server
Account Type
Environment
Optional Label
Environment:

Demo
Real
Do NOT ask users for their Kocel password here.

Do not make the frontend store a broker trading password unless the later backend architecture explicitly requires a secure encrypted credential mechanism.

The preferred Phase 1 architecture is:

MT5 account credentials remain in the user’s MT5 terminal.

Kocel communicates through the Kocel Bridge EA.

22. CONNECTION METHOD
    Display:

Kocel Bridge EA
Explain:

The Kocel Bridge EA runs inside your MT5 terminal and securely communicates your approved account status and trading instructions with Kocel Forex Hub.

Show steps:

Download Kocel Bridge EA
Open MetaTrader 5
Install the EA
Attach Kocel Bridge EA to a chart
Click Connect to Kocel inside the EA
Enable required permissions
Start the EA
Return to Kocel
Verify connection 23. BROWSER AUTHORIZATION
When the EA starts a connection:

Create a short-lived browser authorization request and open its URL.

Show the user the masked MT5 account, broker, server, and EA identity.

The user approves the connection in Kocel. The EA then polls for a secure Bridge session.

Possible states:

Waiting
Waiting for Bridge EA

Detected
MT5 terminal detected

Authenticating
Verifying connection…

Connected
MT5 account connected successfully

Failed
Connection failed

Button:

Retry Connection

Do not hard-code actual connection codes.

The backend will generate them later.

24. CONNECTED ACCOUNT CARD
    Display:

Exness MT5
Account:

••••••5678

Server:

Exness-MT5Real

Environment:

Real

Status:

🟢 Connected

Actions:

View
Rename
Disconnect
Never display sensitive credentials.

25. MULTIPLE MT5 ACCOUNTS
    Kocel must support multiple accounts.

Example:

Deriv Demo
Deriv Real
Exness Demo
Exness Real
Future Broker
Each account should have:

Unique ID
Broker
MT5 login
Server
Environment
Connection status
Last connected timestamp
Created timestamp
User-defined nickname
Allow users to select their active trading account.

26. DISCONNECT ACCOUNT
    When disconnecting:

Show confirmation modal:

Disconnect MT5 Account?

Explain:

Disconnecting removes this MT5 account from your active Kocel workspace. Existing MT5 trades are not automatically closed.

Buttons:

Cancel

Disconnect

This distinction is important.

Disconnecting Kocel should not automatically close broker positions.

27. SETTINGS
    Create a complete Settings area.

Sections:

Profile
Name
Username
Email
Phone
Country
Profile photo
Security
Change Password
Two-factor authentication placeholder
Active sessions
Logout all devices
MT5 Accounts
Connected accounts
Add account
Remove account
Notifications
Options:

Trade notifications
Bot notifications
Connection alerts
Risk alerts
Email notifications
Push notifications
Appearance
Dark
Light
System
Trading Preferences
Phase 1 placeholders:

Default account
Default risk profile
Default chart settings
Default currency
General
Language
Time zone
Date format 28. BOTS PAGE
Create the UI foundation for:

Bots

Page should show:

Bot list
Bot status
Connected account
Symbol
Strategy
Risk profile
P/L
Created date
Buttons:

Create Bot

View

Start

Stop

However, Phase 1 should not pretend that trading execution is operational.

If the engine is not connected:

Trading engine not configured

Use clear states rather than fake execution.

29. STRATEGIES PAGE
    Create:

Strategies

Allow users to see strategy cards.

Examples:

Kocel AI Scalper
Trend Following
EMA Crossover
Breakout
Support & Resistance
Custom Strategy
Each card:

Name
Description
Timeframe
Markets
Status
Buttons:

View Strategy

Create Bot

The actual strategy engine will be implemented later.

30. TRADES PAGE
    Create:

Open Trades
Columns:

Ticket
Symbol
Type
Volume
Entry
Current
SL
TP
P/L
Duration
Trade History
Filters:

Date
Account
Symbol
Buy/Sell
Profit/Loss
Bot
Strategy
Phase 1 must use empty states when no data exists.

31. ANALYSIS PAGE
    Create the future analysis workspace.

Include UI placeholders for:

Market analysis
Trend
Momentum
Volatility
Support/Resistance
Technical indicators
Multi-timeframe analysis
AI confidence
Display:

Analysis engine will become available when market data and strategy services are connected.

Do not create fake analysis results.

32. MARKETS PAGE
    Create a professional market browser.

Categories:

Forex
EURUSD
GBPUSD
USDJPY
AUDUSD
USDCHF
USDCAD
NZDUSD
Metals
XAUUSD
XAGUSD
Indices
US30
NAS100
SPX500
GER40
UK100
Other
Leave architecture open for:

Commodities
Crypto CFDs
Stocks
Other broker instruments
Important:

The available symbols must ultimately come from the connected broker rather than assuming every broker supports every symbol.

33. GLOBAL COMPONENTS
    Create reusable components for:

Buttons
Cards
Tables
Dropdowns
Tabs
Modals
Toasts
Alerts
Badges
Status indicators
Tooltips
Form fields
Select fields
Date pickers
Search
Pagination
Empty states
Loading skeletons
Error states
Confirmation dialogs 34. EMPTY STATES
Never show broken-looking screens.

Examples:

No Broker
No MT5 account connected

Connect your MT5 account to begin.

Button:

Connect MT5

No Bots
You haven’t created a trading bot yet.

Button:

Create Your First Bot

No Trades
No trading activity yet.

No Strategies
No strategies available yet.

No Notifications
You’re all caught up.

35. LOADING STATES
    Every asynchronous section must have a skeleton/loading state.

Examples:

Dashboard skeleton
Account skeleton
Trade table skeleton
Broker connection skeleton
Market skeleton
Do not freeze the entire application while one component loads.

36. ERROR STATES
    Create professional errors.

Example:

Unable to load MT5 account

Please check your connection and try again.

Buttons:

Retry

Settings

Connection error:

MT5 Bridge is offline

Show:

Last connection
Retry
Connection instructions 37. NOTIFICATION SYSTEM
Create a global notification center.

Notification types:

Account connected
Account disconnected
Bridge offline
Bot started
Bot stopped
Trade opened
Trade closed
Risk warning
System notification
Phase 1 can use frontend/mock notification states, but structure them for backend integration.

38. USER PROFILE MENU
    Top-right profile menu:

Display:

User Name

user@email.com

Options:

Profile
Settings
Security
Help
Logout 39. SECURITY UX
Security should be treated seriously.

Never expose:

Broker passwords
API secrets
Authentication tokens
Private connection credentials
Mask account numbers where appropriate.

Example:

MT5 ••••••4821

Use confirmation dialogs for:

Disconnect account
Delete account
Logout all sessions
Security changes 40. DATABASE-READY ARCHITECTURE
Design the frontend/backend contracts around entities such as:

users
id
name
username
email
password_hash
country
phone
created_at
updated_at
broker_connections
id
user_id
broker_id
account_name
mt5_login
server
environment
status
connection_code
last_seen_at
created_at
updated_at
brokers
id
name
slug
logo
status
supported
created_at
user_settings
id
user_id
theme
timezone
language
notifications
bots
id
user_id
broker_connection_id
strategy_id
name
symbol
status
created_at
strategies
id
name
description
status
configuration
trades
id
user_id
broker_connection_id
bot_id
ticket
symbol
type
volume
entry_price
exit_price
profit
opened_at
closed_at
Do not necessarily implement all trading tables in Phase 1, but design the application around these relationships.

41. API-READY FRONTEND
    Create an API service layer.

Do not scatter API calls throughout components.

Use a structure similar to:

/services
auth
users
brokers
mt5
bots
strategies
trades
markets
notifications
Create clean functions such as:

login()
register()
logout()
getCurrentUser()
getBrokerList()
createMT5Connection()
getMT5Connections()
disconnectMT5()
getDashboard()
getTrades()
getBots()
getStrategies()
For Phase 1, use controlled mock services where backend endpoints are not yet implemented.

Make it easy to replace mocks with real APIs later.

42. STATE MANAGEMENT
    Implement centralized application state where appropriate.

State should include:

Authenticated user
Selected MT5 account
Broker connections
Connection status
Theme
Notifications
Dashboard data
UI preferences
Do not store sensitive credentials in localStorage.

43. ROUTING
    Create routes similar to:

/
/login
/register
/forgot-password
/onboarding

/dashboard
/bots
/bots/create
/strategies
/trades
/analysis
/markets

/settings
/settings/profile
/settings/security
/settings/mt5
/settings/notifications
/settings/appearance
Protected application routes must require Kocel authentication.

Public pages must remain accessible without authentication.

44. AUTHENTICATION UX
    Implement the frontend authentication flow properly.

Unauthenticated user:

→ Landing page

Login:

→ Dashboard

New registration:

→ Onboarding

Authenticated user visiting /login:

→ Redirect to Dashboard

Session expiration:

→ Display:

Your session has expired. Please sign in again.

45. DEMO DATA RULE
    Do NOT fabricate live financial information.

If demonstration data is required for UI development, clearly label it:

Demo Data

Never show simulated prices as:

Live

Never show simulated account balance as actual balance.

46. MT5 BRIDGE STATUS MODEL
    Prepare the frontend for these states:

NOT_CONNECTED
WAITING_FOR_BRIDGE
CONNECTING
AUTHENTICATING
CONNECTED
DISCONNECTED
ERROR
EXPIRED
Each status must have:

Label
Color
Icon
Explanation
Appropriate action 47. BROKER-AGNOSTIC ARCHITECTURE
Do not create code such as:

if broker === "deriv"
throughout the application.

Instead use broker adapters/configuration.

Conceptually:

Broker
├── id
├── name
├── logo
├── supported
├── capabilities
└── connection_config
This allows future support for additional MT5 brokers.

48. MT5 ACCOUNT CAPABILITIES
    The UI should eventually be capable of displaying broker-specific capabilities such as:

Forex
Metals
Indices
Crypto
Stocks
CFD
Hedging
Netting
Automated trading
Phase 1 should only prepare the UI/data structures.

49. ACCESSIBILITY
    Implement:

Proper labels
Keyboard navigation
Visible focus states
Accessible buttons
Accessible forms
ARIA where necessary
Good color contrast
Touch-friendly controls 50. PERFORMANCE
Optimize for:

Fast first load
Lazy-loaded dashboard sections
Code splitting
Optimized images
Efficient state updates
Minimal unnecessary network requests
Avoid heavy animations.

51. SECURITY REQUIREMENTS
    Implement basic security best practices from the beginning.

Never:

expose passwords
expose API secrets
expose internal tokens
trust frontend authorization
place private credentials in client-side code
Frontend permissions are not sufficient.

The future backend must validate:

user_id
session
resource ownership
broker account ownership
bot ownership
trade ownership 52. DESIGN DETAILS
Use:

Rounded but not excessively rounded cards
Thin borders
Subtle shadows
Professional typography
Compact trading tables
Clear hierarchy
Consistent spacing
Buttons:

Primary:

Connect MT5

Secondary:

View Details

Danger:

Disconnect

Success:

Connected

Warning:

Reconnect

53. MOBILE NAVIGATION
    On mobile, provide a bottom navigation or compact navigation system containing:

Dashboard
Bots
Trades
Markets
Menu
The Menu should contain:

Strategies
Analysis
Settings
Help
Logout
Ensure every major section remains accessible.

54. RESPONSIVE MT5 CONNECTION FLOW
    The broker connection wizard must work perfectly on mobile.

Do not create a desktop-only connection form.

The user should be able to:

Select broker
Enter account information
Generate connection code
Read Bridge EA instructions
Monitor connection
Complete setup
from a phone.

55. HELP / DOCUMENTATION
    Create a basic Help page.

Categories:

Getting Started
Connecting MT5
Kocel Bridge EA
Broker Accounts
Bots
Strategies
Trading
Security
Troubleshooting
Create placeholder documentation cards for Phase 1.

56. FINAL UI QUALITY STANDARD
    The completed Phase 1 should look like a real production SaaS product.

Do NOT deliver:

generic template styling
unfinished screens
placeholder Lorem Ipsum
fake financial results
broken mobile layouts
inconsistent buttons
inconsistent spacing
excessive empty areas
fake live trading
Every screen must have:

Proper title
Description where needed
Clear primary action
Loading state
Empty state
Error state where applicable
Responsive layout 57. IMPORTANT PHASE BOUNDARY
Phase 1 is the foundation.

Do NOT implement the full trading engine yet.

Do NOT implement:

Real automated trade execution
Real strategy execution
AI trading decisions
Real-time MT5 order execution
SL/TP execution
Position management engine
Full market-data streaming
Complete Kocel Bridge backend
Live bot execution
Those belong to later phases.

However, the UI must be fully prepared for them.

58. PHASE 1 SUCCESS CRITERIA
    Phase 1 is complete only when:

User can create a Kocel account.
User can log into Kocel.
User can log out.
User can reset password through the designed flow.
User can complete onboarding.
User sees the Kocel Dashboard.
User can switch between dark and light mode.
User can open Settings.
User can manage their profile.
User can access Security settings.
User can access MT5 Accounts.
User can select a supported broker.
User can configure an MT5 account.
User can generate a connection-code workflow.
User can see Bridge EA connection status.
User can view connected accounts.
User can disconnect an account.
User can switch active MT5 accounts.
Dashboard reacts correctly to no-account/connected-account states.
Bots page exists.
Strategies page exists.
Trades page exists.
Analysis page exists.
Markets page exists.
Notification center exists.
Help page exists.
Mobile UI works correctly.
Desktop UI works correctly.
No fake live financial data is presented as real.
The architecture is broker-independent.
The UI is ready for the Phase 2 MT5 Bridge backend. 59. MOST IMPORTANT ARCHITECTURAL PRINCIPLE
Build Kocel Forex Hub around this concept:

Kocel Account ≠ Broker Account

A user has one Kocel identity.

That Kocel identity can manage multiple MT5 broker connections.

Example:

Kocel User
│
├── Deriv MT5 Demo
│ └── Kocel Bridge EA
│
├── Deriv MT5 Real
│ └── Kocel Bridge EA
│
├── Exness MT5 Demo
│ └── Kocel Bridge EA
│
└── Future Broker
└── Kocel Bridge EA
The platform must be designed around this relationship from the beginning.

60. PHASE 1 DELIVERABLE
    Deliver a polished, fully responsive Kocel Forex Hub Phase 1 application foundation with:

Complete UI
Complete navigation
Authentication UX
User account system structure
Onboarding
Broker management
MT5 connection workflow
Kocel Bridge EA connection interface
Dashboard
Bots
Strategies
Trades
Analysis
Markets
Settings
Notifications
Help
Dark/light themes
Responsive mobile interface
Loading/empty/error states
Reusable components
API service layer
Broker-independent data architecture
Backend-ready structure
The result should feel like a serious production-ready trading platform rather than a simple dashboard template.

Do not move the application toward a Deriv-only architecture. Kocel Forex Hub must remain broker-independent from Phase 1 onward.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kocelforexhub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/79ae1262-a469-4292-b48a-6fd9c475d12e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
