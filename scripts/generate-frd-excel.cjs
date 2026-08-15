const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function buildFRD() {
  console.log('🚀 Generating 100% Desktop-Accurate Ourlime-Web FRD Excel Sheet...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ourlime Team';
  workbook.lastModifiedBy = 'Antigravity AI Agent';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Colors & Fills
  const mainHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Dark Emerald
  const colHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }; // Emerald Green

  const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  const whiteFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const columnsDef = [
    { header: 'Desktop Page Section', key: 'section', width: 26 },
    { header: 'Button / Feature / Card Name', key: 'feature', width: 30 },
    { header: 'What You Do (Action)', key: 'action', width: 24 },
    { header: 'Does A Popup Open?', key: 'hasPopup', width: 24 },
    { header: 'What Is Inside The Popup?', key: 'popupContent', width: 44 },
    { header: 'Expected Result (What Should Happen)', key: 'expectedResult', width: 52 },
    { header: 'Web Check (Pass / Fail)', key: 'webStatus', width: 22 },
    { header: 'Mobile Check (Pass / Fail)', key: 'mobileStatus', width: 22 },
    { header: 'Notes / Issues Found', key: 'notes', width: 30 }
  ];

  function createSheet(sheetName, titleText, sectionsData) {
    const sheet = workbook.addWorksheet(sheetName);

    // Title Row
    sheet.mergeCells('A1:I1');
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
          feature: item.feature,
          action: item.action,
          hasPopup: item.hasPopup,
          popupContent: item.popupContent,
          expectedResult: item.expectedResult,
          webStatus: item.webStatus || '[  ] Pass',
          mobileStatus: item.mobileStatus || '[  ] Pass',
          notes: item.notes || ''
        });

        row.height = 42;
        const isZebra = itemIdx % 2 === 1;

        row.eachCell((cell, colNum) => {
          cell.fill = isZebra ? zebraFill : whiteFill;
          cell.border = thinBorder;
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

          if (colNum === 1) { // Section column
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF064E3B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          } else if (colNum === 2) { // Feature column
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          } else if (colNum === 7 || colNum === 8) { // Pass/Fail Status columns
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF047857' } };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
          }
        });
      });

      // Merge Section cells vertically so Section Name is listed ONLY ONCE per block
      if (items.length > 1) {
        sheet.mergeCells(`A${startRow}:A${endRow}`);
      }

      currentRowIdx = endRow + 1;
    });
  }

  // ============================================================================
  // 1. FEEDS PAGE (100% Matching Desktop Screenshot)
  // ============================================================================
  createSheet('Feeds', 'OURLIME FEEDS (HOME) — DESKTOP 3-COLUMN LAYOUT & QA FEATURE AUDIT', [
    {
      sectionName: 'Top Navigation Header\n(Global Bar)',
      items: [
        {
          feature: 'Ourlime Logo',
          action: 'Click Logo',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Reloads or navigates directly back to the Home Feed page.'
        },
        {
          feature: 'Search Box ("Search users...")',
          action: 'Type name in box',
          hasPopup: 'Yes - Search Results Dropdown',
          popupContent: '• List of matching user profiles with avatars and @usernames\n• Click user to visit their profile',
          expectedResult: 'Searches people as you type and lets you click a user to open their profile.'
        },
        {
          feature: 'Notifications Bell Icon',
          action: 'Click Bell icon',
          hasPopup: 'Yes - Notifications Dropdown Window',
          popupContent: '• Unread notification alerts\n• Friend requests (Accept / Decline)\n• Post likes, comments, and mentions\n• "Mark all as read" button',
          expectedResult: 'Shows your latest alerts and resets the unread count badge to 0.'
        },
        {
          feature: 'User Avatar Profile Icon',
          action: 'Click Avatar icon',
          hasPopup: 'Yes - User Menu Dropdown',
          popupContent: '• View Profile link\n• Settings link\n• Admin Panel link (if Admin)\n• Log Out button',
          expectedResult: 'Opens quick user menu shortcuts.'
        },
        {
          feature: 'Sub-Navbar Category Tabs',
          action: 'Click any tab (Home, Limes, Blogs, Events, Jobs, Communities, Market)',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Navigates to that platform section (e.g. clicking Communities opens Communities page).'
        }
      ]
    },
    {
      sectionName: 'Left Section\n(Desktop Sidebar)',
      items: [
        {
          feature: 'Profile Welcome Card ("View Profile" Button)',
          action: 'Click "View Profile"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Takes you directly to your own Profile page.'
        },
        {
          feature: 'Games Card ("Trini Wordle" Button)',
          action: 'Click "Trini Wordle"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Opens the Trini Wordle game screen.'
        },
        {
          feature: 'Games Card ("See All" Link)',
          action: 'Click "See All"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Opens the complete games library page.'
        },
        {
          feature: 'Feed Scope Selector ("Home" Pill)',
          action: 'Click "Home"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Shows the main mixed home feed with posts from friends and public posts.'
        },
        {
          feature: 'Feed Scope Selector ("Friends" Tab)',
          action: 'Click "Friends"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Filters feed so you only see posts created by your accepted friends.'
        },
        {
          feature: 'Feed Scope Selector ("Communities" Tab)',
          action: 'Click "Communities"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Filters feed so you only see posts from communities you joined.'
        },
        {
          feature: 'Activity This Week Card (Posts & Friends Metrics)',
          action: 'View stats card',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Displays your total posts published and friends added during the current week.'
        }
      ]
    },
    {
      sectionName: 'Middle Section\n(Main Content Feed)',
      items: [
        {
          feature: '# FEED FILTERS Bar (All, Photos, Videos, Sound, Polls, Events)',
          action: 'Click a filter pill',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Instantly filters the posts on your feed by that category (e.g. clicking "Photos" shows only picture posts).'
        },
        {
          feature: 'Create Post Input ("What\'s on your mind, [Name]?")',
          action: 'Click inside box',
          hasPopup: 'Yes - Create Post Window',
          popupContent: '• Caption text box\n• Add Photos/Videos uploader (up to 5)\n• Add Location search\n• Add Poll option\n• Add Event details\n• Privacy selector (Public, Friends, Only Me)\n• Post button',
          expectedResult: 'Opens the full Create Post popup window.'
        },
        {
          feature: 'Photo Quick Button (Green Icon)',
          action: 'Click "Photo"',
          hasPopup: 'Yes - Create Post Window',
          popupContent: 'Opens Create Post window with photo file picker already activated.',
          expectedResult: 'Lets you choose images from your computer to attach to your post.'
        },
        {
          feature: 'Event Quick Button (Blue Icon)',
          action: 'Click "Event"',
          hasPopup: 'Yes - Create Post Window',
          popupContent: 'Opens Create Post window with Event details fields (Date, Time, Location, Frequency) ready to fill.',
          expectedResult: 'Lets you publish an event with an RSVP button on the feed.'
        },
        {
          feature: 'Poll Quick Button (Orange Icon)',
          action: 'Click "Poll"',
          hasPopup: 'Yes - Create Post Window',
          popupContent: 'Opens Create Post window with voting options (Option 1, Option 2, Duration).',
          expectedResult: 'Lets you create an interactive poll for users to vote on.'
        },
        {
          feature: 'Location Quick Button (Purple Icon)',
          action: 'Click "Location"',
          hasPopup: 'Yes - Create Post Window',
          popupContent: 'Opens Create Post window with location map search box open.',
          expectedResult: 'Lets you tag a city or address to your post.'
        },
        {
          feature: 'Post Author Name & Avatar',
          action: 'Click Author name/avatar',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Opens that author\'s profile page.'
        },
        {
          feature: 'Post Options Three-Dots Menu (...)',
          action: 'Click three dots',
          hasPopup: 'Yes - Post Options Menu',
          popupContent: '• Copy Link\n• Report Post\n• Delete Post (if owner)\n• Mute User',
          expectedResult: 'Shows options to share, report, or delete the post.'
        },
        {
          feature: 'Post Picture / Video (0px Sharp Borders)',
          action: 'Click image or video',
          hasPopup: 'Yes - Full Screen Image Viewer',
          popupContent: 'Full screen picture viewer with zoom and close buttons.',
          expectedResult: 'Opens photo in high-resolution full screen. Post pictures fill the entire card with 0px sharp square corners.'
        },
        {
          feature: 'Event Post "Attend" Button',
          action: 'Click "Attend"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Changes to "Attending" with a green checkmark and increases attendees count by 1.'
        },
        {
          feature: 'Heart Like Icon',
          action: 'Click heart icon',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Heart turns red immediately and like counter increases by 1.'
        },
        {
          feature: 'Comment Icon',
          action: 'Click comment icon',
          hasPopup: 'Yes - Comments Window',
          popupContent: '• Comments list with avatars and timestamps\n• Reply button on each comment\n• New comment input box at bottom',
          expectedResult: 'Opens the comments window to read and write replies.'
        },
        {
          feature: 'Repost Icon',
          action: 'Click repost icon',
          hasPopup: 'Yes - Repost Confirmation Box',
          popupContent: '• Optional quote thoughts box\n• Repost button',
          expectedResult: 'Shares the post to your personal profile timeline.'
        },
        {
          feature: 'Share Link Icon',
          action: 'Click share icon',
          hasPopup: 'Yes - Share Menu',
          popupContent: '• Copy Link\n• Share to WhatsApp\n• Share to X / Twitter\n• Share to Facebook',
          expectedResult: 'Copies post web link to clipboard or opens social share app.'
        }
      ]
    },
    {
      sectionName: 'Right Section\n(Desktop Sidebar)',
      items: [
        {
          feature: 'Promoted Card Carousel (Left/Right Arrows < >)',
          action: 'Click arrows < or >',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Slides between different sponsored ads (Jobs, Communities, Services).'
        },
        {
          feature: 'Promoted Job "Apply" Button',
          action: 'Click "Apply"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Opens that job listing details page to apply.'
        },
        {
          feature: 'Promoted Community "Join" Button',
          action: 'Click "Join"',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Joins that promoted community or opens its page.'
        },
        {
          feature: 'Suggested Users "Add Friend" Button (User+ Icon)',
          action: 'Click User+ icon',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Sends friend request immediately and changes button to a green checkmark.'
        }
      ]
    }
  ]);

  // ============================================================================
  // 2. COMMUNITIES PAGE
  // ============================================================================
  createSheet('Communities', 'OURLIME COMMUNITIES — DESKTOP DIRECTORY, DETAIL & ADMIN AUDIT', [
    {
      sectionName: 'Left Directory\n& Filters',
      items: [
        {
          feature: 'Directory Scope Tabs (All, Joined, Created)',
          action: 'Click scope tab',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Filters the list of communities (all public groups, groups you joined, or groups you created).'
        },
        {
          feature: 'Search Box & Filter Button',
          action: 'Type group name',
          hasPopup: 'Yes - Filter Sheet (when filter icon clicked)',
          popupContent: '• Privacy filter (All, Public, Private)\n• Category dropdown\n• Sort order (Most Popular, Newest, Trending)',
          expectedResult: 'Searches and sorts community cards in real time.'
        },
        {
          feature: 'Create Community Button',
          action: 'Click Create Community',
          hasPopup: 'Yes - Create Community Window',
          popupContent: '• Community Name input\n• Custom URL (Slug) with check availability button\n• Cover Banner Picture uploader\n• Description text box\n• Category dropdown\n• Public or Private toggle\n• Terms agreement checkbox\n• Create button',
          expectedResult: 'Creates the new community and opens its page immediately.'
        }
      ]
    },
    {
      sectionName: 'Community Page Header\n& Join Actions',
      items: [
        {
          feature: 'Join / Request Access Button',
          action: 'Click Join / Request',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Public group: makes you a member immediately. Private group: sends a join request to the owner.'
        },
        {
          feature: 'Leave Community Button',
          action: 'Click Leave',
          hasPopup: 'Yes - Confirm Leave Box',
          popupContent: '• Prompt: "Are you sure you want to leave this community?"\n• Confirm Leave button',
          expectedResult: 'Removes you from the group member list.'
        },
        {
          feature: 'Community Header Like Heart',
          action: 'Click heart on cover',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Likes the community and adds +1 to community likes count.'
        }
      ]
    },
    {
      sectionName: 'Community Tabs\n(Posts, Events, Polls, Members, About, Dashboard)',
      items: [
        {
          feature: 'Posts Tab',
          action: 'Click Posts',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Displays all posts published inside this community.'
        },
        {
          feature: 'Host Event Button (in Events tab)',
          action: 'Click Host Event',
          hasPopup: 'Yes - Create Event Window',
          popupContent: '• Event Title input\n• Cover Picture uploader\n• Date & Time pickers\n• Location / Address input\n• Description box\n• Save Event button',
          expectedResult: 'Saves new event under the community calendar.'
        },
        {
          feature: 'Create Poll Button (in Polls tab)',
          action: 'Click Create Poll',
          hasPopup: 'Yes - Create Poll Window',
          popupContent: '• Question input\n• Option 1 & 2 inputs (add up to 5)\n• Duration selector (1-7 days)\n• Post Poll button',
          expectedResult: 'Publishes an interactive voting poll for group members.'
        },
        {
          feature: 'Members Tab & Search',
          action: 'Click Members',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Lists all group members with their roles (Owner, Moderator, Member).'
        },
        {
          feature: 'Admin Dashboard Button (Owners & Mods Only)',
          action: 'Click Admin Dashboard',
          hasPopup: 'Yes - Full Admin Dashboard Window',
          popupContent: '• Overview stats\n• Members list with Role change buttons\n• Pending Join Requests (Approve / Decline)\n• Content Reports list\n• Community Settings',
          expectedResult: 'Opens full admin management window to control members, requests, and reported posts.'
        }
      ]
    }
  ]);

  // ============================================================================
  // 3. LIMES (SHORT VIDEOS)
  // ============================================================================
  createSheet('Limes', 'OURLIME LIMES (SHORT VIDEOS) — DESKTOP & QA FEATURE AUDIT', [
    {
      sectionName: 'Vertical Video Viewport',
      items: [
        {
          feature: 'Video Player Feed',
          action: 'Scroll Up / Down',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Moves to next or previous video clip. Video plays automatically.'
        },
        {
          feature: 'Mute / Sound Toggle Button',
          action: 'Click sound icon',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Mutes or unmutes video sound.'
        }
      ]
    },
    {
      sectionName: 'Right Side Action Rail',
      items: [
        {
          feature: 'Creator Avatar & Follow (+)',
          action: 'Click Avatar or +',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Opens creator profile or follows the creator.'
        },
        {
          feature: 'Heart Like Icon',
          action: 'Click heart icon',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Likes video and increases like counter.'
        },
        {
          feature: 'Comment Icon',
          action: 'Click comment icon',
          hasPopup: 'Yes - Comments Drawer Sheet',
          popupContent: '• Comments list\n• Type comment input box\n• Post comment button',
          expectedResult: 'Opens comment drawer on the right side while video continues playing.'
        },
        {
          feature: 'Share Button',
          action: 'Click share icon',
          hasPopup: 'Yes - Share Options Menu',
          popupContent: '• Copy Link\n• Share to Direct Message',
          expectedResult: 'Copies link to clipboard to share with others.'
        },
        {
          feature: 'Create Lime (+) Button',
          action: 'Click Create Lime (+)',
          hasPopup: 'Yes - Video Upload Window',
          popupContent: '• Video File Selector / Camera Record\n• Caption text box\n• Cover picture picker\n• Privacy selector\n• Publish button',
          expectedResult: 'Uploads your short video to the global Limes feed.'
        }
      ]
    }
  ]);

  // ============================================================================
  // 4. PROFILE PAGE
  // ============================================================================
  createSheet('Profile', 'OURLIME USER PROFILE — DESKTOP SECTIONS & QA FEATURE AUDIT', [
    {
      sectionName: 'Profile Header Banner',
      items: [
        {
          feature: 'Edit Cover Photo (Camera Icon)',
          action: 'Click camera icon on cover',
          hasPopup: 'Yes - Upload Cover Window',
          popupContent: '• Choose Picture file\n• Crop & Adjust tool\n• Remove Cover option\n• Save button',
          expectedResult: 'Saves your new wide cover photo at the top of your profile.'
        },
        {
          feature: 'Edit Avatar Picture (Avatar Tap)',
          action: 'Click profile picture',
          hasPopup: 'Yes - Profile Picture Window',
          popupContent: '• Upload Custom Photo\n• Choose Cartoon SVG Avatar\n• Choose Realistic SVG Avatar\n• Save button',
          expectedResult: 'Updates your picture across your profile, posts, comments, and messages.'
        },
        {
          feature: 'Edit Profile Button',
          action: 'Click Edit Profile',
          hasPopup: 'Yes - Edit Profile Window',
          popupContent: '• First Name & Last Name inputs\n• Bio / About Me text box\n• City & Country inputs\n• Website link\n• Save button',
          expectedResult: 'Saves your personal details to your profile.'
        },
        {
          feature: 'Add Friend / Accept / Cancel Buttons (On Others\' Profiles)',
          action: 'Click action button',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Sends friend request, accepts request, or cancels pending request.'
        }
      ]
    },
    {
      sectionName: 'Profile Tabs\n(Timeline, Friends, About, Gallery)',
      items: [
        {
          feature: 'Timeline Tab (User Posts & Reposts)',
          action: 'Click Timeline',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Displays all posts created or reposted by this user.'
        },
        {
          feature: 'Friends Tab (Requests, Following, Followers)',
          action: 'Click Friends',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Shows friends list, incoming requests (Accept / Decline), and suggested connections.'
        },
        {
          feature: 'About Tab (Bio & Details)',
          action: 'Click About',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Shows user bio, location, join date, student status, and badges.'
        },
        {
          feature: 'Gallery Tab (Photos & Videos Grid)',
          action: 'Click Gallery',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Shows photo and video grid album of all media posted by the user.'
        }
      ]
    }
  ]);

  // ============================================================================
  // 5. ADMIN WORKSPACES
  // ============================================================================
  createSheet('Admin', 'OURLIME ADMIN PANEL — ALL 12 WORKSPACES & QA FEATURE AUDIT', [
    {
      sectionName: '1. Dashboard & Analytics',
      items: [
        {
          feature: 'System Health & Metrics Cards',
          action: 'View Dashboard',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Shows live online users, total posts, server health indicator, and pending reports.'
        }
      ]
    },
    {
      sectionName: '2. User Management',
      items: [
        {
          feature: 'User Search & Export CSV',
          action: 'Search / Click Export',
          hasPopup: 'Yes - Download Confirmation',
          popupContent: '• Download CSV file button',
          expectedResult: 'Downloads spreadsheet file of registered users.'
        },
        {
          feature: 'User Row Detail Tap',
          action: 'Click user row',
          hasPopup: 'Yes - Manage User Window',
          popupContent: '• Role selector (Regular, Creator, Admin)\n• Verification Checkmark toggle\n• Ban / Suspend Account switch\n• Delete Account button',
          expectedResult: 'Allows admin to change roles, grant verified badges, or ban accounts.'
        }
      ]
    },
    {
      sectionName: '3. Testers & Beta Access',
      items: [
        {
          feature: 'Registration Mode Selector',
          action: 'Select mode (Open, Invite Only, Closed)',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Controls whether public users can sign up or need an invite.'
        },
        {
          feature: 'Invite Tester Button',
          action: 'Click Invite Tester',
          hasPopup: 'Yes - Send Invite Window',
          popupContent: '• Invitee Email input\n• Note box\n• Send button',
          expectedResult: 'Sends beta registration invite code to user\'s email.'
        }
      ]
    },
    {
      sectionName: '4. Page Access Settings',
      items: [
        {
          feature: 'Page Status Toggle (Active / Coming Soon)',
          action: 'Toggle switch next to page name',
          hasPopup: 'Yes - Edit Page Message Window',
          popupContent: '• Status dropdown (Active, Coming Soon, Maintenance)\n• Custom Message text box',
          expectedResult: 'Setting to "Coming Soon" immediately blocks that page with a dark glass overlay.'
        }
      ]
    },
    {
      sectionName: '5. Moderation & Reports',
      items: [
        {
          feature: 'Report Item Action Button',
          action: 'Click reported item',
          hasPopup: 'Yes - Moderation Action Window',
          popupContent: '• Dismiss Report button\n• Remove Content button\n• Issue Warning button\n• Suspend User button\n• Mandatory Reason box',
          expectedResult: 'Allows moderator to delete bad posts or ban rule-breakers.'
        }
      ]
    }
  ]);

  // ============================================================================
  // 6. DISCOVER & SEARCH
  // ============================================================================
  createSheet('Discover & Search', 'DISCOVER & SEARCH — DESKTOP & QA FEATURE AUDIT', [
    {
      sectionName: 'Discover Page',
      items: [
        {
          feature: 'People You May Know Cards',
          action: 'Click "Add Friend" on card',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Sends friend request and updates button to "Sent".'
        },
        {
          feature: 'Suggested Communities Cards',
          action: 'Click "Join" or card',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Joins group or opens group details.'
        }
      ]
    },
    {
      sectionName: 'Search Page',
      items: [
        {
          feature: 'Search Input Box',
          action: 'Type query text',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Searches users, communities, events, and jobs across the platform.'
        },
        {
          feature: 'Category Filter Chips (People, Communities, Events, Jobs)',
          action: 'Click category tag',
          hasPopup: 'No Popup',
          popupContent: 'N/A',
          expectedResult: 'Filters search results to show only people, groups, events, or jobs.'
        }
      ]
    }
  ]);

  // Save workbook
  const outputPath = path.join(rootDir, 'Ourlime_Web_Desktop_FRD_QA_Sheet.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ Fully Desktop-Accurate FRD Excel Sheet Successfully Created at:\n📍 ${outputPath}`);
}

const rootDir = path.resolve(__dirname, '..');
buildFRD().catch(err => {
  console.error('❌ Failed to generate FRD Excel:', err);
  process.exit(1);
});
