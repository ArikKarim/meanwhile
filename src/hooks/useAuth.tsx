import { useState, useEffect, useContext, createContext } from 'react';

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

// Simple localStorage-based user management
const USERS_KEY = 'meanwhile_users';
const CURRENT_USER_KEY = 'meanwhile_current_user';

interface StoredUser {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
  firstName: string;
  lastName: string;
}

const getStoredUsers = (): StoredUser[] => {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveStoredUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const getCurrentUser = (): User | null => {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const setCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const signUp = async (username: string, password: string, firstName: string, lastName: string) => {
    const users = getStoredUsers();
    
    // Check if username already exists
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { error: 'Username already exists' };
    }

    // Validate inputs
    if (username.length < 3) {
      return { error: 'Username must be at least 3 characters long' };
    }
    
    if (password.length < 4) {
      return { error: 'Password must be at least 4 characters long' };
    }

    // Create new user
    const newUser: StoredUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: username.trim(),
      password: password, // In a real app, hash this!
      firstName: firstName.trim(),
      lastName: lastName.trim()
    };

    users.push(newUser);
    saveStoredUsers(users);

    // Auto sign in the new user
    const userSession: User = {
      id: newUser.id,
      username: newUser.username,
      firstName: newUser.firstName,
      lastName: newUser.lastName
    };
    
    setCurrentUser(userSession);
    setUser(userSession);

    return { error: null };
  };

  const signIn = async (username: string, password: string) => {
    const users = getStoredUsers();
    
    const foundUser = users.find(u => 
      u.username.toLowerCase() === username.toLowerCase() && 
      u.password === password
    );

    if (!foundUser) {
      return { error: 'Invalid username or password' };
    }

    const userSession: User = {
      id: foundUser.id,
      username: foundUser.username,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName
    };
    
    setCurrentUser(userSession);
    setUser(userSession);

    return { error: null };
  };

  const signOut = async () => {
    setCurrentUser(null);
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