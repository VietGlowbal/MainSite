# Requirements Document

## Introduction

The University Explorer feature replaces the current placeholder universities page on the Glowbal platform with a fully functional experience for browsing, viewing, shortlisting, and tracking application progress for universities. The feature uses a "shopping for universities" metaphor — users browse university "products," add them to an application cart, check out to begin applications, and track progress through application stages. The entire experience is wrapped in Glowbal's dark cosmos theme with star field backgrounds, glassmorphism cards, and 3D globe integration via react-globe.gl.

## Glossary

- **Explorer_Page**: The main university browsing page at `/universities` that displays the filter bar and university card grid
- **University_Card**: A glassmorphism card component displaying a university's summary information (emoji banner, name, location, rating, tags, acceptance rate) in the browse grid
- **Detail_View**: The full university profile view showing description, stats, requirements, reviews, and the shortlist action sidebar
- **Filter_Bar**: A horizontal bar of category filter chips (All, Russell Group, STEM, Arts & Humanities, Global Top 50) that controls which universities appear in the grid
- **Shortlist**: The user's collection of selected universities they intend to apply to (equivalent to a shopping cart)
- **Shortlist_Sidebar**: A sticky sidebar or panel on the Detail_View displaying key university stats and add-to-shortlist / save-for-later actions
- **Application_Tracker**: A view showing the user's submitted applications with stage-based progress tracking
- **Progress_Timeline**: A horizontal step-based indicator showing the current stage of a university application through six stages: Submitted, Preparing Documents, Entry Assessment, Interview Stage, Awaiting Decision, and Offer Received
- **University_Data**: A static TypeScript data module containing the 12 UK university records with all fields (id, name, location, emoji, color, rating, reviews, acceptance rate, tags, rank, founded year, description, stats, requirements, and review data)
- **Cosmos_Theme**: Glowbal's dark visual theme using deep navy/space backgrounds, star field overlays, cyan (#00b4d8) primary accent, pink (#ff4d8c) secondary accent, glassmorphism cards with backdrop-blur, and semi-transparent borders
- **Landing_Globe**: The existing react-globe.gl component (`LandingGlobe`) that renders a 3D rotating Earth with configurable themes and atmosphere colors
- **Toast_Notification**: A brief, non-blocking message that appears to confirm user actions such as adding to or removing from the shortlist

## Requirements

### Requirement 1: University Data Module

**User Story:** As a developer, I want a static TypeScript data module containing all university records, so that the browsing, detail, and shortlist views can render rich university information without an external API.

#### Acceptance Criteria

1. THE University_Data module SHALL export an array of at least 12 university objects, each containing: id, name, location, emoji, banner color, rating, review count, acceptance rate, tags, rank, founded year, description, stats (students, staff/campuses), entry requirements list, and alumni review data
2. THE University_Data module SHALL export a TypeScript interface defining the shape of a university record
3. THE University_Data module SHALL export a constant array of application stage definitions, each containing a label, icon, and description for the six Progress_Timeline stages (Submitted, Preparing Documents, Entry Assessment, Interview Stage, Awaiting Decision, Offer Received)
4. THE University_Data module SHALL export a TypeScript type for the application stage definition

### Requirement 2: University Browse Grid

**User Story:** As a student, I want to browse universities in a visually appealing card grid with the Glowbal cosmos theme, so that I can quickly scan and compare options.

#### Acceptance Criteria

1. WHEN the user navigates to the Explorer_Page, THE Explorer_Page SHALL render a hero section containing the Landing_Globe component with the cosmos theme displayed behind a heading and subtitle text
2. WHEN the Explorer_Page loads, THE Explorer_Page SHALL display all universities from University_Data as University_Card components in a responsive grid (auto-fill columns, minimum 280px per column)
3. THE University_Card SHALL display the university emoji banner with the university's banner color as background, the university name, location, star rating, review count, tag chips, and acceptance rate
4. WHEN a university is in the user's Shortlist, THE University_Card SHALL display a visible "Shortlisted" badge indicator on the card
5. THE Explorer_Page SHALL apply the Cosmos_Theme styling: dark navy gradient background, star field overlay, glassmorphism card borders (border-white/[.07], bg-white/[.04], backdrop-blur), cyan and pink accent colors, and the Outfit font family
6. WHEN the user hovers over a University_Card, THE University_Card SHALL apply a subtle upward translation and enhanced glow shadow to indicate interactivity
7. THE University_Card SHALL display a rank badge (e.g., "#1 UK") in the top-right corner of the emoji banner area

### Requirement 3: Category Filtering

**User Story:** As a student, I want to filter universities by category, so that I can narrow results to my area of interest.

#### Acceptance Criteria

1. THE Filter_Bar SHALL display filter chips for the categories: All, Russell Group, STEM, Arts & Humanities, and Global Top 50
2. WHEN the user selects a filter chip, THE Explorer_Page SHALL display only universities whose tags include the selected category
3. WHEN the "All" filter chip is selected, THE Explorer_Page SHALL display all universities from University_Data
4. THE Filter_Bar SHALL visually highlight the currently active filter chip using the cyan accent color
5. WHEN the user selects a filter chip, THE Explorer_Page SHALL update a count label showing the number of universities currently displayed

### Requirement 4: University Detail View

**User Story:** As a student, I want to view a full university profile with description, stats, requirements, and reviews, so that I can make an informed decision about applying.

#### Acceptance Criteria

1. WHEN the user clicks a University_Card, THE Explorer_Page SHALL navigate to or display the Detail_View for that university
2. THE Detail_View SHALL display the university emoji banner (large format), name, location, star rating with review count, and a full-text description
3. THE Detail_View SHALL display a stats grid showing the university's key metrics (student count, staff/campus info, acceptance rate) in individual stat boxes
4. THE Detail_View SHALL display the university's entry requirements as a list with visual icons
5. THE Detail_View SHALL display alumni review cards, each showing the reviewer name, star rating, and review text
6. THE Detail_View SHALL include a "Back to Browse" navigation element that returns the user to the Explorer_Page grid
7. THE Detail_View SHALL apply Cosmos_Theme styling consistent with the Explorer_Page

### Requirement 5: Shortlist Sidebar and Actions

**User Story:** As a student, I want to add universities to a shortlist from the detail view, so that I can collect my preferred choices before applying.

#### Acceptance Criteria

1. THE Detail_View SHALL display a Shortlist_Sidebar containing the university name, key stats (acceptance rate, rank, founded year), and action buttons
2. WHEN the user clicks the "Add to Shortlist" button and the university is not already in the Shortlist, THE Shortlist_Sidebar SHALL add the university to the Shortlist and display a Toast_Notification confirming the addition
3. WHEN the university is already in the Shortlist, THE Shortlist_Sidebar SHALL display the add button in a "Shortlisted" state with distinct styling (green/success color) and the button text SHALL read "Shortlisted"
4. THE Shortlist_Sidebar SHALL include a "Save for Later" secondary action button
5. THE Shortlist_Sidebar SHALL be sticky-positioned so it remains visible as the user scrolls the Detail_View content
6. THE Shortlist SHALL persist in React client state across page navigations within the same session

### Requirement 6: Shortlist (Cart) Page

**User Story:** As a student, I want to review all my shortlisted universities in one place, so that I can manage my selections before submitting applications.

#### Acceptance Criteria

1. WHEN the user navigates to the Shortlist view, THE Shortlist view SHALL display all shortlisted universities as list items showing the emoji, name, location, tags, and a remove button
2. WHEN the user clicks the remove button on a shortlisted university, THE Shortlist view SHALL remove that university from the Shortlist and display a Toast_Notification confirming the removal
3. THE Shortlist view SHALL display an order summary panel showing the count of shortlisted universities and a "Proceed to Applications" action button
4. WHEN the Shortlist is empty, THE Shortlist view SHALL display an empty state with an illustration, a message ("Your shortlist is empty"), and a "Browse Universities" button that navigates back to the Explorer_Page
5. WHEN the user clicks "Proceed to Applications," THE Shortlist view SHALL move all shortlisted universities into the Application_Tracker as new applications at the first stage (Submitted) and clear the Shortlist
6. THE Shortlist view SHALL apply Cosmos_Theme styling consistent with the Explorer_Page

### Requirement 7: Application Progress Tracker

**User Story:** As a student, I want to track the progress of each university application through defined stages, so that I can see where each application stands.

#### Acceptance Criteria

1. WHEN the user navigates to the Application_Tracker view, THE Application_Tracker SHALL display each submitted application as a card showing the university emoji, name, location, and a Progress_Timeline
2. THE Progress_Timeline SHALL render six horizontal steps (Submitted, Preparing Documents, Entry Assessment, Interview Stage, Awaiting Decision, Offer Received) with visual indicators for completed, active, and pending stages
3. WHEN a stage is completed, THE Progress_Timeline SHALL display that step's dot in a success color (green) with a checkmark icon
4. WHEN a stage is the current active stage, THE Progress_Timeline SHALL display that step's dot in the cyan accent color with a glow shadow
5. THE Application_Tracker SHALL display a status message below the Progress_Timeline describing the current stage's meaning and next actions
6. WHEN the user clicks an "Advance Stage" button on an application card, THE Application_Tracker SHALL move that application to the next stage and update the Progress_Timeline accordingly
7. WHEN an application reaches the final stage (Offer Received), THE Application_Tracker SHALL display a celebratory banner (e.g., "Congratulations! Offer Received 🎉") and disable the advance button
8. WHEN no applications exist, THE Application_Tracker SHALL display an empty state with a message and a "Browse Universities" navigation button
9. THE Application_Tracker SHALL apply Cosmos_Theme styling consistent with the Explorer_Page

### Requirement 8: View Navigation

**User Story:** As a student, I want to switch between the browse grid, shortlist, and application tracker views, so that I can access each part of the university exploration experience.

#### Acceptance Criteria

1. THE Explorer_Page SHALL provide a tab bar or navigation element with three options: Browse, Shortlist, and My Applications
2. WHEN the user selects a navigation tab, THE Explorer_Page SHALL display the corresponding view (browse grid, Shortlist view, or Application_Tracker) and hide the other views
3. THE Shortlist navigation tab SHALL display a badge showing the current count of shortlisted universities
4. THE navigation element SHALL visually highlight the currently active tab using Cosmos_Theme accent colors
5. WHEN the Explorer_Page first loads, THE Explorer_Page SHALL display the Browse view as the default active tab

### Requirement 9: Globe Integration in Hero

**User Story:** As a student, I want to see the 3D globe integrated into the university explorer hero section, so that the experience feels connected to Glowbal's global identity and cosmos branding.

#### Acceptance Criteria

1. THE Explorer_Page hero section SHALL render the Landing_Globe component with the "cosmos" theme, auto-rotation enabled, and a cyan atmosphere glow
2. THE Landing_Globe SHALL be positioned behind the hero text content using absolute positioning and reduced opacity so text remains readable
3. THE hero section SHALL include a gradient overlay to ensure sufficient contrast between the globe and the heading text
4. THE hero heading SHALL use the Glowbal gradient text style (linear-gradient from pink #ff4d8c to cyan #00b4d8) on at least one keyword

### Requirement 10: Toast Notifications

**User Story:** As a student, I want brief confirmation messages when I add or remove universities from my shortlist, so that I have clear feedback on my actions.

#### Acceptance Criteria

1. WHEN a Toast_Notification is triggered, THE Toast_Notification SHALL appear at the bottom-right of the viewport with a slide-up animation
2. THE Toast_Notification SHALL automatically dismiss after 3 seconds
3. THE Toast_Notification SHALL apply Cosmos_Theme styling: dark background, light text, and a colored left border accent
4. IF multiple Toast_Notifications are triggered in rapid succession, THEN THE Toast_Notification system SHALL display only the most recent message, replacing any currently visible toast

### Requirement 11: Responsive Layout

**User Story:** As a student using a mobile device, I want the university explorer to adapt to smaller screens, so that I can browse and manage applications on any device.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE university grid SHALL display a single-column layout
2. WHEN the viewport width is below 768px, THE Detail_View SHALL stack the main content and Shortlist_Sidebar vertically instead of side-by-side
3. WHEN the viewport width is below 768px, THE Progress_Timeline step labels SHALL use a reduced font size to fit within the available width
4. THE Explorer_Page SHALL account for the existing mobile bottom navigation bar by adding appropriate bottom padding on viewports below 640px

### Requirement 12: Animations and Transitions

**User Story:** As a student, I want smooth animations when browsing and interacting with the university explorer, so that the experience feels polished and engaging.

#### Acceptance Criteria

1. WHEN the Explorer_Page loads, THE University_Card components SHALL animate in with a staggered fade-up entrance using GSAP
2. WHEN the user switches between views (Browse, Shortlist, Application Tracker), THE incoming view SHALL animate in with a fade and slight vertical translation
3. WHEN a university is added to or removed from the Shortlist, THE corresponding University_Card "Shortlisted" badge SHALL animate its appearance or disappearance with a scale transition
4. THE Landing_Globe in the hero section SHALL animate in with a scale-up and fade-in on initial page load
