
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

// Dummy data for demonstration
const reportData = {
  totalUsers: 156,
  totalSessions: 243,
  totalPlayers: 1842,
  totalTicketsSold: 5926,
  totalRevenue: "£59,260.00",
  currentActiveUsers: 28,
  currentActiveSessions: 5,
  popularGameType: "90-Ball Bingo",
  averagePlayersPerSession: 32,
  averageRevenuePerSession: "£465.00"
};

const monthlyData = [
  { month: 'January', sessions: 28, players: 224, revenue: "£6,720.00" },
  { month: 'February', sessions: 32, players: 256, revenue: "£7,680.00" },
  { month: 'March', sessions: 35, players: 280, revenue: "£8,400.00" },
  { month: 'April', sessions: 42, players: 336, revenue: "£10,080.00" },
  { month: 'May', sessions: 38, players: 304, revenue: "£9,120.00" },
  { month: 'June', sessions: 40, players: 320, revenue: "£9,600.00" },
];

const topHosts = [
  { id: 1, name: "Jane Smith", sessions: 45, totalPlayers: 540, revenue: "£16,200.00" },
  { id: 2, name: "John Doe", sessions: 38, totalPlayers: 456, revenue: "£13,680.00" },
  { id: 3, name: "Sarah Johnson", sessions: 32, totalPlayers: 384, revenue: "£11,520.00" },
  { id: 4, name: "Mike Wilson", sessions: 28, totalPlayers: 336, revenue: "£10,080.00" },
  { id: 5, name: "Laura Taylor", sessions: 24, totalPlayers: 288, revenue: "£8,640.00" },
];

const SuperuserReports = () => {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Check if user is authenticated and is a superuser
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (!isLoading && user && role !== 'superuser') {
      toast({
        title: "Access Denied",
        description: "You need superuser privileges to access this page.",
        variant: "destructive"
      });
      navigate('/dashboard');
    }
  }, [user, isLoading, role, navigate]);

  // Show loading state while checking authentication
  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8 text-blue-700">System Reports</h1>
        
        {/* Key Metrics */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-2xl font-bold text-blue-700">{reportData.totalUsers}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Total Sessions</h3>
              <p className="text-2xl font-bold text-blue-700">{reportData.totalSessions}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Total Players</h3>
              <p className="text-2xl font-bold text-blue-700">{reportData.totalPlayers}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
              <p className="text-2xl font-bold text-green-600">{reportData.totalRevenue}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
              <p className="text-2xl font-bold text-blue-700">{reportData.currentActiveUsers}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Active Sessions</h3>
              <p className="text-2xl font-bold text-blue-700">{reportData.currentActiveSessions}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Popular Game Type</h3>
              <p className="text-lg font-bold text-blue-700">{reportData.popularGameType}</p>
            </Card>
            <Card className="p-4 text-center">
              <h3 className="text-sm font-medium text-gray-500">Avg. Revenue/Session</h3>
              <p className="text-2xl font-bold text-green-600">{reportData.averageRevenuePerSession}</p>
            </Card>
          </div>
        </section>
        
        {/* Monthly Breakdown */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Monthly Breakdown</h2>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Total Players</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((month) => (
                  <TableRow key={month.month}>
                    <TableCell>{month.month}</TableCell>
                    <TableCell>{month.sessions}</TableCell>
                    <TableCell>{month.players}</TableCell>
                    <TableCell>{month.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
        
        {/* Top Performing Hosts */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Top Performing Hosts</h2>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host Name</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Total Players</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topHosts.map((host) => (
                  <TableRow key={host.id}>
                    <TableCell>{host.name}</TableCell>
                    <TableCell>{host.sessions}</TableCell>
                    <TableCell>{host.totalPlayers}</TableCell>
                    <TableCell>{host.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </section>
        
        {/* System Health */}
        <section>
          <h2 className="text-xl font-semibold mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-l-4 border-green-500">
              <h3 className="font-medium">Database Status</h3>
              <div className="flex items-center mt-1">
                <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                <p>Healthy (99.9% uptime)</p>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-green-500">
              <h3 className="font-medium">API Performance</h3>
              <div className="flex items-center mt-1">
                <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                <p>Optimal (120ms avg response)</p>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-green-500">
              <h3 className="font-medium">Storage Usage</h3>
              <div className="flex items-center mt-1">
                <div className="h-3 w-3 rounded-full bg-green-500 mr-2"></div>
                <p>24% utilized</p>
              </div>
            </Card>
          </div>
        </section>
        
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>This report contains simulated data and is for demonstration purposes only.</p>
          <p>In production, this would display real-time data from the database.</p>
        </div>
      </div>
    </div>
  );
};

export default SuperuserReports;
