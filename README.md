# Meanwhile

**Schedule with friends, effortlessly.**

A beautiful group scheduling app that makes coordinating with friends simple and intuitive. Built with React, TypeScript, and Supabase for real-time collaboration.

![Meanwhile Screenshot](https://img.shields.io/badge/status-active-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- **🎨 Visual Scheduling** - Beautiful color-coded weekly calendars with real-time updates
- **👥 Group Collaboration** - Share simple 6-character codes with friends  
- **⏰ Smart Free Time Detection** - Automatically find when everyone is available
- **🎯 Interactive Calendar** - Create, edit, and manage schedule entries easily
- **🌈 Unique Colors** - Each user gets a unique color per group for easy identification
- **📋 Schedule Copying** - Copy your schedule between different groups
- **⚙️ Customizable Views** - Set calendar hours and week start preferences per group
- **📱 Responsive Design** - Works perfectly on desktop, tablet, and mobile

## 🚀 Quick Start

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd meanwhile
   npm install
   ```

2. **Set up Supabase:**
   - Create a Supabase project
   - Run the migration in `supabase/migrations/20250120_consolidated_schema.sql`
   - Update the Supabase URL and key in `src/integrations/supabase/client.ts`

3. **Start developing:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:5173](http://localhost:5173)**

## 🏗️ Architecture

This application has been thoroughly refactored for maintainability and scalability:

### Frontend Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn/ui components
│   ├── GroupManager.tsx        # Group management interface
│   ├── ScheduleForm.tsx        # Schedule creation form
│   ├── TimeRangeSettings.tsx   # Calendar time configuration
│   ├── UserColorPicker.tsx     # User color selection
│   ├── UserVisibilityFilter.tsx # User visibility controls
│   └── WeeklyCalendar.tsx      # Main calendar component
├── hooks/              # Custom React hooks
├── pages/              # Main application pages
├── services/           # Business logic and API calls
├── types/              # TypeScript type definitions
└── utils/              # Pure utility functions
```

### Key Refactoring Improvements

1. **Separation of Concerns**: Business logic moved to services, utilities extracted to pure functions
2. **Component Composition**: Large components broken down into focused, reusable pieces
3. **Type Safety**: Comprehensive TypeScript types defined throughout
4. **Performance**: Debounced updates, optimistic UI updates, efficient re-renders
5. **Database**: Consolidated migrations, proper constraints, real-time subscriptions

## 💡 How It Works

1. **Create an account** - Custom authentication with username/password
2. **Create or join groups** - Share simple 6-character codes with friends
3. **Add your schedule** - Color-coded time blocks with categories
4. **Real-time collaboration** - See updates instantly across all devices
5. **Find free time together** - Toggle between "Who's Busy" and "Who's Free" views

## 🛠️ Built With

- **React + TypeScript** - Modern, type-safe frontend development
- **Supabase** - Real-time database and authentication
- **Tailwind CSS + Shadcn/ui** - Beautiful, accessible components
- **Vite** - Fast development and build tooling
- **Custom Typography** - Instrument Serif + Geist fonts

## 📊 Database Schema

- **profiles** - User information with custom authentication
- **groups** - Group definitions with invite codes  
- **group_members** - Many-to-many relationship between users and groups
- **time_blocks** - Individual schedule entries
- **user_group_colors** - Group-specific user color assignments

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🚀 Deployment

The application is configured for deployment on Vercel with the included `vercel.json` configuration. Simply connect your repository to Vercel for automatic deployments.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Ensure all linting passes: `npm run lint`
5. Submit a pull request

## 📝 License

MIT © 2025 Arik Karim

---

*Made with ❤️ for better group coordination*