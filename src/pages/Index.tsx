
import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { logWithTimestamp } from '@/utils/logUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRightCircle, BookOpen, HelpCircle, Info, Users } from 'lucide-react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-indigo-100 text-center">
      <div className="w-full bg-white shadow-md p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/a62a2374-863f-466e-8812-847aef0be5fa.png" 
              alt="Multi-Bingo" 
              className="h-16"
            />
            <h1 className="text-2xl font-bold text-purple-800 hidden sm:block">
              Multi-Bingo Platform
            </h1>
          </div>
          
          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-6 w-[400px] grid-cols-2">
                    <li className="col-span-1">
                      <NavigationMenuLink asChild>
                        <a
                          href="#"
                          onClick={() => navigate('/faq-players')}
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-purple-50 to-purple-100 p-6 no-underline outline-none focus:shadow-md"
                        >
                          <HelpCircle className="h-6 w-6 text-purple-600" />
                          <div className="mb-2 mt-4 text-lg font-medium text-purple-900">
                            Player FAQ
                          </div>
                          <p className="text-sm leading-tight text-purple-800">
                            Find answers to common player questions
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li className="col-span-1">
                      <NavigationMenuLink asChild>
                        <a
                          href="#"
                          onClick={() => navigate('/faq-hosts')}
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-indigo-50 to-indigo-100 p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Users className="h-6 w-6 text-indigo-600" />
                          <div className="mb-2 mt-4 text-lg font-medium text-indigo-900">
                            Host FAQ
                          </div>
                          <p className="text-sm leading-tight text-indigo-800">
                            Learn how to host successful bingo games
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li className="col-span-1">
                      <NavigationMenuLink asChild>
                        <a
                          href="#"
                          onClick={() => navigate('/about')}
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-blue-50 to-blue-100 p-6 no-underline outline-none focus:shadow-md"
                        >
                          <Info className="h-6 w-6 text-blue-600" />
                          <div className="mb-2 mt-4 text-lg font-medium text-blue-900">
                            About Us
                          </div>
                          <p className="text-sm leading-tight text-blue-800">
                            Our story and mission
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li className="col-span-1">
                      <NavigationMenuLink asChild>
                        <a
                          href="#"
                          onClick={() => navigate('/attract-hosts')}
                          className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-pink-50 to-pink-100 p-6 no-underline outline-none focus:shadow-md"
                        >
                          <BookOpen className="h-6 w-6 text-pink-600" />
                          <div className="mb-2 mt-4 text-lg font-medium text-pink-900">
                            For Hosts
                          </div>
                          <p className="text-sm leading-tight text-pink-800">
                            Information for potential hosts
                          </p>
                        </a>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              className="text-purple-800 hover:bg-purple-100"
              onClick={() => navigate('/player/join')}
            >
              Join Game
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => navigate('/login')}
            >
              Host Login
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 my-12">
            <div className="text-center md:text-left max-w-lg">
              <h1 className="text-4xl md:text-5xl font-bold text-purple-800 mb-4">
                Multi-Bingo Platform
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Experience the excitement of real-time multiplayer bingo with multiple game variations, 
                instant win verification, and seamless player management.
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white py-6 px-8 text-lg animate-pulse-subtle"
                  onClick={() => navigate('/player/join')}
                >
                  Play Now <ArrowRightCircle className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-purple-500 text-purple-700 hover:bg-purple-100 py-6 px-8 text-lg"
                  onClick={() => navigate('/signup')}
                >
                  Create Account
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg blur opacity-30 animate-pulse"></div>
              <div className="relative bg-white p-6 rounded-lg shadow-xl">
                <img 
                  src="/lovable-uploads/a62a2374-863f-466e-8812-847aef0be5fa.png" 
                  alt="Multi-Bingo" 
                  className="h-40 md:h-48 mx-auto"
                />
              </div>
            </div>
          </div>
          
          {/* Three main feature boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Play Bingo */}
            <Card className="bg-white shadow-md border-t-4 border-t-purple-600 hover:shadow-xl transition-all transform hover:-translate-y-1 duration-300">
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
            <Card className="bg-white shadow-md border-t-4 border-t-indigo-500 hover:shadow-xl transition-all transform hover:-translate-y-1 duration-300">
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
            <Card className="bg-white shadow-md border-t-4 border-t-blue-500 hover:shadow-xl transition-all transform hover:-translate-y-1 duration-300">
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
          
          {/* Host promotion section with dynamic gradient background */}
          <div className="relative overflow-hidden rounded-lg shadow-lg mb-16">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-600 opacity-90"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjItMS44LTQtNC00cy00IDEuOC00IDQgMS44IDQgNCA0IDQtMS44IDQtNHptMC0xOGMwLTIuMi0xLjgtNC00LTRzLTQgMS44LTQgNCAxLjggNCA0IDQgNC0xLjggNC00em0wIDM2YzAtMi4yLTEuOC00LTQtNHMtNCAxLjgtNCA0IDEuOCA0IDQgNCA0LTEuOCA0LTR6bTE4LTE4YzAtMi4yLTEuOC00LTQtNHMtNCAxLjgtNCA0IDEuOCA0IDQgNCA0LTEuOCA0LTR6bTAtMThjMC0yLjItMS44LTQtNC00cy00IDEuOC00IDQgMS44IDQgNCA0IDQtMS44IDQtNHptMCAzNmMwLTIuMi0xLjgtNC00LTRzLTQgMS44LTQgNCAxLjggNCA0IDQgNC0xLjggNC00em0xOC0xOGMwLTIuMi0xLjgtNC00LTRzLTQgMS44LTQgNCAxLjggNCA0IDQgNC0xLjggNC00em0wLTE4YzAtMi4yLTEuOC00LTQtNHMtNCAxLjgtNCA0IDEuOCA0IDQgNCA0LTEuOCA0LTR6bTAgMzZjMC0yLjItMS44LTQtNC00cy00IDEuOC00IDQgMS44IDQgNCA0IDQtMS44IDQtNHptLTM2LTE4YzAtMi4yLTEuOC00LTQtNHMtNCAxLjgtNCA0IDEuOCA0IDQgNCA0LTEuOCA0LTR6bTAtMThjMC0yLjItMS44LTQtNC00cy00IDEuOC00IDQgMS44IDQgNCA0IDQtMS44IDQtNHptMCAzNmMwLTIuMi0xLjgtNC00LTRzLTQgMS44LTQgNCAxLjggNCA0IDQgNC0xLjggNC00em0tMTgtMThjMC0yLjItMS44LTQtNC00cy00IDEuOC00IDQgMS44IDQgNCA0IDQtMS44IDQtNHptMC0xOGMwLTIuMi0xLjgtNC00LTRzLTQgMS44LTQgNCAxLjggNCA0IDQgNC0xLjggNC00em0wIDM2YzAtMi4yLTEuOC00LTQtNHMtNCAxLjgtNCA0IDEuOCA0IDQgNCA0LTEuOCA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
            
            <div className="relative p-6 md:p-10 text-white">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-3/5">
                  <h2 className="text-3xl font-bold text-white mb-4">Want to Host Bingo Games?</h2>
                  <p className="text-lg text-white/90 mb-4">
                    Are you a streamer, online entertainer, pub, venue, or planning an event? Start hosting bingo games today for free!
                  </p>
                  <p className="text-white/90 mb-4">
                    Our platform provides all the tools you need to run professional bingo sessions:
                  </p>
                  <ul className="list-disc list-inside text-white/90 space-y-2 mb-6 ml-4">
                    <li>Multiple game formats including 90-Ball, 80-Ball, Quiz Bingo, and more</li>
                    <li>Easy player management and real-time communication</li>
                    <li>Automated ticket verification and winner validation</li>
                    <li>Customizable branding and game settings</li>
                  </ul>
                  <Button 
                    className="bg-white hover:bg-gray-100 text-purple-700 text-lg md:text-xl px-8 py-6"
                    onClick={() => navigate('/signup')}
                  >
                    Join Now
                  </Button>
                </div>
                <div className="md:w-2/5 flex items-center justify-center">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 w-full max-w-xs aspect-square flex flex-col items-center justify-center border border-white/20">
                    <div className="text-5xl font-bold text-white mb-4 animate-pulse-subtle">FREE</div>
                    <p className="text-center text-white/90 mb-4">Start hosting games with no upfront costs</p>
                    <div className="text-sm text-center text-white/80">Premium features available for enhanced experiences</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
