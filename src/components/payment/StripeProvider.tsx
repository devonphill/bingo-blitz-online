
import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with your publishable key
// This key is safe to expose in the browser
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_placeholder' // Replace with your actual test publishable key if not using env variables
);

interface StripeProviderProps {
  children: React.ReactNode;
  clientSecret?: string;
}

export const StripeProvider: React.FC<StripeProviderProps> = ({ 
  children,
  clientSecret
}) => {
  const options = clientSecret
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
