# TripSync: Product Requirements & Technical Specification Document

## 1. Executive Summary & Vision
TripSync is a production-grade, real-time collaborative travel planning platform. It acts as a multiplayer workspace where groups of travelers can brainstorm, organize, and finalize complex itineraries. By leveraging Google Maps for geospatial accuracy, OpenAI for intelligent discovery, and Firebase for zero-latency data synchronization, TripSync eliminates the fragmentation of traditional group planning (which usually spans across WhatsApp, Excel, and Google Docs).

---

## 2. Core Features & The User Journey

### 2.1 The Onboarding Flow
1. **Authentication**: Users log in securely via Firebase Authentication.
2. **Trip Creation & Joining**: A user creates a trip by specifying the destination, dates, and budget. The system generates a unique 8-character `inviteCode`. Friends can enter this code in the "Join Trip" page to instantly become members of the workspace.

### 2.2 The Interactive Planner (Brainstorming Phase)
- **AI Discovery**: In the Planner sidebar, users can request AI suggestions. The app returns localized recommendations ("Hidden Gems", "Must-Visits") tailored to the destination.
- **Region Exploration & Along-the-Route**: Users can click on a region or between two stops to ask the system to "Explore Places" or find "Must-visits on the way", leveraging both OpenAI and Google Places.
- **Manual Adjustments**: Users can set an `estimatedMinutes` duration for how long they intend to stay at each place. They can also manually drag-and-drop or reorder the sequence of places.

### 2.3 Democratic Decision Making
- **Polls**: To prevent arguments, members can create polls (e.g., "Which beach for Tuesday?") and cast votes. The winning place is automatically added to the itinerary.
- **Real-Time Chat**: A built-in chat system allows contextual discussion without needing to switch to WhatsApp or iMessage.

### 2.4 Smart Itinerary Generation
- **Automated Scheduling**: Once the places are selected and ordered, the app calculates the driving time between each stop using the Google Directions API. 
- **Day-Wise Splitting**: The `ItineraryPage` automatically chunks the selected places into "Days" based on a maximum daily activity threshold (e.g., 8 hours of active touring/driving per day) and the estimated durations set by the users.

### 2.5 In-Trip Utility
- **Expense Tracking**: A bill-splitting module allows members to log expenses, specify who paid, and dictate who the cost is split among. The app calculates optimal balances (who owes whom).
- **Live Location**: Members can share their live GPS coordinates, allowing the group to see each other plotted on the live map.

---

## 3. Global Architecture & The "Real-Time Reflection" Engine
A core tenant of TripSync is **ubiquitous data synchronization**. The application uses a single source of truth (Firebase Firestore) combined with a global React Context (`TripContext.jsx`).

**How Data Propagation Works (The "Reflect Everywhere" Concept):**
When *User A* performs an action on their device, Firestore pushes a WebSocket update to all active clients (*User B, User C*). The `TripContext` instantly updates the application state.
- **Example:** If User A is on the **Planner Page** and adds "Eiffel Tower" to the stops list, the following happens instantly without any user needing to hit refresh:
  1. User B, who is also looking at the **Planner Page**, sees the "Eiffel Tower" card animate into the list.
  2. User C, who is looking at the **Map Page**, sees a new pin drop on the map for the Eiffel Tower, and the driving route polyline redraws to include it.
  3. User D, who is viewing the **Itinerary Page**, sees the day-wise timeline recalculate to allocate time for the Eiffel Tower and adjust subsequent drive times.

---

## 4. Project Structure & Architecture (Foldering)

The codebase is structured following a modular, feature-based architecture that separates business logic (services) from UI components.

```text
src/
├── App.jsx                 # Root component, sets up React Router and Providers
├── main.jsx                # Application entry point, attaches React to the DOM
├── index.css               # Global stylesheet and design system variables
│
├── config/                 # External Dependency Initializers
│   ├── firebase.js         # Firebase app, db, and auth initialization
│   └── openai.js           # OpenAI client setup and prompt-generation functions
│
├── context/                # Global State Management
│   ├── AuthContext.jsx     # Manages user session, login state, and auth loading
│   └── TripContext.jsx     # Manages the active trip, real-time listeners for places & members
│
├── services/               # API & Business Logic Layer (No UI)
│   ├── firestoreService.js # All CRUD operations for Trips, Places, Polls, Chat, Expenses
│   ├── placesService.js    # Google Places integration, Geocoding, and AI data enrichment
│   └── routeService.js     # Google Directions API logic, polyline decoding, TSP optimization
│
├── components/             # Reusable UI Elements
│   ├── Navbar.jsx          # Global top navigation (Home, Profile)
│   ├── TripTopNav.jsx      # Trip-specific navigation (Planner, Map, Itinerary, Expenses)
│   ├── MapRoute.jsx        # Component for rendering polylines and markers on Google Maps
│   ├── Sidebar.jsx         # General sidebar layout wrappers
│   ├── Modal.jsx           # Reusable pop-up dialogue component
│   ├── PlaceAutocomplete.jsx # Google Places search bar wrapper
│   └── ProtectedRoute.jsx  # Route guard for authenticated-only pages
│
├── pages/                  # Top-Level Route Components
│   ├── LoginPage.jsx       # Auth screen
│   ├── TripsPage.jsx       # Dashboard showing all user trips
│   ├── CreateTripPage.jsx  # Form to initialize a new trip
│   ├── JoinTripPage.jsx    # Screen to process an invite code
│   ├── PlannerPage.jsx     # Core workspace: AI sidebar, place list, region exploration
│   ├── TripDetailPage.jsx  # The interactive fullscreen Map view
│   ├── ItineraryPage.jsx   # Day-by-day chronological breakdown of the trip
│   ├── PollsPage.jsx       # Voting interface
│   ├── ChatPage.jsx        # Real-time messaging interface
│   ├── ExpensesPage.jsx    # Bill splitting and balances interface
│   └── BlogPage.jsx        # SEO-optimized marketing and content pages
│
└── utils/                  # Helper Functions
    └── nanoid.js           # Lightweight ID generator for invite codes
```

---

## 5. Screen-by-Screen Breakdown & Functionality

### 5.1. Trips Dashboard (`/trips`)
- **Purpose**: The landing area for authenticated users to view their active and past trips.
- **UI Display**: A grid of trip cards. Each card displays the destination, trip dates, an AI-generated cover image or destination photo, and the profile avatars of the members in that trip.
- **Data Reflection**: If a friend joins the trip using an invite code, their avatar instantly appears on the trip card for all existing members.

### 5.2. Create & Join Trip (`/trips/create`, `/join/:inviteCode`)
- **Purpose**: Initialization of the workspace.
- **UI Display**: Forms to input Destination, Start/End Dates, Budget, and optional Starting/Ending geographical points.
- **Data Reflection**: Upon creation, an 8-character `inviteCode` is generated. Entering this code securely maps the user's `uid` to the `tripMembers` collection, instantly granting them access to the Trip Layout.

### 5.3. The Planner Workspace (`/trip/:tripId`)
This is the core engine of the application where the blueprint of the trip is built.
- **UI Display (Left Panel)**: 
  - A chronological, drag-and-drop list of "Stops".
  - Each stop displays its name, category emoji/thumbnail, a short description, and an input field for `estimatedMinutes` (how long the group plans to stay there).
  - "Add Stop" buttons and inline "Must-visits on the way" AI prompts between existing stops.
- **UI Display (Right Panel - Sidebar)**:
  - Tabbed interface: **AI Suggestions**, **On The Way**, and **Nearby**.
  - Displays rich cards with photos and 5-star ratings pulled from Google Places.
- **User Actions**: Users can drag stops to reorder them, change the time spent at a location, or click "+" on sidebar suggestions to add them to the main list.
- **Data Reflection**: 
  - **Reordering**: Dragging a stop updates the `placeOrder` array in Firestore. All users immediately see the list reorder on their screens.
  - **Adding**: Adding a place here instantly drops a pin on the **Map Page** and inserts the location into the timeline on the **Itinerary Page**.

### 5.4. Interactive Full Map (`/trip/:tripId/map`)
- **Purpose**: A spatial visualization of the itinerary.
- **UI Display**: 
  - A fullscreen Google Map instance.
  - Custom markers for every stop in the planner.
  - A highlighted polyline showing the exact driving route between stops.
  - Avatars moving on the map representing the live GPS locations of trip members.
- **Data Reflection**: 
  - If a place is deleted from the Planner, its pin vanishes from this map instantly.
  - As users walk or drive in the real world, their device updates `currentLocation` in Firestore, causing their avatar to smoothly glide across the map for all other users to see.

### 5.5. Day-by-Day Itinerary (`/trip/:tripId/itinerary`)
- **Purpose**: The finalized, execution-ready schedule.
- **UI Display**: 
  - The flat list of stops from the Planner is automatically segmented into collapsible "Day 1", "Day 2", etc.
  - Displays precise calculated driving times (e.g., "🚗 45 min drive") between places.
- **Data Reflection**: This screen is entirely derivative. It does not allow adding places. If the group decides to spend 3 hours at a museum instead of 1 hour (changed in the Planner), this Itinerary screen instantly recalculates. If the 3 hours pushes the schedule past the 8-hour daily limit, the subsequent stops will automatically cascade and spill over into "Day 2".

### 5.6. Group Polls (`/trip/:tripId/polls`)
- **Purpose**: Democratic resolution of group disagreements.
- **UI Display**: Active and closed polls. Each poll shows the question, options (linked to Google Places), and real-time progress bars showing who voted for what.
- **Data Reflection**: When a user clicks a vote button, the progress bar instantly ticks up for everyone viewing the poll. When the admin clicks "Close Poll", the winning option is automatically injected into the **Planner** and **Itinerary** as a confirmed stop.

### 5.7. Expense Splitter (`/trip/:tripId/expenses`)
- **Purpose**: Financial tracking.
- **UI Display**: 
  - A form to add an expense (Amount, Title, "Paid By", and "Split Among").
  - A ledger of all past transactions.
  - A "Balances" summary showing exactly who owes whom (e.g., "Alice owes Bob $45").
- **Data Reflection**: Adding a $100 dinner bill instantly updates the ledger for all users and recalculates the overarching balances matrix in real-time.

### 5.8. Real-Time Chat (`/trip/:tripId/chat`)
- **Purpose**: Contextual communication.
- **UI Display**: Standard messaging interface. Messages can also contain "Place References" (e.g., "Let's go here: [Link to Cafe]").
- **Data Reflection**: Standard instant messaging websocket behavior. Clicking a Place Reference in the chat opens a modal with details and a quick "Add to Planner" button.

---

## 6. Technical Integration Specifications

### 6.1. Google Maps Infrastructure
TripSync heavily relies on the client-side Google Maps JavaScript API to bypass backend CORS constraints and rate limits.
- **PlacesService**: Used by `placesService.js` to execute `findPlaceFromText()`. This translates arbitrary user searches (or AI output) into canonical Google Place IDs, retrieving high-res photos and ratings.
- **DirectionsService**: Used by `routeService.js` to calculate travel logistics. By passing an array of coordinates and setting `optimizeWaypoints: true`, Google servers solve the Traveling Salesperson Problem, returning the optimal order and an encoded polyline representing the road path.
- **Geocoder**: Used as a fallback to convert raw addresses into Lat/Lng coordinates if PlacesService fails.

### 6.2. OpenAI Integration
- Used exclusively for natural language processing and discovery. 
- Prompt engineering is used to ask OpenAI for JSON-formatted lists of places based on context (e.g., "Give me 5 hidden gems between City A and City B").
- **Crucial Workflow**: OpenAI output is never trusted for coordinates. The AI output is always piped through the Google PlacesService to verify the location exists and fetch exact coordinates before being presented to the user.

### 6.3. Firestore Data Schema
- **`trips/{tripId}`**: `{ name, destination, startDate, endDate, budget, placeOrder: [placeId1, placeId2...] }`
- **`tripMembers/{tripId_userId}`**: `{ role: 'admin'|'member', currentLocation: { lat, lng } }`
- **`places/{placeId}`**: `{ tripId, name, lat, lng, estimatedMinutes, imageUrl, category }`
- **`expenses/{expenseId}`**: `{ tripId, amount, paidBy: userId, splitAmong: [userId1, userId2] }`

## 7. Conclusion
TripSync's architecture is built around the philosophy that travel planning is inherently collaborative and dynamic. By pushing all heavy lifting to Google APIs and relying on Firebase for instant state propagation, TripSync ensures that no matter what screen a user is on, they are always looking at the absolute most up-to-date version of the trip.
