import { useState, useEffect, useContext, createContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (username: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase database-based user management
const CURRENT_USER_KEY = 'meanwhile_current_user'; // Keep session in localStorage for now

interface StoredUser {
  id: string;
  user_id: string;
  username: string;
  password_hash: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

// Simple password hashing (in production, use proper bcrypt or similar)
const hashPassword = (password: string): string => {
  // This is a simple hash for demo purposes - use proper hashing in production
  return btoa(password + 'meanwhile_salt');
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

// Helper function to validate UUID format
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const getStoredUsers = async (): Promise<StoredUser[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

const saveStoredUser = async (user: Omit<StoredUser, 'id' | 'created_at'>): Promise<StoredUser | null> => {
  try {
    console.log('💾 Attempting to save user to database:', { username: user.username, user_id: user.user_id });
    
    const { data, error } = await supabase
      .from('profiles')
      .insert([user])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Database insert error:', error);
      throw error;
    }
    
    console.log('✅ User successfully saved to database:', { id: data.id, username: data.username });
    return data;
  } catch (error) {
    console.error('❌ Error saving user to database:', error);
    return null;
  }
};

const getCurrentUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setCurrentUser = async (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    
    // Set user context for RLS - we'll use a custom session variable
    try {
      await supabase.rpc('set_session_user', { user_id: user.id });
    } catch (error) {
      console.warn('Could not set session user:', error);
    }
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
    
    // Clear user context
    try {
      await supabase.rpc('clear_session_user');
    } catch (error) {
      console.warn('Could not clear session user:', error);
    }
  }
};

// Migration function to move localStorage users to database
const migrateLocalStorageUsers = async (): Promise<void> => {
  try {
    const localUsers = localStorage.getItem('meanwhile_users');
    if (!localUsers) return;
    
    const users = JSON.parse(localUsers);
    console.log('Migrating', users.length, 'users from localStorage to database...');
    
    for (const user of users) {
      // Check if user already exists in database
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', user.username)
        .single();
      
      if (!existingUser) {
        // Generate proper UUID for migrated user
        const { data: uuidData, error: uuidError } = await supabase.rpc('generate_user_uuid');
        if (uuidError) {
          console.error('❌ Failed to generate UUID for migration:', uuidError);
          continue;
        }
        
        // Migrate user to database with proper UUID
        await saveStoredUser({
          user_id: uuidData,
          username: user.username,
          password_hash: hashPassword(user.password),
          first_name: user.firstName,
          last_name: user.lastName
        });
        console.log('Migrated user:', user.username, 'with new UUID:', uuidData);
      }
    }
    
    // Optionally clear localStorage after migration
    // localStorage.removeItem('meanwhile_users');
  } catch (error) {
    console.error('Error migrating users:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Check for existing session on app load
      const currentUser = getCurrentUser();
      
      // Check if current user has old string-based ID (needs re-auth)
      if (currentUser && !isValidUUID(currentUser.id)) {
        console.log('🔄 User has old string-based ID, clearing session for re-auth');
        await setCurrentUser(null);
        setUser(null);
      } else {
        setUser(currentUser);
        // Set user context for existing session
        if (currentUser) {
          try {
            await supabase.rpc('set_session_user', { user_id: currentUser.id });
          } catch (error) {
            console.warn('Could not set session user on init:', error);
          }
        }
      }
      
      // Run migration on first load
      await migrateLocalStorageUsers();
      
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const signUp = async (username: string, password: string, firstName: string, lastName: string) => {
    try {
      // Validate inputs
      if (username.length < 3) {
        return { error: 'Username must be at least 3 characters long' };
      }
      
      if (password.length < 4) {
        return { error: 'Password must be at least 4 characters long' };
      }

      // Check if username already exists in database
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

      if (existingUser) {
        return { error: 'Username already exists' };
      }

      // Generate proper UUID for new user
      const { data: uuidData, error: uuidError } = await supabase.rpc('generate_user_uuid');
      if (uuidError) {
        console.error('❌ Failed to generate UUID:', uuidError);
        return { error: 'Failed to create user ID. Please try again.' };
      }
      
      const userId = uuidData;
      console.log('📝 Creating new user:', { userId, username: username.toLowerCase() });
      
      const savedUser = await saveStoredUser({
        user_id: userId,
        username: username.trim().toLowerCase(),
        password_hash: hashPassword(password),
        first_name: firstName.trim(),
        last_name: lastName.trim()
      });

      if (!savedUser) {
        console.error('❌ Failed to save user to database');
        return { error: 'Failed to create user. Please try again.' };
      }

      console.log('✅ User saved to database:', { id: savedUser.id, username: savedUser.username });

      // Auto sign in the new user
      const userSession: User = {
        id: savedUser.user_id,
        username: savedUser.username,
        firstName: savedUser.first_name,
        lastName: savedUser.last_name
      };
      
      await setCurrentUser(userSession);
      setUser(userSession);

      return { error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error: error.message || 'Failed to create account' };
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      console.log('🔑 Attempting login for:', username.toLowerCase());
      
      // Find user in database
      const { data: foundUser, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (error || !foundUser) {
        console.log('❌ User not found in database:', error?.message);
        return { error: 'Invalid username or password' };
      }

      console.log('👤 User found in database:', { id: foundUser.id, username: foundUser.username });

      // Verify password
      if (!foundUser.password_hash || !verifyPassword(password, foundUser.password_hash)) {
        console.log('❌ Password verification failed');
        return { error: 'Invalid username or password' };
      }

      console.log('✅ Login successful for user:', foundUser.username);

      const userSession: User = {
        id: foundUser.user_id,
        username: foundUser.username,
        firstName: foundUser.first_name || '',
        lastName: foundUser.last_name || ''
      };
      
      await setCurrentUser(userSession);
      setUser(userSession);

      return { error: null };
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { error: 'Failed to sign in. Please try again.' };
    }
  };

  const signOut = async () => {
    await setCurrentUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signUp,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};