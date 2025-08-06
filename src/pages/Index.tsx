import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Calendar, Users } from 'lucide-react';
import GroupManager from '@/components/GroupManager';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import ScheduleForm from '@/components/ScheduleForm';

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [viewMode, setViewMode] = useState<'busy' | 'free'>('busy');
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleScheduleAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Meanwhile</h1>
              <p className="text-sm text-muted-foreground">
                Shared weekly calendars for friends
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <GroupManager 
              onGroupSelect={setSelectedGroupId}
              selectedGroupId={selectedGroupId}
            />
            
            {selectedGroupId && (
              <ScheduleForm 
                groupId={selectedGroupId}
                onScheduleAdded={handleScheduleAdded}
              />
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedGroupId ? (
              <div className="space-y-6">
                {/* View Mode Toggle */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Group Schedule
                  </h2>
                  <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'busy' | 'free')}>
                    <TabsList>
                      <TabsTrigger value="busy">Who's Busy</TabsTrigger>
                      <TabsTrigger value="free">When Are We Free</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Calendar */}
                <div className="bg-card rounded-lg border">
                  <div className="p-4 border-b">
                    <h3 className="font-medium">
                      {viewMode === 'busy' ? 'Everyone\'s Schedule' : 'Free Time Overlap'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {viewMode === 'busy' 
                        ? 'See what everyone has scheduled throughout the week'
                        : 'Green areas show when most people are free'
                      }
                    </p>
                  </div>
                  <div className="p-4">
                    <WeeklyCalendar 
                      key={`${selectedGroupId}-${refreshKey}`}
                      groupId={selectedGroupId} 
                      viewMode={viewMode}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Group Selected</h2>
                <p className="text-muted-foreground">
                  Create or join a group to start sharing schedules with friends
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
