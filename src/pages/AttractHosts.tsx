
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, Users, Calendar, Settings } from 'lucide-react';

const AttractHosts = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto p-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-blue-700 mb-4">Host Your Own Bingo Games</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Bingo Blitz Online provides everything you need to run professional bingo games for your community, charity, or business.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="p-6 shadow-md border border-blue-100 hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <Users className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold">Player Management</h3>
            </div>
            <p className="text-gray-600">
              Easily add and manage players to your games. Generate player codes, track participation, and manage tickets.
            </p>
          </Card>

          <Card className="p-6 shadow-md border border-blue-100 hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold">Multiple Game Types</h3>
            </div>
            <p className="text-gray-600">
              Run traditional 90-ball bingo, 80-ball party games, quiz bingo, logo bingo, and more - all from one platform.
            </p>
          </Card>

          <Card className="p-6 shadow-md border border-blue-100 hover:shadow-lg transition-all">
            <div className="flex items-center mb-4">
              <Calendar className="h-8 w-8 text-blue-600 mr-3" />
              <h3 className="text-xl font-semibold">Session Management</h3>
            </div>
            <p className="text-gray-600">
              Create and manage game sessions with customizable settings. Schedule games and track results.
            </p>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-blue-700">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2">Sign Up</h3>
              <p className="text-gray-600">
                Create your host account to get started. Quick and simple registration process.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2">Create a Session</h3>
              <p className="text-gray-600">
                Set up your bingo session with your preferred game types and settings.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2">Invite Players</h3>
              <p className="text-gray-600">
                Share your session code with players or add them manually to join the game.
              </p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-blue-700">Simple Pricing</h2>
          <div className="max-w-lg mx-auto">
            <Card className="p-8 shadow-lg border border-blue-200">
              <h3 className="text-2xl font-bold text-center mb-2">Pay As You Go</h3>
              <p className="text-center text-gray-500 mb-6">No monthly fees, just pay for what you use</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Small fee per player ticket</span>
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Unlimited game sessions</span>
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>All game types included</span>
                </li>
                <li className="flex items-center">
                  <svg className="h-5 w-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Comprehensive reporting</span>
                </li>
              </ul>
              <Button className="w-full">
                <Link to="/signup" className="w-full">Get Started</Link>
              </Button>
            </Card>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4 text-blue-700">Ready to Host Your First Game?</h2>
          <p className="text-xl text-gray-600 mb-6 max-w-2xl mx-auto">
            Join thousands of hosts already using Bingo Blitz Online for their games.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/signup">Sign Up Now</Link>
            </Button>
            <Button variant="outline" size="lg">
              <Link to="/faq-hosts">Learn More</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttractHosts;
