// Run this in your browser console to clear old session data
// This ensures you start fresh with proper UUID-based authentication

console.log('🧹 Clearing old session data...');

// Clear current user session (will force re-login)
localStorage.removeItem('meanwhile_current_user');

// Clear old localStorage users (optional - keeps as backup)
// localStorage.removeItem('meanwhile_users');

console.log('✅ Old session data cleared!');
console.log('🔄 Please refresh the page and sign in again.');
console.log('   Your new session will use proper UUIDs.');
