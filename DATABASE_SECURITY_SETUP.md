# 🔒 Database Security Setup Guide

This guide explains how to secure your Meanwhile database with proper Row Level Security (RLS) policies.

## 🚨 Current State

Your database currently has **RLS disabled** for anonymous access, which means:
- ❌ Any user can access any other user's data
- ❌ No proper access controls on groups or schedules
- ❌ Potential for data breaches and unauthorized access

## ✅ Secure Setup

The secure RLS setup provides:
- 🔐 **User Isolation**: Users can only access their own data
- 👥 **Group-based Access**: Group data only accessible to group members
- 🛡️ **Admin Controls**: Group creators have administrative privileges
- 🔄 **Real-time Security**: All real-time updates respect security policies

## 📋 Migration Steps

### Step 1: Apply the Secure RLS Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Run the migration file: `supabase/migrations/20250120_secure_rls_setup.sql`

This will:
- ✅ Enable RLS on all tables
- ✅ Create comprehensive security policies
- ✅ Set up custom authentication functions
- ✅ Configure proper permissions

### Step 2: Test the Security

After applying the migration, test these scenarios:

1. **User Registration/Login** - Should work normally
2. **Group Access** - Users should only see groups they're members of
3. **Schedule Visibility** - Users should only see schedules in their groups
4. **Color Management** - Users should only be able to change their own colors

## 🔧 How It Works

### Custom Authentication Integration

The system uses custom session variables to track authenticated users:

```sql
-- Set user context (called automatically on login)
SELECT set_session_user('user-uuid-here');

-- Clear user context (called automatically on logout)  
SELECT clear_session_user();

-- Get current user (used by RLS policies)
SELECT get_current_user_id();
```

### RLS Policy Structure

#### Profiles Table
- ✅ Users can view/edit their own profile
- ✅ Users can view profiles of people in their groups
- ❌ Users cannot view random profiles

#### Groups Table  
- ✅ Users can view groups they're members of
- ✅ Users can create new groups
- ✅ Group creators can edit/delete their groups
- ❌ Users cannot access groups they're not in

#### Group Members Table
- ✅ Users can view members of groups they're in
- ✅ Users can join groups (with valid invite codes)
- ✅ Users can leave groups
- ✅ Group creators can remove members
- ❌ Users cannot see members of other groups

#### Time Blocks Table
- ✅ Users can view schedules in groups they're members of
- ✅ Users can create/edit/delete their own time blocks
- ❌ Users cannot modify other users' schedules
- ❌ Users cannot access schedules in groups they're not in

#### User Group Colors Table  
- ✅ Users can view colors in groups they're members of
- ✅ Users can set/change their own color per group
- ❌ Users cannot change other users' colors
- ❌ Users cannot access color data for groups they're not in

## 🛡️ Security Features

### 1. Authentication Required
All database operations require a valid authenticated user session.

### 2. Group-based Access Control
Users can only access data related to groups they're members of.

### 3. Owner-based Permissions
Users can only modify their own data (profiles, schedules, colors).

### 4. Admin Privileges
Group creators have additional permissions to manage their groups.

### 5. Color Uniqueness Enforcement
The `set_user_color` function ensures unique colors per group with proper authorization.

## 🔍 Verification

After applying the secure setup, verify it's working:

### 1. Check RLS Status
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'groups', 'group_members', 'time_blocks', 'user_group_colors');
```
All should show `rowsecurity = true`.

### 2. Test Policies
```sql
-- Should return only groups for the current user
SELECT * FROM groups;

-- Should return only time blocks in groups the user belongs to  
SELECT * FROM time_blocks;
```

### 3. Verify Functions
```sql
-- Should return the current user's UUID or NULL
SELECT get_current_user_id();

-- Should return true/false for group membership
SELECT is_group_member('group-uuid', 'user-uuid');
```

## 🚨 Important Notes

1. **Backup First**: Always backup your database before applying security changes

2. **Test Thoroughly**: Test all application functionality after enabling RLS

3. **Monitor Performance**: RLS policies add some overhead - monitor query performance

4. **Session Management**: Ensure the application properly sets/clears user sessions

5. **Error Handling**: The app now needs to handle permission-denied errors gracefully

## 🔄 Rollback Plan

If you need to rollback the secure setup:

```sql
-- Disable RLS (NOT RECOMMENDED for production)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY; 
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_colors DISABLE ROW LEVEL SECURITY;

-- Grant broad permissions (INSECURE)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
```

## 📞 Support

If you encounter issues after applying the secure setup:

1. Check browser console for authentication errors
2. Verify user sessions are being set properly
3. Review Supabase logs for RLS policy violations
4. Test with a fresh user account

## ✅ Success Checklist

- [ ] Secure RLS migration applied successfully
- [ ] User registration/login works
- [ ] Group creation/joining works  
- [ ] Schedule management works
- [ ] Color assignment works
- [ ] Users cannot access unauthorized data
- [ ] Real-time updates work with security enabled

Your database is now properly secured! 🎉
