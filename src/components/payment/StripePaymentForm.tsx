
import React, { useState, useEffect } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (error: Error) => void;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({ 
  amount,
  onPaymentSuccess,
  onPaymentError
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isFormComplete, setIsFormComplete] = useState(false);

  useEffect(() => {
    if (!stripe) {
      return;
    }

    // Check for payment status from URL on return from redirect
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) {
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!paymentIntent) return;

      switch (paymentIntent.status) {
        case 'succeeded':
          setMessage('Payment succeeded!');
          onPaymentSuccess(paymentIntent.id);
          break;
        case 'processing':
          setMessage('Your payment is processing.');
          break;
        case 'requires_payment_method':
          setMessage('Your payment was not successful, please try again.');
          break;
        default:
          setMessage('Something went wrong.');
          break;
      }
    });
  }, [stripe, onPaymentSuccess]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'An unexpected error occurred.');
        onPaymentError(new Error(error.message || 'Payment failed'));
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('Payment succeeded!');
        onPaymentSuccess(paymentIntent.id);
      }
    } catch (err) {
      const error = err as Error;
      setMessage(error.message || 'An unexpected error occurred.');
      onPaymentError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentElementChange = (event: { complete: boolean }) => {
    setIsFormComplete(event.complete);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <PaymentElement 
        id="payment-element" 
        options={{ layout: 'tabs' }}
        onChange={handlePaymentElementChange}
      />
      
      {message && (
        <div className={`p-3 rounded-md ${
          message.includes('succeeded') 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.includes('succeeded') 
              ? <CheckCircle className="h-5 w-5 text-green-500" /> 
              : <AlertCircle className="h-5 w-5 text-red-500" />}
            <span>{message}</span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading || !stripe || !elements || !isFormComplete}
          className="w-full md:w-auto"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Processing Payment...
            </>
          ) : (
            <>Pay £{amount.toFixed(2)}</>
          )}
        </Button>
      </div>
    </form>
  );
};

export default StripePaymentForm;
