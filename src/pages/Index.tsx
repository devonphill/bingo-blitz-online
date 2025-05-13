
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { logWithTimestamp } from '@/utils/logUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  // Check for existing player code and redirect if needed
  useEffect(() => {
    const storedPlayerCode = localStorage.getItem('playerCode');
    const storedPlayerId = localStorage.getItem('playerId');
    
    if (storedPlayerCode && storedPlayerId) {
      logWithTimestamp(`Found existing player code: ${storedPlayerCode}, redirecting to game`, 'info');
      navigate(`/player/game/${storedPlayerCode}`);
    } else {
      logWithTimestamp('No stored player code found, staying on index page', 'info');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-purple-50 to-indigo-100 p-4 text-center">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header with logo */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 my-8">
          <img 
            src="/lovable-uploads/a62a2374-863f-466e-8812-847aef0be5fa.png" 
            alt="Kiki-D" 
            className="h-28 md:h-36"
          />
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-purple-800 mb-2">
              Bingo Blitz Online
            </h1>
            <p className="text-lg text-gray-600 max-w-md">
              A real-time online bingo platform for hosting and playing various bingo games
            </p>
          </div>
        </div>
        
        {/* Three main feature boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Play Bingo */}
          <Card className="bg-white shadow-md border-t-4 border-t-purple-600 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-purple-700 flex items-center gap-2">
                <span className="bg-purple-600 text-white p-2 rounded-full w-8 h-8 flex items-center justify-center text-sm">1</span>
                Play Bingo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="text-gray-600 mb-6 flex-grow">
                Join exciting bingo games with friends or strangers! Experience 90-Ball, 80-Ball, Quiz, Music, and Logo bingo with real-time gameplay.
              </p>
              <Button 
                className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white text-lg py-6"
                onClick={() => navigate('/player/join')}
              >
                Join as Player
              </Button>
            </CardContent>
          </Card>
          
          {/* Host Bingo */}
          <Card className="bg-white shadow-md border-t-4 border-t-indigo-500 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-indigo-600 flex items-center gap-2">
                <span className="bg-indigo-500 text-white p-2 rounded-full w-8 h-8 flex items-center justify-center text-sm">2</span>
                Host Bingo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="text-gray-600 mb-6 flex-grow">
                Create and manage your own bingo sessions! Customize game types, manage players, and verify winning tickets with our intuitive host tools.
              </p>
              <Button 
                variant="outline" 
                className="w-full border-indigo-500 text-indigo-600 hover:bg-indigo-500 hover:text-white text-lg py-6"
                onClick={() => navigate('/login')}
              >
                Login as Host
              </Button>
            </CardContent>
          </Card>
          
          {/* Find Tickets */}
          <Card className="bg-white shadow-md border-t-4 border-t-blue-500 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-blue-600 flex items-center gap-2">
                <span className="bg-blue-500 text-white p-2 rounded-full w-8 h-8 flex items-center justify-center text-sm">3</span>
                Find Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col h-full">
              <p className="text-gray-600 mb-6 flex-grow">
                Browse and purchase tickets for upcoming bingo games and special events. Get access to premium games, exclusive prizes, and themed nights.
              </p>
              <Button 
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-lg py-6"
                disabled
              >
                Buy Tickets (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Host promotion section */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-10 mb-16 border-l-4 border-l-purple-600">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="md:w-3/5">
              <h2 className="text-3xl font-bold text-purple-700 mb-4">Want to Host Bingo Games?</h2>
              <p className="text-lg text-gray-600 mb-4">
                Are you a streamer, online entertainer, pub, venue, or planning an event? Start hosting bingo games today for free!
              </p>
              <p className="text-gray-600 mb-4">
                Our platform provides all the tools you need to run professional bingo sessions:
              </p>
              <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6 ml-4">
                <li>Multiple game formats including 90-Ball, 80-Ball, Quiz Bingo, and more</li>
                <li>Easy player management and real-time communication</li>
                <li>Automated ticket verification and winner validation</li>
                <li>Customizable branding and game settings</li>
              </ul>
              <Button 
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-lg md:text-xl px-8 py-6"
                onClick={() => navigate('/signup')}
              >
                Join Now
              </Button>
            </div>
            <div className="md:w-2/5 flex items-center justify-center">
              <div className="bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg p-6 w-full max-w-xs aspect-square flex flex-col items-center justify-center">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-4">FREE</div>
                <p className="text-center text-gray-700 mb-4">Start hosting games with no upfront costs</p>
                <div className="text-sm text-center text-gray-500">Premium features available for enhanced experiences</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Learn more section */}
        <div className="w-full max-w-4xl mx-auto mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-purple-700">Learn More</h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/attract-hosts')} className="border border-purple-200 hover:bg-purple-50">
              For Hosts
            </Button>
            <Button variant="ghost" onClick={() => navigate('/about')} className="border border-purple-200 hover:bg-purple-50">
              About Us
            </Button>
            <Button variant="ghost" onClick={() => navigate('/faq-players')} className="border border-purple-200 hover:bg-purple-50">
              Player FAQ
            </Button>
            <Button variant="ghost" onClick={() => navigate('/faq-hosts')} className="border border-purple-200 hover:bg-purple-50">
              Host FAQ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
