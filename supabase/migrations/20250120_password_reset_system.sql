-- Password Reset System Migration
-- Adds tables and functions for secure password reset functionality

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for password reset tokens
DROP POLICY IF EXISTS "Users can view their own reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Anyone can create reset tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "Users can update their own reset tokens" ON public.password_reset_tokens;

CREATE POLICY "Users can view their own reset tokens"
  ON public.password_reset_tokens FOR SELECT
  USING (user_id = public.get_current_user_id());

CREATE POLICY "Anyone can create reset tokens"
  ON public.password_reset_tokens FOR INSERT
  WITH CHECK (true); -- Anyone can request a password reset

CREATE POLICY "Users can update their own reset tokens"
  ON public.password_reset_tokens FOR UPDATE
  USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- Function to generate secure reset token
CREATE OR REPLACE FUNCTION public.generate_reset_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    i INTEGER;
BEGIN
    token := '';
    FOR i IN 1..32 LOOP
        token := token || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create password reset request
CREATE OR REPLACE FUNCTION public.create_password_reset_request(p_username TEXT)
RETURNS JSON AS $$
DECLARE
    user_record public.profiles%ROWTYPE;
    reset_token TEXT;
    token_id UUID;
    expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Find user by username
    SELECT * INTO user_record 
    FROM public.profiles 
    WHERE username = p_username;
    
    IF NOT FOUND THEN
        -- Don't reveal if user exists or not for security
        RETURN json_build_object(
            'success', true,
            'message', 'If a user with that username exists, a password reset email will be sent.'
        );
    END IF;
    
    -- Generate token and expiration (24 hours from now)
    reset_token := public.generate_reset_token();
    expires_at := NOW() + INTERVAL '24 hours';
    
    -- Invalidate any existing tokens for this user
    UPDATE public.password_reset_tokens 
    SET used_at = NOW() 
    WHERE user_id = user_record.user_id 
    AND used_at IS NULL 
    AND expires_at > NOW();
    
    -- Create new reset token
    INSERT INTO public.password_reset_tokens (user_id, token, expires_at)
    VALUES (user_record.user_id, reset_token, expires_at)
    RETURNING id INTO token_id;
    
    -- Return success with token info (in real app, you'd send email instead)
    RETURN json_build_object(
        'success', true,
        'message', 'Password reset token created successfully.',
        'token', reset_token,
        'expires_at', expires_at,
        'username', user_record.username
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate reset token
CREATE OR REPLACE FUNCTION public.validate_reset_token(p_token TEXT)
RETURNS JSON AS $$
DECLARE
    token_record public.password_reset_tokens%ROWTYPE;
    user_record public.profiles%ROWTYPE;
BEGIN
    -- Find the token
    SELECT * INTO token_record 
    FROM public.password_reset_tokens 
    WHERE token = p_token;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Invalid reset token.'
        );
    END IF;
    
    -- Check if token is expired
    IF token_record.expires_at < NOW() THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Reset token has expired.'
        );
    END IF;
    
    -- Check if token was already used
    IF token_record.used_at IS NOT NULL THEN
        RETURN json_build_object(
            'valid', false,
            'message', 'Reset token has already been used.'
        );
    END IF;
    
    -- Get user info
    SELECT * INTO user_record 
    FROM public.profiles 
    WHERE user_id = token_record.user_id;
    
    RETURN json_build_object(
        'valid', true,
        'user_id', token_record.user_id,
        'username', user_record.username,
        'expires_at', token_record.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset password using token
CREATE OR REPLACE FUNCTION public.reset_password_with_token(
    p_token TEXT,
    p_new_password_hash TEXT
)
RETURNS JSON AS $$
DECLARE
    token_record public.password_reset_tokens%ROWTYPE;
    validation_result JSON;
BEGIN
    -- Validate the token first
    validation_result := public.validate_reset_token(p_token);
    
    IF NOT (validation_result->>'valid')::BOOLEAN THEN
        RETURN validation_result;
    END IF;
    
    -- Get the token record
    SELECT * INTO token_record 
    FROM public.password_reset_tokens 
    WHERE token = p_token;
    
    -- Update the user's password
    UPDATE public.profiles 
    SET password_hash = p_new_password_hash,
        updated_at = NOW()
    WHERE user_id = token_record.user_id;
    
    -- Mark token as used
    UPDATE public.password_reset_tokens 
    SET used_at = NOW(),
        updated_at = NOW()
    WHERE id = token_record.id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Password has been reset successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired tokens (call this periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '7 days'; -- Keep for 7 days after expiry for audit
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for updated_at
CREATE TRIGGER update_password_reset_tokens_updated_at
    BEFORE UPDATE ON public.password_reset_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.password_reset_tokens TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reset_token() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_password_reset_request(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_reset_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password_with_token(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reset_tokens() TO anon, authenticated;

-- Enable realtime for password reset tokens (if needed for admin monitoring)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.password_reset_tokens;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Table already in publication
    END;
END $$;
