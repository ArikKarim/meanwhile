# Password Reset System Guide

This guide explains the comprehensive password reset system implemented for the Meanwhile application.

## Overview

The password reset system provides a secure way for users to reset their passwords when they forget them. It includes token-based verification, secure password hashing, and a complete UI workflow.

## Architecture

### Database Components

**Password Reset Tokens Table (`password_reset_tokens`)**
- Stores temporary tokens for password reset requests
- Tokens expire after 24 hours
- Tracks usage to prevent token reuse
- Secured with Row Level Security (RLS)

### Database Functions

1. **`generate_reset_token()`** - Generates secure 32-character random tokens
2. **`create_password_reset_request(p_username TEXT)`** - Creates a reset request for a user
3. **`validate_reset_token(p_token TEXT)`** - Validates a token's authenticity and expiration
4. **`reset_password_with_token(p_token TEXT, p_new_password_hash TEXT)`** - Resets password using valid token
5. **`cleanup_expired_reset_tokens()`** - Removes old expired tokens (for maintenance)

### Frontend Components

1. **`PasswordResetRequest.tsx`** - Initial password reset request form
2. **`PasswordReset.tsx`** - Token validation and new password form
3. **Updated `Auth.tsx`** - Added "Forgot Password?" link

### Security Features

- **Token Expiration**: Tokens automatically expire after 24 hours
- **Single Use**: Tokens can only be used once
- **Secure Hashing**: Passwords are hashed with bcrypt (12 rounds)
- **RLS Protection**: All database operations are secured with Row Level Security
- **Input Validation**: Strong password requirements enforced
- **No Information Disclosure**: System doesn't reveal if username exists

## User Flow

### 1. Request Password Reset
1. User clicks "Forgot your password?" on sign-in page
2. User enters their username
3. System creates a reset token (24-hour expiration)
4. In development, token is displayed; in production, would be sent via email

### 2. Reset Password
1. User clicks the reset link (with token)
2. System validates the token
3. If valid, user enters new password (with confirmation)
4. Password is hashed and updated in database
5. Token is marked as used
6. User is redirected to sign-in page

## Installation & Setup

### 1. Database Migration

Run the password reset migration in your Supabase SQL Editor:

```sql
-- Apply the migration
-- Copy and paste the entire contents of:
-- supabase/migrations/20250120_password_reset_system.sql
```

### 2. Install Dependencies

```bash
npm install bcryptjs @types/bcryptjs
```

### 3. Update Routes

The routes are already configured in `App.tsx`:
- `/reset-password-request` - Request reset form
- `/reset-password?token=...` - Reset password form

## Usage

### For Users

1. **Forgot Password**: Click "Forgot your password?" on the sign-in page
2. **Enter Username**: Provide your username to receive a reset link
3. **Follow Link**: Click the reset link (in development, it's displayed on screen)
4. **Set New Password**: Enter and confirm your new password
5. **Sign In**: Use your new password to sign in

### For Administrators

**Monitor Reset Requests**: Check the `password_reset_tokens` table in Supabase
**Clean Up Tokens**: Run the cleanup function periodically:

```sql
SELECT public.cleanup_expired_reset_tokens();
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number

## Security Considerations

### Token Security
- Tokens are 32 characters long with high entropy
- Tokens expire automatically after 24 hours
- Tokens can only be used once
- Old tokens are invalidated when new ones are created

### Database Security
- Row Level Security prevents unauthorized access
- Functions use `SECURITY DEFINER` for controlled access
- No information leakage about user existence

### Password Security
- bcrypt hashing with 12 salt rounds
- Client-side hashing before transmission
- Strong password requirements enforced

## Development vs Production

### Development Mode
- Reset tokens are displayed on screen for testing
- No email integration required

### Production Mode
To use in production, you would need to:

1. **Integrate Email Service** (SendGrid, Amazon SES, etc.)
2. **Update `create_password_reset_request`** to send emails instead of returning tokens
3. **Remove token display** from the frontend success page
4. **Add rate limiting** for reset requests

## Testing the System

### 1. Create Test User
```sql
INSERT INTO public.profiles (
    user_id,
    username,
    first_name,
    last_name,
    password_hash,
    color
) VALUES (
    gen_random_uuid(),
    'testuser',
    'Test',
    'User',
    '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password123
    '#3B82F6'
);
```

### 2. Test Reset Flow
1. Navigate to `/reset-password-request`
2. Enter username: `testuser`
3. Copy the token from the success page
4. Navigate to `/reset-password?token=YOUR_TOKEN`
5. Set a new password
6. Try signing in with the new password

## Maintenance

### Regular Tasks

**Weekly**: Run token cleanup
```sql
SELECT public.cleanup_expired_reset_tokens();
```

**Monthly**: Review reset request logs and check for abuse patterns

### Monitoring

Monitor the `password_reset_tokens` table for:
- Excessive requests from single users
- Unused tokens (might indicate delivery issues)
- Token usage patterns

## Troubleshooting

### Common Issues

1. **"Invalid reset token"**: Token may be expired, used, or invalid
2. **"User not found"**: For security, same message shown regardless
3. **Password validation errors**: Check password meets requirements
4. **Database connection errors**: Verify Supabase connection and RLS policies

### Debug Steps

1. Check token in database: `SELECT * FROM password_reset_tokens WHERE token = 'your_token';`
2. Verify user exists: `SELECT username FROM profiles WHERE username = 'username';`
3. Check RLS policies are enabled and working
4. Verify bcrypt is working correctly

## Future Enhancements

- Email integration for production use
- Rate limiting for reset requests
- Account lockout after multiple failed attempts  
- Password history to prevent reuse
- Two-factor authentication integration
- Admin dashboard for monitoring reset activity

This password reset system provides a secure, user-friendly way to recover account access while maintaining strong security standards.
