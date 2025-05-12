
import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { StripeElementsOptions } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
// This key is safe to expose in the browser
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51RMY5bG6JOh394jXEoBXqSqbgOihNjStif61qL4UETVPrfv3UtHqde1SUXMliT1vmbwZ1CzluBFOiIGLBTGlko2r00zY2wWAKY' // Using your provided key
);

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret?: string;
}

export const StripeProvider: React.FC<StripeProviderProps> = ({ 
  children,
  clientSecret
}) => {
  const options: StripeElementsOptions = clientSecret
    ? { 
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#3b82f6', // Match our blue theme
          }
        }
      }
    : {};
  
  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

export default StripeProvider;
