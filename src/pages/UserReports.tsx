
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

const UserReports = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Placeholder data for demonstration
  const recentWins = [
    { id: 1, date: '2025-04-15', time: '19:30', sessionName: 'Evening Bingo', gameType: 'Mainstage', winType: 'Full House', prize: '£50.00' },
    { id: 2, date: '2025-04-10', time: '15:45', sessionName: 'Afternoon Special', gameType: 'Quiz Bingo', winType: 'Single Line', prize: '£20.00' },
    { id: 3, date: '2025-04-03', time: '20:15', sessionName: 'Thursday Night Bingo', gameType: 'Music Bingo', winType: 'Double Line', prize: '£35.00' },
    { id: 4, date: '2025-03-27', time: '14:00', sessionName: 'Lunchtime Bingo', gameType: 'Party Bingo', winType: 'Four Corners', prize: '£15.00' },
  ];

  const hostedSessions = [
    { id: 1, date: '2025-04-18', name: 'Friday Night Special', players: 42, totalPrizes: '£300.00', revenue: '£420.00' },
    { id: 2, date: '2025-04-11', name: 'Charity Fundraiser', players: 65, totalPrizes: '£500.00', revenue: '£650.00' },
    { id: 3, date: '2025-04-04', name: 'Community Bingo', players: 28, totalPrizes: '£200.00', revenue: '£280.00' },
  ];

  // Check if user is authenticated
  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
    }
  }, [user, isLoading, navigate]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8 text-blue-700">Your Reports</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6 text-center">
            <h3 className="text-lg font-medium text-gray-500 mb-1">Total Games Hosted</h3>
            <p className="text-3xl font-bold text-blue-700">24</p>
          </Card>
          <Card className="p-6 text-center">
            <h3 className="text-lg font-medium text-gray-500 mb-1">Total Revenue</h3>
            <p className="text-3xl font-bold text-green-600">£1,350.00</p>
          </Card>
          <Card className="p-6 text-center">
            <h3 className="text-lg font-medium text-gray-500 mb-1">Total Players</h3>
            <p className="text-3xl font-bold text-blue-700">135</p>
          </Card>
        </div>
        
        {/* Recent Wins */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 text-blue-700">Recent Wins</h2>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Game Type</TableHead>
                  <TableHead>Win Type</TableHead>
                  <TableHead>Prize</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentWins.map((win) => (
                  <TableRow key={win.id}>
                    <TableCell>{win.date}</TableCell>
                    <TableCell>{win.time}</TableCell>
                    <TableCell>{win.sessionName}</TableCell>
                    <TableCell>{win.gameType}</TableCell>
                    <TableCell>{win.winType}</TableCell>
                    <TableCell>{win.prize}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        
        {/* Hosted Sessions */}
        <div>
          <h2 className="text-2xl font-semibold mb-4 text-blue-700">Hosted Sessions</h2>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session Name</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Total Prizes</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hostedSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.date}</TableCell>
                    <TableCell>{session.name}</TableCell>
                    <TableCell>{session.players}</TableCell>
                    <TableCell>{session.totalPrizes}</TableCell>
                    <TableCell>{session.revenue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        
        <div className="mt-8 text-center text-gray-600">
          <p>This report data will be updated as you host more games and participate in sessions.</p>
        </div>
      </div>
    </div>
  );
};

export default UserReports;
