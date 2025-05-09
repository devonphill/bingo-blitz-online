
import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const FAQHosts = () => {
  const faqs = [
    {
      question: "How do I create a bingo session?",
      answer: "After logging in, navigate to your dashboard and click on 'Add Session'. You'll be guided through setting up your game session with options for game type, number of games, and other configuration settings."
    },
    {
      question: "How do players join my game?",
      answer: "When you create a session, the system generates a unique 6-digit code. Share this code with your players, who can enter it on the 'Join as Player' section of our homepage."
    },
    {
      question: "What game types can I host?",
      answer: "You can host traditional 90-ball Mainstage Bingo, 80-ball Party Bingo, Quiz Bingo (using questions instead of numbers), Logo Bingo (matching company logos), and Music Bingo (matching song clips)."
    },
    {
      question: "How do I add players to my session?",
      answer: "You can add players manually through the 'Add Players' button in your session management page, or players can join themselves using the session access code."
    },
    {
      question: "Can I customize the winning patterns?",
      answer: "Yes! You can select from predefined winning patterns or create your own custom patterns for each game in your session."
    },
    {
      question: "How do I verify winning claims?",
      answer: "When a player claims a win, you'll receive a notification in your host interface. You can review their card with the marked numbers and verify if their claim is valid. You can then confirm or reject the claim."
    },
    {
      question: "How does the payment system work?",
      answer: "Bingo Blitz Online charges a small fee per player ticket. You can set your own ticket prices for players. The system tracks all sales, and you can view reports on your earnings."
    },
    {
      question: "Can I pause or restart a game?",
      answer: "Yes, you have full control over the game flow. You can pause, resume, or even restart a game if needed."
    },
    {
      question: "How do I handle technical issues during a game?",
      answer: "The system is designed to be robust, but if issues occur, you can access the session management tools to troubleshoot. There's also a support contact available for urgent technical help."
    },
    {
      question: "Can I run multiple sessions simultaneously?",
      answer: "Yes, you can create and manage multiple sessions, though we recommend focusing on one active game at a time for the best experience."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-center text-blue-700 mb-8">Host FAQ</h1>
        <p className="text-xl text-center text-gray-600 mb-12">
          Find answers to common questions about hosting games on Bingo Blitz Online.
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
          <h2 className="text-2xl font-semibold mb-4">Need more assistance?</h2>
          <p className="text-gray-600 mb-6">
            Our support team is ready to help you with any hosting questions or technical issues.
          </p>
          <div className="flex justify-center">
            <a href="mailto:support@bingoblitz.com" className="text-blue-600 hover:underline font-medium">
              Contact Host Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQHosts;
