const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function buildMasterFRD() {
  console.log('🚀 Generating Exhaustive 100% Comprehensive Ourlime-Web Master FRD (Including Latest Git Pull Updates)...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ourlime Development Team';
  workbook.lastModifiedBy = 'Antigravity AI Agent';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Color Tokens
  const mainHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Dark Emerald #064E3B
  const colHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald Green #10B981
  const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Slate 50
  const whiteFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const columnsDef = [
    { header: 'Desktop Page Section', key: 'section', width: 26 },
    { header: 'Component / Card / Container', key: 'container', width: 28 },
    { header: 'Button / Input / Control Name', key: 'control', width: 30 },
    { header: 'User Action / Trigger', key: 'action', width: 22 },
    { header: 'Opened Modal / Popup / Drawer', key: 'modal', width: 28 },
    { header: 'Every Input, Option & Control Inside Modal', key: 'modalInputs', width: 48 },
    { header: 'Expected Outcome & Business Logic (Plain English)', key: 'expectedResult', width: 55 },
    { header: 'User Role / Permission', key: 'permission', width: 24 },
    { header: 'Web Status (Pass / Fail)', key: 'webStatus', width: 20 },
    { header: 'Mobile Status (Pass / Fail)', key: 'mobileStatus', width: 20 },
    { header: 'QA Notes / Discrepancies', key: 'notes', width: 28 }
  ];

  function createComprehensiveSheet(sheetName, titleText, sectionsData) {
    const sheet = workbook.addWorksheet(sheetName);

    // Title Row
    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = titleText;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = mainHeaderFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 36;

    // Column Headers Row
    sheet.getRow(2).values = columnsDef.map(c => c.header);
    sheet.getRow(2).height = 28;

    sheet.columns = columnsDef.map(c => ({ key: c.key, width: c.width }));

    sheet.getRow(2).eachCell((cell) => {
      cell.fill = colHeaderFill;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });

    sheet.views = [{ state: 'frozen', ySplit: 2 }];

    let currentRowIdx = 3;

    sectionsData.forEach((sectionGroup) => {
      const sectionName = sectionGroup.sectionName;
      const items = sectionGroup.items;

      const startRow = currentRowIdx;
      const endRow = startRow + items.length - 1;

      items.forEach((item, itemIdx) => {
        const row = sheet.addRow({
          section: sectionName,
          container: item.container,
          control: item.control,
          action: item.action,
          modal: item.modal,
          modalInputs: item.modalInputs,
          expectedResult: item.expectedResult,
          permission: item.permission || 'Public / Authenticated',
          webStatus: item.webStatus || '[  ] Pass',
          mobileStatus: item.mobileStatus || '[  ] Pass',
          notes: item.notes || ''
        });

        row.height = 44;
        const isZebra = itemIdx % 2 === 1;

        row.eachCell((cell, colNum) => {
          cell.fill = isZebra ? zebraFill : whiteFill;
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

          if (colNum === 1) { // Section column
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF064E3B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          } else if (colNum === 2 || colNum === 3) { // Container & Control columns
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          } else if (colNum === 9 || colNum === 10) { // Status checkboxes
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }
        });
      });

      // Merge Section cells vertically so Section Name appears ONLY ONCE
      if (items.length > 1) {
        sheet.mergeCells(`A${startRow}:A${endRow}`);
      }

      currentRowIdx = endRow + 1;
    });
  }

  // ============================================================================
  // SHEET 1: FEEDS (HOME) - DESKTOP PERSPECTIVE
  // ============================================================================
  createComprehensiveSheet('Feeds', 'FEEDS (HOME PAGE) — DESKTOP 3-COLUMN LAYOUT, ALL SECTIONS, FEATURES & MODALS', [
    {
      sectionName: 'Top Navigation Header\n(Fixed Global Bar)',
      items: [
        {
          container: 'Brand Logo Section',
          control: 'Ourlime Logo (Top Left)',
          action: 'Click Logo',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Reloads or navigates directly back to the Home Feed page.',
          permission: 'Public'
        },
        {
          container: 'Global Search Bar',
          control: 'Search Input ("Search users...")',
          action: 'Type text in search box',
          modal: 'Live Search Results Dropdown',
          modalInputs: '• User profile rows with avatar, full name, @username\n• "View all results" link at bottom',
          expectedResult: 'Searches user profiles in real time and lets you click any user to navigate to `/profile/[username]`.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Header Action Icons',
          control: 'Notification Bell (with Unread Badge)',
          action: 'Click Bell icon',
          modal: 'Notifications Dropdown Window',
          modalInputs: '• Unread notifications list (Likes, Comments, Reposts, Mentions)\n• Friend requests with "Accept" (green) & "Decline" (red) buttons\n• "Mark all as read" checkmark button\n• "Settings" gear shortcut icon',
          expectedResult: 'Opens notifications drawer, marks alerts as seen, and resets badge counter to 0.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Action Icons',
          control: 'User Profile Avatar & Ring',
          action: 'Click Avatar icon',
          modal: 'User Menu Dropdown',
          modalInputs: '• "View Profile" link\n• "Settings" link\n• "Admin Panel" link (strictly visible for Admin accounts)\n• "Log Out" button with confirmation',
          expectedResult: 'Opens quick account dropdown shortcuts.',
          permission: 'Authenticated User'
        },
        {
          container: 'Sub-Navbar Navigation Bar',
          control: 'Category Tabs (Home, Limes, E-Learning, Blogs, Events, Jobs, Communities, Market, E-Projects)',
          action: 'Click any category tab',
          modal: 'No Popup (Coming Soon overlay if protected)',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to selected domain page (e.g. Communities opens `/communities`, Limes opens `/limes`, E-Projects opens `/projectManagement`).',
          permission: 'Public / Authenticated'
        }
      ]
    },
    {
      sectionName: 'Left Section\n(Desktop Sidebar Rail)',
      items: [
        {
          container: 'Profile Welcome Card',
          control: 'User Avatar & Greeting ("Welcome back [Name]!")',
          action: 'View / Click card',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays personal greeting, avatar in decorative ring, and prompt "Share your day with us".',
          permission: 'Authenticated User'
        },
        {
          container: 'Profile Welcome Card',
          control: '"View Profile" Green Button',
          action: 'Click "View Profile"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Takes user directly to their own `/profile` page.',
          permission: 'Authenticated User'
        },
        {
          container: 'Games Card',
          control: 'Games Header & "See All" Link',
          action: 'Click "See All"',
          modal: 'No Popup (or Coming Soon overlay)',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to the full games catalog page.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Games Card',
          control: '"Trini Wordle" Game Item Button',
          action: 'Click "Trini Wordle"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Launches the Trini Wordle interactive word-guessing game.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Feed Scope Selector Card',
          control: '"Home" Scope Pill (Active Green)',
          action: 'Click "Home"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters feed to show general mixed home feed (public + friends posts).',
          permission: 'Authenticated User'
        },
        {
          container: 'Feed Scope Selector Card',
          control: '"Friends" Scope Tab',
          action: 'Click "Friends"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters feed to show posts published strictly by accepted friends.',
          permission: 'Authenticated User'
        },
        {
          container: 'Feed Scope Selector Card',
          control: '"Communities" Scope Tab',
          action: 'Click "Communities"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters feed to show posts published inside joined communities.',
          permission: 'Authenticated User'
        },
        {
          container: 'Activity This Week Card',
          control: 'Posts Metric Item (Green Document Icon + Count)',
          action: 'View metric',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays total posts created by user this week (e.g. "23").',
          permission: 'Authenticated User'
        },
        {
          container: 'Activity This Week Card',
          control: 'Friends Metric Item (Purple User Icon + Count)',
          action: 'View metric',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays total new friends added by user this week (e.g. "8").',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Middle Section\n(Main Content Feed)',
      items: [
        {
          container: '# FEED FILTERS Bar',
          control: 'Filter Pills (All, Photos, Videos, Sound, Polls, Events)',
          action: 'Click any filter pill',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Instantly filters feed items to show only matching post types without page reload.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Create Post Card',
          control: '"What\'s on your mind, [Name]?" Input Field',
          action: 'Click input field',
          modal: 'Full Create Post Modal Window',
          modalInputs: '• Caption textarea with hashtag (#) and mention (@) support\n• Media uploader (up to 5 photos/videos, drag & drop)\n• Add Location search input box\n• Add Poll form (Question, Option 1, Option 2, + Add Option up to 5, Duration selector)\n• Add Event form (Title, Date & Time pickers, Location, Custom Recurrence: Daily/Weekly/Monthly/Yearly, Weekday checkboxes, End condition: Never/On Date/After Count)\n• Feeling / Activity emoji picker\n• Privacy selector (Public, Friends, Only Me)\n• "Cancel" button & "Post" submit button',
          expectedResult: 'Opens composer. Submitting publishes post immediately and prepends it to the top of the feed.',
          permission: 'Authenticated User'
        },
        {
          container: 'Create Post Card',
          control: 'Photo Quick Button (Green Camera Icon)',
          action: 'Click "Photo"',
          modal: 'Create Post Modal',
          modalInputs: 'Opens Create Post modal with media file picker pre-activated.',
          expectedResult: 'Allows choosing image/video files from computer.',
          permission: 'Authenticated User'
        },
        {
          container: 'Create Post Card',
          control: 'Event Quick Button (Blue Calendar Icon)',
          action: 'Click "Event"',
          modal: 'Create Post Modal',
          modalInputs: 'Opens Create Post modal with Event form fields pre-opened.',
          expectedResult: 'Allows configuring event date, time, location, and frequency.',
          permission: 'Authenticated User'
        },
        {
          container: 'Create Post Card',
          control: 'Poll Quick Button (Orange Chart Icon)',
          action: 'Click "Poll"',
          modal: 'Create Post Modal',
          modalInputs: 'Opens Create Post modal with Poll voting options pre-opened.',
          expectedResult: 'Allows configuring poll question, options, and duration.',
          permission: 'Authenticated User'
        },
        {
          container: 'Create Post Card',
          control: 'Location Quick Button (Purple Pin Icon)',
          action: 'Click "Location"',
          modal: 'Create Post Modal',
          modalInputs: 'Opens Create Post modal with Location search input pre-focused.',
          expectedResult: 'Allows searching and tagging a city or place to the post.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Author Header)',
          control: 'Author Avatar & Name',
          action: 'Click Avatar or Name',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to `/profile/[username]` user profile page.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Post Card (Author Header)',
          control: 'Verified Blue Checkmark Badge',
          action: 'View badge',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Indicates officially verified account status.',
          permission: 'Public'
        },
        {
          container: 'Post Card (Author Header)',
          control: 'Post Options Three-Dots Menu (...)',
          action: 'Click three dots',
          modal: 'Post Options Dropdown Menu',
          modalInputs: '• "Copy Link"\n• "Report Post" (opens Report Modal)\n• "Delete Post" (for author, prompts confirmation)\n• "Mute User"',
          expectedResult: 'Displays post management options.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Post Card (Media Frame)',
          control: 'Image / Video Frame (0px Sharp Square Borders)',
          action: 'Click photo or video',
          modal: 'Full-Screen Lightbox Media Viewer',
          modalInputs: '• Full resolution image/video view\n• Left/Right navigation arrows for multi-image posts\n• Zoom in/out controls\n• Download button\n• Close (X) button',
          expectedResult: 'Opens full-screen high-res lightbox. Post images span full width with 0px sharp square borders.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Post Card (Event Module)',
          control: 'Event Details & "Attend" / "Attending" RSVP Button',
          action: 'Click "Attend"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Toggles RSVP status to "Attending" with a green checkmark and increases attendees count by 1.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Poll Module)',
          control: 'Poll Voting Radio Options & "Vote" Button',
          action: 'Select option & click Vote',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Records vote immediately, displays percentage bar results, and shows total votes cast.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Action Bar)',
          control: 'Heart Like Icon + Like Counter',
          action: 'Click Heart icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Heart turns solid red immediately and like count increments by 1. Clicking again unlikes.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Action Bar)',
          control: 'Comment Icon + Comment Counter',
          action: 'Click Comment icon',
          modal: 'Comments Modal Window',
          modalInputs: '• List of existing comments with user avatars, names, timestamps, like buttons\n• "Reply" button under each comment for nested replies\n• Comment input textarea at bottom\n• Emoji picker button\n• "Post Comment" submit button\n• Three-dots menu on comments (Report, Delete if author)',
          expectedResult: 'Opens comments thread where users can view, write, like, and reply to comments.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Action Bar)',
          control: 'Repost Icon + Repost Counter',
          action: 'Click Repost icon',
          modal: 'Repost Confirmation Modal',
          modalInputs: '• Optional quote thoughts textarea\n• Original post embed preview\n• "Repost" button & "Cancel" button',
          expectedResult: 'Shares post to user\'s profile timeline and increments repost count by 1.',
          permission: 'Authenticated User'
        },
        {
          container: 'Post Card (Action Bar)',
          control: 'Share Icon + Share Counter',
          action: 'Click Share icon',
          modal: 'Share Modal Window',
          modalInputs: '• "Copy Link" button with copy confirmation toast\n• Direct share to WhatsApp button\n• Direct share to X / Twitter button\n• Direct share to Facebook button\n• Embed Code generator',
          expectedResult: 'Copies canonical post URL (`https://ourlime.com/post/[id]`) or launches social share apps.',
          permission: 'Public / Authenticated'
        }
      ]
    },
    {
      sectionName: 'Right Section\n(Desktop Sidebar Widgets)',
      items: [
        {
          container: 'Promoted Sponsored Card',
          control: 'Carousel Navigation Arrows (< >)',
          action: 'Click left or right arrow',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Transitions between sponsored advertisement items (Jobs, Communities, Services).',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Promoted Sponsored Card',
          control: 'Promoted Job Listing ("Apply" Button)',
          action: 'Click "Apply"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to job application page.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Promoted Sponsored Card',
          control: 'Promoted Community Listing ("Join" Button)',
          action: 'Click "Join"',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Joins the sponsored community or navigates to its page.',
          permission: 'Authenticated User'
        },
        {
          container: 'Suggested Users Card',
          control: 'User Recommendation Rows',
          action: 'View row',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays suggested user\'s Avatar, Full Name, @username, and mutual friends count.',
          permission: 'Authenticated User'
        },
        {
          container: 'Suggested Users Card',
          control: '"Add Friend" UserPlus Button',
          action: 'Click UserPlus icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Sends friend request immediately, turns button into a green checkmark, and disables repeat clicks.',
          permission: 'Authenticated User'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 2: E-PROJECTS (PROJECT MANAGEMENT) - NEWEST FULL WORKSPACE
  // ============================================================================
  createComprehensiveSheet('E-Projects', 'E-PROJECTS (PROJECT MANAGEMENT) — DASHBOARD, KANBAN BOARD, TASKS & MODALS AUDIT', [
    {
      sectionName: 'Projects Landing\n(`/projectManagement`)',
      items: [
        {
          container: 'Project Stats Header',
          control: 'KPI Metric Counters (Total Projects, Total Tasks, In Progress, Completed)',
          action: 'View stats bar',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays aggregate project statistics for the current user.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Invitations Section',
          control: 'Pending Project Invites ("Accept" & "Decline" Buttons)',
          action: 'Click Accept or Decline',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Accepts project membership invitation or declines invitation.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: 'Search Box ("Search projects...")',
          action: 'Type query text',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters projects by name or description in real time.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: 'Status Filter Dropdown (All, Planning, Active, Paused, Completed, Archived)',
          action: 'Select status',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters project cards by lifecycle stage.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: 'Role Filter Dropdown (All, Owner, Admin, Member, Viewer)',
          action: 'Select role',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters projects by user\'s assigned membership role.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: 'Sort By Dropdown (Recently Active, Name, Progress %, Created Date)',
          action: 'Select sort option',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Re-orders project list according to criteria.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: 'View Mode Toggle (Grid View / List View)',
          action: 'Click Grid or List icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Switches between card grid layout and condensed table list layout.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Toolbar',
          control: '"Create Project" Button',
          action: 'Click Create Project',
          modal: 'Create Project Modal Window',
          modalInputs: '• Project Name input\n• Description textarea\n• Project Icon & Theme Color picker\n• Start Date & Target End Date pickers\n• Status dropdown (Planning, Active, Paused, Completed)\n• Add Team Members search input (with initial role selector: Admin, Member, Viewer)\n• "Create Project" submit button & "Cancel" button',
          expectedResult: 'Creates new project and opens its Kanban workspace.',
          permission: 'Authenticated User'
        },
        {
          container: 'Project Card / List Item',
          control: 'Project Card Click',
          action: 'Click project card',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to Project Detail Kanban workspace (`/projectManagement/[projectId]`).',
          permission: 'Project Member'
        },
        {
          container: 'Project Card / List Item',
          control: 'Project Options Menu (...)',
          action: 'Click three dots',
          modal: 'Project Context Dropdown',
          modalInputs: '• "Edit Project" (opens Edit Project Modal)\n• "Archive Project" / "Restore"\n• "Delete Project" (prompts double confirmation)',
          expectedResult: 'Allows owner/admin to edit, archive, or delete project.',
          permission: 'Project Owner / Admin'
        }
      ]
    },
    {
      sectionName: 'Project Detail\n(`/projectManagement/[id]`)',
      items: [
        {
          container: 'Project Header',
          control: 'Project Title, Status Badge & Progress Bar',
          action: 'View / Edit title',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays project progress percentage calculated from completed tasks.',
          permission: 'Project Member'
        },
        {
          container: 'Project Header',
          control: 'Team Members Avatar Stack & "+ Invite" Button',
          action: 'Click "+ Invite"',
          modal: 'Invite User Modal Window',
          modalInputs: '• Search platform users input box\n• User selection list with avatars\n• Role assignment dropdown (Admin, Member, Viewer)\n• Personal invite note textarea\n• "Send Invitation" submit button & "Cancel" button',
          expectedResult: 'Sends project invitation to user.',
          permission: 'Project Owner / Admin'
        },
        {
          container: 'Project Header',
          control: '"Project Settings" Gear Icon Button',
          action: 'Click Gear icon',
          modal: 'Project Settings Modal Window',
          modalInputs: '• General Tab: Edit Project Name, Description, Color, Icon, Dates\n• Members Tab: Change member roles (Admin/Member/Viewer), Remove member\n• Danger Zone Tab: Archive Project button, Delete Project button (with type project name confirm)',
          expectedResult: 'Opens full project configuration modal.',
          permission: 'Project Owner / Admin'
        },
        {
          container: 'Project Header',
          control: 'View Mode Tabs (Board / Kanban, List, Timeline, Activity)',
          action: 'Click view tab',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Switches between Kanban columns, table list, or activity audit feed.',
          permission: 'Project Member'
        },
        {
          container: 'Project Header',
          control: '"+ Add Task" Quick Button',
          action: 'Click "+ Add Task"',
          modal: 'Task Creation Modal Window',
          modalInputs: '• Task Title input\n• Description rich textarea\n• Column Status dropdown (To Do, In Progress, In Review, Done)\n• Priority dropdown (Low, Medium, High, Urgent)\n• Assignee dropdown (select project team member)\n• Start Date & Due Date pickers\n• Estimated Hours input\n• Tags / Labels multi-selector\n• Checklists / Subtasks (Add item, checkbox, delete)\n• Attachments file uploader\n• "Create Task" submit button & "Cancel" button',
          expectedResult: 'Adds task card to the selected Kanban column.',
          permission: 'Project Member'
        }
      ]
    },
    {
      sectionName: 'Kanban Task Board\n& Task Details',
      items: [
        {
          container: 'Kanban Columns',
          control: 'Columns (To Do, In Progress, In Review, Done)',
          action: 'Drag & Drop Task Card',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Moves task card to new column and updates task status in real time.',
          permission: 'Project Member'
        },
        {
          container: 'Task Card Item',
          control: 'Task Card Click',
          action: 'Click task card',
          modal: 'Task Detail Modal Window',
          modalInputs: '• Editable Task Title & Description\n• Status changer & Priority badge updater\n• Assignee selector & Due Date picker\n• Subtasks Checklist (check/uncheck subtasks, auto-calculates % completion)\n• Task Comments Thread (add comments, @mention teammates, timestamps)\n• Activity History Log (who moved/edited the task)\n• Attachments download / remove\n• "Delete Task" button & "Save / Close" button',
          expectedResult: 'Opens comprehensive task detail window for tracking and commenting.',
          permission: 'Project Member'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 3: COMMUNITIES
  // ============================================================================
  createComprehensiveSheet('Communities', 'COMMUNITIES DOMAIN — DIRECTORY, DETAIL WORKSPACE & ADMIN DASHBOARD AUDIT', [
    {
      sectionName: 'Left Directory\n& Search Section',
      items: [
        {
          container: 'Browse Scope Bar',
          control: 'Scope Tabs (All, Joined, Joined by Friends, New, Created)',
          action: 'Click scope tab',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters directory cards to show all public groups, groups you joined, or groups you created.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Search & Filters Bar',
          control: 'Search Input ("Search communities...")',
          action: 'Type community name',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters community cards dynamically as you type.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Search & Filters Bar',
          control: 'Filters & Sort Button',
          action: 'Click Filters button',
          modal: 'Community Filters Sheet Modal',
          modalInputs: '• Privacy options: All, Public, Private\n• Category dropdown: Technology, Music, Gaming, Sports, Education, Art, Business, Lifestyle\n• Sort by: Most Popular, Newest, Most Active, Trending\n• "Apply Filters" button & "Reset" button',
          expectedResult: 'Applies category, privacy, and sorting criteria to community listing.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Directory Header',
          control: '"Create Community" Button',
          action: 'Click Create Community',
          modal: 'Create Community Modal Window',
          modalInputs: '• Community Name input\n• Custom URL Slug input (with "Check Availability" button)\n• Description textarea\n• Category dropdown selector\n• Privacy toggle: Public (Anyone can join) vs Private (Request to join)\n• Posting Policy: Anyone can post vs Only moderators can post\n• Cover Banner file uploader (with 3:1 crop tool)\n• Terms & Guidelines agreement checkbox\n• "Create Community" submit button & "Cancel" button',
          expectedResult: 'Creates new community in Firestore, uploads banner to Storage, and opens the new community page immediately.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Community Detail\nHeader Section',
      items: [
        {
          container: 'Cover Banner & Meta',
          control: 'Cover Image (with Camera Icon for Owner/Mod)',
          action: 'Click Camera icon',
          modal: 'Upload Community Banner Modal',
          modalInputs: '• File picker\n• 3:1 Crop adjuster\n• Save Banner button',
          expectedResult: 'Updates community cover image.',
          permission: 'Community Owner / Moderator'
        },
        {
          container: 'Cover Banner & Meta',
          control: 'Community Title, Description & Verified Badge',
          action: 'View header',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays group title, verified checkmark, creator avatar link, creation date, member total, and post total.',
          permission: 'Public'
        },
        {
          container: 'Header Action Bar',
          control: 'Join / Request Access / Leave / Cancel Request Button',
          action: 'Click Join / Leave',
          modal: 'Confirm Leave Box (on Leave)',
          modalInputs: '• Leave confirmation prompt\n• "Confirm Leave" button & "Cancel" button',
          expectedResult: 'Public group: makes user a member immediately. Private group: submits access request to moderators. Leave: removes user from member list.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Action Bar',
          control: 'Community Like Heart Icon + Counter',
          action: 'Click Heart icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Toggles community like state and increments community likes counter.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Action Bar',
          control: 'Share Community Button',
          action: 'Click Share button',
          modal: 'Share Community Modal',
          modalInputs: '• Copy Link button\n• Social share shortcuts',
          expectedResult: 'Copies community link (`https://ourlime.com/communities/[slug]`) to clipboard.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Header Action Bar',
          control: 'Three-Dots Options Menu (...)',
          action: 'Click three dots',
          modal: 'Community Options Menu',
          modalInputs: '• "Report Community" (opens Report Modal with categories and details)\n• "Edit Community" (for owner)',
          expectedResult: 'Allows reporting or editing the community.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Community Detail\nWorkspace Tabs',
      items: [
        {
          container: 'Workspace Navigation',
          control: 'Posts Tab',
          action: 'Click Posts',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays all posts published inside this community.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Workspace Navigation',
          control: 'Events Tab',
          action: 'Click Events',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays upcoming and past community events with RSVP buttons and edit options for creator.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Events Tab',
          control: '"Host Event" Button',
          action: 'Click Host Event',
          modal: 'Create Community Event Modal',
          modalInputs: '• Event Title input\n• Category dropdown\n• Cover Image uploader with crop\n• Start Date & Time picker\n• End Date & Time picker\n• Location / Address input\n• Recurrence: None, Daily, Weekly (with Mon-Sun checkboxes), Monthly, Yearly, Custom\n• Recurrence End: Never, On Date, After X Occurrences\n• Description textarea\n• "Save Event" button & "Cancel" button',
          expectedResult: 'Publishes new event to community events calendar.',
          permission: 'Community Member / Owner'
        },
        {
          container: 'Workspace Navigation',
          control: 'Polls Tab',
          action: 'Click Polls',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays interactive voting polls published inside the community.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Polls Tab',
          control: '"Create Poll" Button',
          action: 'Click Create Poll',
          modal: 'Create Community Poll Modal',
          modalInputs: '• Poll Question input\n• Option 1 & Option 2 inputs (with "+ Add Option" up to 5)\n• Duration dropdown (1 day, 3 days, 7 days)\n• "Allow Multiple Choices" toggle\n• "Post Poll" submit button & "Cancel" button',
          expectedResult: 'Publishes poll for community members to vote on.',
          permission: 'Community Member / Owner'
        },
        {
          container: 'Workspace Navigation',
          control: 'Members Tab & Search',
          action: 'Click Members',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Lists members with search input, roles (Owner, Moderator, Member), and management actions for owner.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Workspace Navigation',
          control: 'About Tab',
          action: 'Click About',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Shows full community description, category, privacy rules, posting policy, rules list, and creator info.',
          permission: 'Public'
        },
        {
          container: 'Workspace Navigation',
          control: '"Admin Dashboard" Button (Owners & Mods Only)',
          action: 'Click Admin Dashboard',
          modal: 'Full-Screen Admin Dashboard Modal',
          modalInputs: '• Overview Tab: Member growth charts, active post stats\n• Members Tab: Role assignment dropdowns (Promote to Mod, Demote, Remove, Ban)\n• Requests Tab: Pending join requests with "Approve" & "Decline" buttons + "Approve All"\n• Activity Tab: Audit log of all community actions\n• Reports Tab: Reported posts/comments with "Dismiss" & "Remove Content" buttons\n• Settings Tab: Edit name, slug, description, privacy, posting policy, or Delete Community',
          expectedResult: 'Opens complete management dashboard window to manage members, requests, and moderation.',
          permission: 'Community Owner / Moderator'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 4: LIMES (SHORT VIDEOS)
  // ============================================================================
  createComprehensiveSheet('Limes', 'LIMES (SHORT VIDEOS) — VERTICAL FEED, CREATOR MODAL & QA AUDIT', [
    {
      sectionName: 'Video Player Viewport\n(Main Screen)',
      items: [
        {
          container: 'Full Screen Video Player',
          control: 'Vertical Feed Scroller',
          action: 'Scroll Up / Down',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to next/previous short video clip. Auto-plays active video and pauses off-screen video.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Video Player Controls',
          control: 'Mute / Sound Toggle Icon',
          action: 'Click Sound icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Mutes or unmutes video audio.',
          permission: 'Public'
        },
        {
          container: 'Video Player Controls',
          control: 'Double Tap Video Screen',
          action: 'Double click screen',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays heart burst animation and likes the video.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Video Info Overlay\n(Bottom Left)',
      items: [
        {
          container: 'Creator Info Box',
          control: 'Creator Avatar, Name & @username',
          action: 'Click Creator Avatar/Name',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Opens creator\'s profile page (`/profile/[username]`).',
          permission: 'Public'
        },
        {
          container: 'Video Caption',
          control: 'Caption Text, Hashtags (#) & Mentions (@)',
          action: 'Click hashtag or mention',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Clicking hashtag searches related content; clicking mention opens tagged profile.',
          permission: 'Public'
        }
      ]
    },
    {
      sectionName: 'Action Rail & Modals\n(Right Side)',
      items: [
        {
          container: 'Action Rail',
          control: 'Creator Follow Button ("+" Icon)',
          action: 'Click "+" icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Follows creator immediately and removes "+" button.',
          permission: 'Authenticated User'
        },
        {
          container: 'Action Rail',
          control: 'Heart Like Icon + Counter',
          action: 'Click Heart icon',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Likes video and increments like count.',
          permission: 'Authenticated User'
        },
        {
          container: 'Action Rail',
          control: 'Comment Icon + Counter',
          action: 'Click Comment icon',
          modal: 'Comments Drawer Sheet',
          modalInputs: '• List of comments with author avatars, names, timestamps, like buttons\n• Comment input textarea at bottom\n• Emoji picker\n• "Post Comment" submit button',
          expectedResult: 'Opens slide-out comment drawer on the right side while video continues playing.',
          permission: 'Authenticated User'
        },
        {
          container: 'Action Rail',
          control: 'Share Icon + Counter',
          action: 'Click Share icon',
          modal: 'Share Modal Window',
          modalInputs: '• Copy Link button\n• Share to Direct Message\n• Social share shortcuts',
          expectedResult: 'Copies video link or launches share interface.',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Action Rail',
          control: '"Create Lime" (+) Button',
          action: 'Click Create Lime (+)',
          modal: 'Create Lime Upload Modal Window',
          modalInputs: '• Video File Selector / Camera Record button\n• Video preview player\n• Caption textarea (with hashtags & mentions)\n• Cover thumbnail frame selector\n• Sound / Music search & attachment\n• Privacy selector (Public, Friends, Only Me)\n• "Allow Comments" toggle\n• "Post Lime" submit button & "Cancel" button\n• Upload progress bar',
          expectedResult: 'Uploads video to Storage, generates thumbnail, and publishes to the global Limes feed.',
          permission: 'Authenticated User'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 5: PROFILE (OWN & OTHER USERS)
  // ============================================================================
  createComprehensiveSheet('Profile', 'USER PROFILE — HEADER, TIMELINE, FRIENDS, ABOUT, GALLERY & MODALS AUDIT', [
    {
      sectionName: 'Profile Header Banner\n& Cover Photo',
      items: [
        {
          container: 'Cover Image Frame',
          control: '"Change Cover" Camera Icon Button',
          action: 'Click Camera icon',
          modal: 'Change Cover Photo Modal',
          modalInputs: '• "Choose Photo" file picker\n• Crop & Zoom tool\n• Preset gradient cover options\n• "Remove Current Cover" button\n• "Save Cover" submit button & "Cancel" button',
          expectedResult: 'Uploads new cover photo to Storage and updates profile header.',
          permission: 'Profile Owner'
        },
        {
          container: 'Avatar Frame',
          control: 'Profile Picture (Avatar Tap)',
          action: 'Click profile avatar',
          modal: 'Change Profile Picture Modal',
          modalInputs: '• "Upload Custom Photo" file picker\n• 10 Cartoon SVG Avatars grid selector\n• 10 Realistic SVG Avatars grid selector\n• "Save Avatar" submit button & "Cancel" button',
          expectedResult: 'Updates avatar picture across profile, posts, comments, chat summaries, and header.',
          permission: 'Profile Owner'
        },
        {
          container: 'Profile Bio & Meta',
          control: '"Edit Profile" Button',
          action: 'Click Edit Profile',
          modal: 'Edit Profile Details Modal',
          modalInputs: '• First Name & Last Name inputs\n• Username input (disabled / restricted)\n• Bio / About Me textarea (with character counter)\n• City & Country inputs\n• Phone number input\n• Student Level / Occupation dropdown\n• Social Links: Instagram, Twitter/X, LinkedIn, GitHub, YouTube, Website\n• "Save Changes" submit button & "Cancel" button',
          expectedResult: 'Saves updated personal information to Firestore and profile cache.',
          permission: 'Profile Owner'
        },
        {
          container: 'Profile Bio & Meta',
          control: '"Share Profile" Button',
          action: 'Click Share Profile',
          modal: 'Share Profile Modal',
          modalInputs: '• Copy Profile Link button\n• QR Code generator for quick mobile scanning\n• Social share shortcuts',
          expectedResult: 'Copies profile link (`https://ourlime.com/profile/[username]`).',
          permission: 'Public / Authenticated'
        },
        {
          container: 'Public Profile Action Bar\n(On Others\' Profiles)',
          control: 'Add Friend / Cancel / Accept / Unfriend Buttons',
          action: 'Click relationship button',
          modal: 'Confirm Unfriend Box (on Unfriend)',
          modalInputs: '• Unfriend confirmation prompt\n• "Confirm Unfriend" button & "Cancel" button',
          expectedResult: 'Dispatches friend request, accepts request, cancels outgoing request, or unfriends user.',
          permission: 'Authenticated Viewer'
        },
        {
          container: 'Public Profile Action Bar\n(On Others\' Profiles)',
          control: '"Message" Button',
          action: 'Click Message',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Opens direct 1-on-1 chat room with this user (`/chat/[chatId]`).',
          permission: 'Authenticated Viewer'
        }
      ]
    },
    {
      sectionName: 'Profile Workspace Tabs\n(Timeline, Friends, About, Gallery)',
      items: [
        {
          container: 'Workspace Navigation',
          control: 'Timeline Tab',
          action: 'Click Timeline',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays all posts created or reposted by this user with content filters (All, Photos, Videos, Polls, Events).',
          permission: 'Public'
        },
        {
          container: 'Friends Tab',
          control: 'Sub-tabs: Friends, Requests, Active, Following, Followers, Suggestions',
          action: 'Click sub-tab',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays connection lists. Requests & Suggestions sub-tabs are strictly visible only to profile owner.',
          permission: 'Public (Friends/Followers) / Owner (Requests/Suggestions)'
        },
        {
          container: 'Friends Tab (Requests)',
          control: 'Incoming Requests: "Accept" & "Decline" Buttons',
          action: 'Click Accept or Decline',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Accepts friendship immediately or removes request.',
          permission: 'Profile Owner'
        },
        {
          container: 'Workspace Navigation',
          control: 'About Tab',
          action: 'Click About',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Displays full bio, birth date, gender, location, occupation, joined date, interests tags, and verified badges.',
          permission: 'Public'
        },
        {
          container: 'Workspace Navigation',
          control: 'Gallery Tab (Photos & Videos Grid)',
          action: 'Click thumbnail',
          modal: 'Media Lightbox Viewer Modal',
          modalInputs: '• Full screen photo/video viewer\n• Category filter pills (All, Photos, Videos, Community Uploads)\n• Zoom controls\n• Download button',
          expectedResult: 'Renders complete grid of all media uploaded by the user and opens lightbox on click.',
          permission: 'Public'
        },
        {
          container: 'Workspace Navigation',
          control: '"Admin" Tab (Visible for Admin accounts only)',
          action: 'Click Admin',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Navigates to the Administrator Management Dashboard.',
          permission: 'Admin Role Only'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 6: ADMIN PANEL (ALL 12 WORKSPACES)
  // ============================================================================
  createComprehensiveSheet('Admin', 'ADMIN PANEL — ALL 12 WORKSPACES, CONTROLS & MANAGEMENT MODALS AUDIT', [
    {
      sectionName: '1. Dashboard & Analytics',
      items: [
        {
          container: 'System Health Dashboard',
          control: 'Metric KPI Cards (Users, Posts, Communities, Reports, Server CPU/Memory)',
          action: 'View dashboard',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Shows live system health stats and user metrics.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Analytics Workspace',
          control: 'Domain Filter Tabs (All, Audience, Social, Communities, Events, Market)',
          action: 'Click Domain tab',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters platform growth charts and activity analytics by domain.',
          permission: 'Admin Role Only'
        }
      ]
    },
    {
      sectionName: '2. User Management',
      items: [
        {
          container: 'User Directory Table',
          control: 'Search Box & Role/Status Filters',
          action: 'Type query / select filters',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters user accounts by name, email, role (Regular, Creator, Admin), and status (Active, Suspended, Banned).',
          permission: 'Admin Role Only'
        },
        {
          container: 'User Directory Table',
          control: '"Export CSV" Button',
          action: 'Click Export CSV',
          modal: 'Download Confirmation Box',
          modalInputs: '• Download CSV button',
          expectedResult: 'Exports and downloads complete user list as spreadsheet.',
          permission: 'Admin Role Only'
        },
        {
          container: 'User Directory Table',
          control: 'User Account Row Tap',
          action: 'Click user row',
          modal: 'Manage User Account Modal Window',
          modalInputs: '• Role Tab: Role dropdown (Regular User, Creator, Moderator, Admin) + Save Role button\n• Account Status Tab: Status dropdown (Active, Suspended, Banned), Duration selector, Reason textarea + Save button\n• Verification Tab: Verified Blue Checkmark toggle + reason input\n• Lifecycle Tab: Send Password Reset Email, Force Logout, Permanent Delete Account (with type username confirmation)',
          expectedResult: 'Allows admin to update roles, issue bans, grant verified checkmarks, or delete accounts.',
          permission: 'Admin Role Only'
        }
      ]
    },
    {
      sectionName: '3. Testers & Beta Access',
      items: [
        {
          container: 'Beta Access Control',
          control: 'Registration Mode Radio Options (Open, Invite Only, Closed)',
          action: 'Select mode & click Save',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Updates platform sign-up policy.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Beta Invitations',
          control: '"Invite Tester" Button',
          action: 'Click Invite Tester',
          modal: 'Send Beta Invitation Modal',
          modalInputs: '• Invitee Email input\n• Note box\n• Expiration Date picker\n• "Send Invitation" submit button',
          expectedResult: 'Generates secure beta invitation token and sends invite email.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Beta Applications Tab',
          control: 'Applicant Rows: "Approve" & "Decline" Buttons',
          action: 'Click Approve or Decline',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Approves beta tester application and issues registration link.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Active Testers Tab',
          control: '"Remove Beta Tester" Button',
          action: 'Click Remove Tester',
          modal: 'Confirmation Dialog Box',
          modalInputs: '• "Remove tester from beta access?" prompt\n• "Confirm Removal" button',
          expectedResult: 'Revokes beta testing permissions from the account via `removeBetaTester` service.',
          permission: 'Admin Role Only'
        }
      ]
    },
    {
      sectionName: '4. Page Access Settings',
      items: [
        {
          container: 'Page Access Table',
          control: 'Route Status Dropdown (Active, Coming Soon, Maintenance, Disabled)',
          action: 'Change dropdown value',
          modal: 'Edit Page Access Modal',
          modalInputs: '• Status selector\n• Required Role selector (Public, Authenticated, Admin)\n• Custom Overlay Message textarea\n• "Save Settings" button',
          expectedResult: 'Setting to "Coming Soon" immediately blocks that page with a sleek dark glass overlay.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Page Access Table',
          control: '"Reset to Defaults" Button',
          action: 'Click Reset',
          modal: 'Confirmation Dialog Box',
          modalInputs: '• Reset confirmation prompt\n• "Confirm Reset" button',
          expectedResult: 'Restores default factory page availability settings.',
          permission: 'Admin Role Only'
        }
      ]
    },
    {
      sectionName: '5. Moderation & Reports',
      items: [
        {
          container: 'Reports Directory Table',
          control: 'Report Row Tap',
          action: 'Click report row',
          modal: 'Moderation Action Modal Window',
          modalInputs: '• Reported content preview & author info\n• Action selector: Dismiss Report, Remove Content / Delete Post, Issue Warning, Suspend User (1-30 days / permanent)\n• Mandatory Reason textarea\n• Internal Moderator Notes textarea\n• "Execute Moderation Action" submit button',
          expectedResult: 'Executes authoritative moderation action, deletes infringing content, logs audit entry, and notifies user.',
          permission: 'Admin / Moderator Role'
        }
      ]
    },
    {
      sectionName: '6. Community Categories\n& Market Admin',
      items: [
        {
          container: 'Community Categories Workspace',
          control: '"Add Category" Button',
          action: 'Click Add Category',
          modal: 'Create Category Modal',
          modalInputs: '• Category Name input\n• Icon picker\n• Description textarea\n• "Save Category" button',
          expectedResult: 'Adds official category for community classification.',
          permission: 'Admin Role Only'
        },
        {
          container: 'Global Communities Workspace',
          control: 'Feature Community & Verify Badges',
          action: 'Toggle Feature / Verify',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Grants verified badge to community or sets as Community of the Week on directory.',
          permission: 'Admin Role Only'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 7: CHAT & MESSAGING
  // ============================================================================
  createComprehensiveSheet('Chat & Messaging', 'CHAT & DIRECT MESSAGING — INBOX, CHAT ROOM & AGORA CALLS AUDIT', [
    {
      sectionName: 'Chat Inbox List\n(Left Pane)',
      items: [
        {
          container: 'Inbox Header',
          control: 'Search Conversations Input Box',
          action: 'Type name in search box',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Filters chat conversation list in real time.',
          permission: 'Authenticated User'
        },
        {
          container: 'Inbox Header',
          control: '"New Message" Compose Button (+ Icon)',
          action: 'Click "+" icon',
          modal: 'Start New Chat Modal Window',
          modalInputs: '• Search friends input box\n• Friends list with avatars and online status\n• Click friend to start chat',
          expectedResult: 'Creates or opens chat room with selected friend.',
          permission: 'Authenticated User'
        },
        {
          container: 'Conversation Row',
          control: 'Conversation Item (Avatar, Name, Preview, Timestamp, Unread Badge)',
          action: 'Click chat row',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Opens chat room in right pane and marks messages as read.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Chat Room Header\n(Top Bar)',
      items: [
        {
          container: 'Header Info',
          control: 'Partner Avatar, Name & Online Status ("Active now")',
          action: 'Click partner name',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Opens partner\'s profile page.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Calling Controls',
          control: 'Voice Call Button (Phone Icon)',
          action: 'Click Voice Call',
          modal: 'Agora Voice Call Overlay Window',
          modalInputs: '• Mute Microphone toggle button\n• Speaker output toggle button\n• "End Call" red button\n• Call duration timer',
          expectedResult: 'Initiates real-time Agora 1-on-1 audio call with ringtone.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Calling Controls',
          control: 'Video Call Button (Video Camera Icon)',
          action: 'Click Video Call',
          modal: 'Agora Video Call Full-Screen Window',
          modalInputs: '• Mute Microphone toggle\n• Turn Camera On/Off toggle\n• Flip Camera toggle\n• "End Call" red button\n• Local video preview & Remote partner video',
          expectedResult: 'Initiates real-time Agora 1-on-1 video call.',
          permission: 'Authenticated User'
        },
        {
          container: 'Header Options Menu',
          control: 'Three-Dots Options Menu (...)',
          action: 'Click three dots',
          modal: 'Chat Settings Dropdown',
          modalInputs: '• View Profile\n• Mute Notifications toggle\n• Change Wallpaper modal\n• Clear Chat History (with confirm)\n• Block User modal',
          expectedResult: 'Displays chat customization and management options.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Message Stream\n& Composer Bar',
      items: [
        {
          container: 'Message Bubble Item',
          control: 'Message Bubble (Right Click / Long Press)',
          action: 'Right click or long press message',
          modal: 'Message Context Actions Menu',
          modalInputs: '• "Reply" (quotes message above composer)\n• "Forward" (opens friends chooser modal)\n• "Copy Text"\n• "React with Emoji" (Heart, Thumbs Up, Laugh, Surprised, Sad, Angry)\n• "Delete for Me"\n• "Delete for Everyone" (if sender)',
          expectedResult: 'Opens message action menu.',
          permission: 'Authenticated User'
        },
        {
          container: 'Chat Composer Bar',
          control: 'Attachment Button (+ Icon)',
          action: 'Click "+" icon',
          modal: 'Attachment Options Sheet',
          modalInputs: '• Photo & Video Gallery picker\n• Camera Take Photo\n• Document File picker\n• Share Location map\n• Share Contact',
          expectedResult: 'Attaches media or documents to chat message.',
          permission: 'Authenticated User'
        },
        {
          container: 'Chat Composer Bar',
          control: 'Stickers & Emoji Button (Smiley Icon)',
          action: 'Click Smiley icon',
          modal: 'Sticker & Emoji Drawer',
          modalInputs: '• Official Sticker Packs tabs\n• Animated sticker grid\n• Full Emoji categories grid',
          expectedResult: 'Inserts emoji or sends animated sticker.',
          permission: 'Authenticated User'
        },
        {
          container: 'Chat Composer Bar',
          control: 'Voice Note Microphone Button',
          action: 'Hold microphone icon',
          modal: 'Voice Recording Bar',
          modalInputs: '• Live recording waveform\n• Swipe left to Cancel\n• Release to Send button',
          expectedResult: 'Records audio and sends voice note message with audio player.',
          permission: 'Authenticated User'
        },
        {
          container: 'Chat Composer Bar',
          control: 'Send Button (Paper Plane Icon)',
          action: 'Click Send icon or press Enter',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Sends text message immediately, scrolls to bottom, and shows delivery checkmarks.',
          permission: 'Authenticated User'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 8: SETTINGS & ACCOUNT
  // ============================================================================
  createComprehensiveSheet('Settings', 'SETTINGS & ACCOUNT — APPEARANCE, PRIVACY, SECURITY & 2FA AUDIT', [
    {
      sectionName: 'Appearance & Theme',
      items: [
        {
          container: 'Theme Mode Selector',
          control: 'System / Light / Dark Radio Options',
          action: 'Select theme mode',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Updates application color theme immediately across all pages without reloading.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Privacy & Safety',
      items: [
        {
          container: 'Account Privacy',
          control: 'Private Account Switch (On / Off)',
          action: 'Toggle switch',
          modal: 'Confirmation Dialog Box',
          modalInputs: '• "Switch to Private Account?" prompt\n• "Confirm" button',
          expectedResult: 'Sets account to private so only accepted friends can view posts and timeline.',
          permission: 'Authenticated User'
        },
        {
          container: 'Activity Status',
          control: 'Show Online Status Switch (On / Off)',
          action: 'Toggle switch',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Shows or hides green online status dot in chat and profile.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Security & Login',
      items: [
        {
          container: 'Password Management',
          control: '"Change Password" Form',
          action: 'Enter passwords & click Update',
          modal: 'No Popup',
          modalInputs: '• Current Password input\n• New Password input\n• Confirm New Password input\n• "Update Password" button',
          expectedResult: 'Validates current password and updates to new password.',
          permission: 'Authenticated User'
        },
        {
          container: 'Two-Factor Authentication (2FA)',
          control: '"Enable 2FA" Button',
          action: 'Click Enable 2FA',
          modal: '2FA Setup Modal Window',
          modalInputs: '• QR Code for Authenticator App\n• Secret key copy box\n• 6-digit verification code input\n• "Verify & Enable" button',
          expectedResult: 'Enables 2-factor verification on future logins.',
          permission: 'Authenticated User'
        },
        {
          container: 'Active Sessions',
          control: '"Log Out All Devices" Button',
          action: 'Click Log Out All',
          modal: 'Confirmation Box',
          modalInputs: '• "Log out of all other sessions?" prompt\n• "Confirm" button',
          expectedResult: 'Invalidates all other active login tokens.',
          permission: 'Authenticated User'
        }
      ]
    },
    {
      sectionName: 'Blocked Users',
      items: [
        {
          container: 'Blocked Users List',
          control: 'Blocked User Row ("Unblock" Button)',
          action: 'Click "Unblock"',
          modal: 'Unblock Confirmation Box',
          modalInputs: '• "Unblock [Username]?" prompt\n• "Unblock" button & "Cancel" button',
          expectedResult: 'Unblocks user and restores profile/search visibility.',
          permission: 'Authenticated User'
        }
      ]
    }
  ]);

  // ============================================================================
  // SHEET 9: AUTH & REGISTRATION
  // ============================================================================
  createComprehensiveSheet('Auth & Registration', 'AUTHENTICATION DOMAIN — LOGIN, 8-STEP REGISTER & PASSWORD RECOVERY AUDIT', [
    {
      sectionName: 'Login Screen\n(`/login`)',
      items: [
        {
          container: 'Sign In Form',
          control: 'Email & Password Input Fields',
          action: 'Type credentials & click Sign In',
          modal: 'No Popup',
          modalInputs: '• Email input\n• Password input (with show/hide eye icon)\n• "Remember Me" checkbox\n• "Forgot Password?" link\n• "Sign In" submit button',
          expectedResult: 'Authenticates user via Firebase Auth, checks account status (banned/deleted), and navigates to Home Feed.',
          permission: 'Public'
        }
      ]
    },
    {
      sectionName: '8-Step Registration\n(`/register`)',
      items: [
        {
          container: 'Step 0: Welcome',
          control: '"Get Started" Button',
          action: 'Click Get Started',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Advances to Step 1 Account Type.',
          permission: 'Public'
        },
        {
          container: 'Step 1: Account Type',
          control: 'Account Type Cards (Personal, Creator, Student, Business)',
          action: 'Select card & click Next',
          modal: 'No Popup',
          modalInputs: 'N/A',
          expectedResult: 'Selects account category and advances to Step 2.',
          permission: 'Public'
        },
        {
          container: 'Step 2: Basic Info',
          control: 'Name, Username, Email & Password Inputs',
          action: 'Fill inputs & click Next',
          modal: 'Terms & Privacy Popups (if links clicked)',
          modalInputs: '• First Name & Last Name inputs\n• Username input (with live availability check)\n• Email input (with live check)\n• Password & Confirm Password inputs\n• Terms of Service link & Privacy Policy link\n• "I agree to Terms" checkbox\n• "Next" button',
          expectedResult: 'Validates username and email availability before advancing.',
          permission: 'Public'
        },
        {
          container: 'Step 3: Demographics',
          control: 'Date of Birth, Gender & Student Level Inputs',
          action: 'Fill inputs & click Next',
          modal: 'No Popup',
          modalInputs: '• Date of Birth picker (must be 13+)\n• Gender dropdown (Male, Female, Non-Binary, Prefer not to say)\n• Student Level dropdown\n• "Next" button',
          expectedResult: 'Saves demographics and advances.',
          permission: 'Public'
        },
        {
          container: 'Step 4: Location',
          control: 'Country, City & Phone Inputs',
          action: 'Fill inputs & click Next',
          modal: 'No Popup',
          modalInputs: '• Country dropdown\n• City text input\n• Phone number with country code\n• "Next" button',
          expectedResult: 'Saves location details and advances.',
          permission: 'Public'
        },
        {
          container: 'Step 5: Avatar Selection',
          control: 'Avatar Options Grid',
          action: 'Choose avatar & click Next',
          modal: 'No Popup',
          modalInputs: '• "Upload Custom Photo" button\n• 10 Cartoon SVG avatars grid\n• 10 Realistic SVG avatars grid\n• "Next" button',
          expectedResult: 'Assigns chosen avatar to new account and advances.',
          permission: 'Public'
        },
        {
          container: 'Step 6: Interests',
          control: 'Interest Tag Chips (Music, Tech, Sports, Gaming, Art, Food, Travel, etc.)',
          action: 'Select 3+ chips & click Next',
          modal: 'No Popup',
          modalInputs: '• Grid of 16 selectable interest pills\n• "Next" button (enabled when 3+ selected)',
          expectedResult: 'Saves user interests for content recommendation engine.',
          permission: 'Public'
        },
        {
          container: 'Step 7: Verification & Submit',
          control: '"Create My Account" Submit Button',
          action: 'Click Create My Account',
          modal: 'Registration Success Modal Window',
          modalInputs: '• "Registration Complete! Welcome to Ourlime" banner\n• "Go to Home Feed" button',
          expectedResult: 'Creates Firebase Auth account, creates user profile document, and redirects to Home Feed.',
          permission: 'Public'
        }
      ]
    },
    {
      sectionName: 'Password Recovery\n(`/forgot-password`)',
      items: [
        {
          container: 'Password Reset Form',
          control: 'Email Input & "Send Reset Link" Button',
          action: 'Enter email & click Send',
          modal: 'Open Email Shortcuts Box',
          modalInputs: '• "Open Gmail" shortcut\n• "Open Outlook" shortcut\n• "Open Mail App" shortcut',
          expectedResult: 'Sends password reset link to user email with direct mail app shortcuts.',
          permission: 'Public'
        }
      ]
    }
  ]);

  // Save Master Workbook to both projects and artifacts
  const outputPath = path.join(rootDir, 'Ourlime_Web_Master_FRD_Full_Specification.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ Master FRD Excel Sheet Successfully Created at:\n📍 ${outputPath}`);
}

const rootDir = path.resolve(__dirname, '..');
buildMasterFRD().catch(err => {
  console.error('❌ Failed to generate Master FRD Excel:', err);
  process.exit(1);
});
