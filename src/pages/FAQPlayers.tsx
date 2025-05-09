
import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQPlayers = () => {
  const faqs = [
    {
      question: "How do I join a bingo game?",
      answer: "To join a game, you'll need a 6-digit code from the host. Go to the 'Join as Player' section on our homepage and enter the code. You'll then be taken to the game lobby."
    },
    {
      question: "Do I need to create an account to play?",
      answer: "No! As a player, you don't need to create an account. You only need the game code provided by your host to join a session."
    },
    {
      question: "How do the different game types work?",
      answer: "Bingo Blitz Online offers several game types. 90 Ball (Mainstage) is the traditional bingo with a full card. 80 Ball (Party) has a different layout with columns of colors. Quiz Bingo uses questions instead of numbers. Logo Bingo uses company logos, and Music Bingo uses song clips."
    },
    {
      question: "How do I know if I've won?",
      answer: "When you complete a winning pattern, click the 'Claim' button that appears. Your claim will be verified by the host, and if valid, you'll be announced as the winner."
    },
    {
      question: "Can I play on my mobile phone?",
      answer: "Yes! Bingo Blitz Online is fully responsive and works on smartphones, tablets, and computers."
    },
    {
      question: "What happens if my internet connection drops?",
      answer: "Don't worry! When you reconnect, the game will automatically sync and update with the current game state, including all called numbers."
    },
    {
      question: "Can I use auto-marking?",
      answer: "Yes, you can toggle auto-marking on or off. When enabled, numbers will automatically be marked on your card as they're called."
    },
    {
      question: "How many tickets can I buy for a game?",
      answer: "The number of tickets available per player is set by the host. You can purchase one or multiple tickets depending on the host's configuration."
    },
    {
      question: "What winning patterns are available?",
      answer: "Common patterns include single line, double line, and full house. The host can also configure custom patterns for each game. The current winning pattern is always displayed during the game."
    },
    {
      question: "What if multiple players claim a win at the same time?",
      answer: "If multiple players claim a win for the same number, the host can verify both claims and award a shared prize if both are valid."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-center text-blue-700 mb-8">Player FAQ</h1>
        <p className="text-xl text-center text-gray-600 mb-12">
          Find answers to common questions about playing Bingo Blitz Online.
        </p>
        
        <Accordion type="single" collapsible className="bg-white rounded-lg shadow-md p-6">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg font-medium text-left">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-gray-600">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold mb-4">Still have questions?</h2>
          <p className="text-gray-600 mb-6">
            If you can't find the answer you're looking for, please contact your game host or reach out to our support team.
          </p>
          <div className="flex justify-center">
            <a href="mailto:support@bingoblitz.com" className="text-blue-600 hover:underline font-medium">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQPlayers;
