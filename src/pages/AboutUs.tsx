
import React from 'react';
import { Card } from '@/components/ui/card';

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-center text-blue-700 mb-4">About Bingo Blitz Online</h1>
        <p className="text-xl text-center text-gray-600 mb-12 max-w-3xl mx-auto">
          Modernizing the traditional bingo experience with innovative technology for hosts and players alike.
        </p>

        {/* Our Story */}
        <section className="mb-16">
          <h2 className="text-3xl font-semibold mb-6 text-blue-700">Our Story</h2>
          <Card className="p-8 shadow-md">
            <p className="text-gray-700 mb-4">
              Bingo Blitz Online was created by a team of tech enthusiasts who loved playing bingo but noticed that many venues were still using outdated methods to run their games. We saw an opportunity to bring this beloved game into the digital age.
            </p>
            <p className="text-gray-700 mb-4">
              Founded in 2023, our platform started with a simple goal: make bingo more accessible, engaging, and fun for everyone. What began as a simple digital calling board has evolved into a comprehensive platform that supports multiple game types and brings communities together.
            </p>
            <p className="text-gray-700">
              Today, Bingo Blitz Online is used by hosts around the world to run engaging bingo sessions for their communities, charities, and businesses. Our mission is to continue enhancing the bingo experience through technology while maintaining the social spirit that makes bingo special.
            </p>
          </Card>
        </section>

        {/* What Makes Us Different */}
        <section className="mb-16">
          <h2 className="text-3xl font-semibold mb-6 text-blue-700">What Makes Us Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-blue-600">Variety of Game Types</h3>
              <p className="text-gray-700">
                Beyond traditional bingo, we offer innovative game types like Quiz Bingo, Logo Bingo, and Music Bingo to keep your events fresh and engaging.
              </p>
            </Card>
            <Card className="p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-blue-600">No Downloads Required</h3>
              <p className="text-gray-700">
                Our web-based platform works on any device with a browser. No need for players to download apps or create accounts.
              </p>
            </Card>
            <Card className="p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-blue-600">Robust Hosting Tools</h3>
              <p className="text-gray-700">
                We provide hosts with comprehensive tools for managing players, verifying claims, and running multiple games smoothly.
              </p>
            </Card>
            <Card className="p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3 text-blue-600">Transparent Pricing</h3>
              <p className="text-gray-700">
                Our simple pay-as-you-go model means you only pay for what you use, with no hidden fees or complicated pricing tiers.
              </p>
            </Card>
          </div>
        </section>

        {/* Our Technology */}
        <section className="mb-16">
          <h2 className="text-3xl font-semibold mb-6 text-blue-700">Our Technology</h2>
          <Card className="p-8 shadow-md">
            <p className="text-gray-700 mb-4">
              Bingo Blitz Online is built on modern web technologies to ensure a smooth, responsive experience across all devices. Our platform features:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4 ml-4">
              <li>Real-time game synchronization for all players</li>
              <li>Secure authentication and data protection</li>
              <li>Automatic number calling with adjustable speeds</li>
              <li>Smart claim verification system</li>
              <li>Comprehensive analytics and reporting</li>
              <li>Responsive design that works on any device</li>
            </ul>
            <p className="text-gray-700">
              We're constantly improving our platform based on host and player feedback, adding new features and enhancing existing ones to provide the best possible bingo experience.
            </p>
          </Card>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-3xl font-semibold mb-6 text-blue-700">Our Team</h2>
          <p className="text-center text-gray-700 mb-8">
            Bingo Blitz Online is developed and maintained by a dedicated team of developers, designers, and bingo enthusiasts committed to creating the best digital bingo platform.
          </p>
          <div className="flex justify-center">
            <p className="text-blue-600 text-center">
              Interested in joining our team? <a href="mailto:careers@bingoblitz.com" className="underline">Get in touch!</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutUs;
