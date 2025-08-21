# 📝 Collaborative Notepad Feature Guide

## 🎉 Overview

The collaborative notepad feature brings real-time, Google Docs-style editing to Meanwhile groups! Multiple users can simultaneously edit shared notes with live cursor tracking and instant synchronization.

## ✨ Features

### 🔄 Real-time Collaboration
- **Simultaneous editing** - Multiple users can edit the same notepad at once
- **Live synchronization** - Changes appear instantly across all connected users
- **Conflict resolution** - Operational transformation prevents text conflicts
- **Auto-save** - All changes are automatically saved as you type

### 👥 User Presence
- **Active collaborators** - See who else is currently editing
- **User colors** - Each collaborator has a unique color for identification
- **Live cursors** - See where other users are typing in real-time
- **User badges** - Visual indicators showing active participants

### 📋 Document Management
- **Editable titles** - Click the title to rename your notepad
- **Group-based access** - Only group members can access the notepad
- **Persistent storage** - Notes are saved to the database with full history
- **Last updated tracking** - See who made the most recent changes

## 🗄️ Database Schema

### Core Tables

#### `notepads`
- One notepad per group
- Stores title and current content
- Tracks last editor and timestamps

#### `notepad_operations`
- Records all editing operations for conflict resolution
- Implements operational transformation principles
- Maintains sequence numbers for synchronization

#### `notepad_cursors`
- Tracks live cursor positions for each user
- Supports text selections and ranges
- Updates in real-time during editing

#### `notepad_collaborators`
- Manages active editing sessions
- Tracks user presence and last activity
- Stores user display names and colors

## 🔒 Security & Permissions

### Row Level Security (RLS)
All notepad tables are secured with RLS policies:

- **Group membership required** - Only group members can access notepad data
- **User-owned records** - Users can only modify their own cursors/collaborator records
- **Secure functions** - All operations go through validated database functions

### Access Control
- Users must be group members to view/edit notepads
- Real-time subscriptions respect security policies
- Automatic cleanup of inactive collaborators

## 🚀 How to Use

### 1. Access the Notepad
1. Select a group from your groups list
2. Click the **"Notepad"** tab in the main interface
3. The notepad will load automatically (or be created if none exists)

### 2. Start Collaborating
1. **Join collaboration** - Happens automatically when you open the notepad
2. **See active users** - View collaborators in the header
3. **Edit together** - Start typing to see real-time synchronization
4. **Watch cursors** - See where others are editing with colored cursors

### 3. Edit the Title
1. Click on the notepad title in the header
2. Type your new title
3. Press Enter to save or Escape to cancel
4. The title updates for all collaborators

### 4. Leave the Notepad
- Changes are auto-saved continuously
- Close the tab or navigate away to leave
- Your collaborator status automatically becomes inactive

## 🔧 Technical Implementation

### Real-time Synchronization
```typescript
// Operational transformation for conflict-free editing
const operation = {
  type: 'insert',
  position: 42,
  content: 'Hello world!',
  sequence: 123
};

// Apply operation to notepad
await applyNotepadOperation(notepadId, 'insert', 42, 'Hello world!');
```

### Cursor Tracking
```typescript
// Update cursor position for live collaboration
await updateCursorPosition(notepadId, cursorPos, selectionStart, selectionEnd);
```

### Presence Management
```typescript
// Join collaboration session
await joinNotepadCollaboration(notepadId, userName, userColor);

// Leave collaboration session  
await leaveNotepadCollaboration(notepadId);
```

## 📡 Real-time Subscriptions

The notepad subscribes to multiple real-time channels:

1. **Content changes** - Notepad updates from other users
2. **Operations stream** - Individual edit operations
3. **Cursor movements** - Live cursor position updates
4. **Collaborator presence** - Users joining/leaving

## 🎨 UI Components

### Main Component: `CollaborativeNotepad`
- **Props**: `groupId`, `onClose?`
- **Features**: Full collaborative editing interface
- **Real-time**: All changes sync instantly

### Service Layer: `notepadService`
- Database operation helpers
- Real-time subscription management
- Conflict resolution utilities

## 🧪 Testing Collaboration

### Multi-user Testing
1. **Open two browser windows** (or use incognito)
2. **Sign in as different users** in each window
3. **Join the same group** with both users
4. **Open the notepad** in both windows
5. **Start typing** to see real-time collaboration!

### What to Test
- ✅ Simultaneous typing from multiple users
- ✅ Cursor positions update live
- ✅ User presence indicators work
- ✅ Title editing synchronizes
- ✅ Content persists across sessions
- ✅ Leaving/rejoining collaboration

## 🔧 Database Functions

### Core Functions
```sql
-- Create or get notepad for group
SELECT create_group_notepad('group-uuid');

-- Join collaboration session
SELECT join_notepad_collaboration('notepad-uuid', 'John Doe', '#3b82f6');

-- Apply editing operation
SELECT apply_notepad_operation('notepad-uuid', 'insert', 42, 'text');

-- Update cursor position
SELECT update_notepad_cursor('notepad-uuid', 42, null, null);
```

### Maintenance
```sql
-- Clean up inactive collaborators (run periodically)
SELECT cleanup_inactive_collaborators();
```

## 🚀 Setup Instructions

### 1. Apply Database Migration
Run the collaborative notepad migration:
```sql
-- Execute in Supabase SQL Editor
-- File: supabase/migrations/20250120_collaborative_notepad.sql
```

### 2. Verify Installation
Check that all tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'notepad%';
```

Should return:
- `notepads`
- `notepad_operations`
- `notepad_cursors`
- `notepad_collaborators`

### 3. Test Real-time
Verify real-time subscriptions work:
1. Open the app in two browsers
2. Join the same group with different users
3. Open notepad and test simultaneous editing

## 🔍 Troubleshooting

### Common Issues

#### "Failed to load notepad"
- Check user is logged in and group member
- Verify RLS policies are properly configured
- Check browser console for detailed errors

#### "Changes not syncing"
- Verify real-time subscriptions are active
- Check network connectivity
- Ensure proper session management

#### "Cursors not showing"
- Check if collaborators table has active users
- Verify cursor update permissions
- Test with fresh browser sessions

### Debug Queries
```sql
-- Check notepad exists
SELECT * FROM notepads WHERE group_id = 'your-group-id';

-- Check active collaborators
SELECT * FROM notepad_collaborators WHERE is_active = true;

-- Check recent operations
SELECT * FROM notepad_operations ORDER BY sequence_number DESC LIMIT 10;
```

## 🎯 Best Practices

### For Users
1. **Save regularly** - Changes auto-save, but be mindful of others
2. **Communicate** - Use voice/video chat for complex editing sessions
3. **Be courteous** - Avoid overwhelming edits when others are typing
4. **Use titles** - Give your notepads descriptive names

### For Developers
1. **Monitor performance** - Real-time features can be resource-intensive
2. **Handle conflicts gracefully** - Operational transformation helps but test edge cases
3. **Cleanup inactive sessions** - Run cleanup functions periodically
4. **Scale considerations** - Consider limits for very large groups

## 🎉 Success!

Your collaborative notepad is now ready! 🚀

Group members can now:
- ✅ Edit notes together in real-time
- ✅ See each other's cursors and changes
- ✅ Track who's actively editing
- ✅ Rename notepads collaboratively
- ✅ Access notes from any device

Enjoy your new Google Docs-style collaboration in Meanwhile! 📝✨
