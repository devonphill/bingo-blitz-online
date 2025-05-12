
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StripeProvider from './StripeProvider';
import StripePaymentForm from './StripePaymentForm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

interface StripeCheckoutProps {
  packageId: string;
  tokens: number;
  amount: number;
  onPaymentSuccess: (tokens: number) => void;
  onPaymentError: (error: Error) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({
  packageId,
  tokens,
  amount,
  onPaymentSuccess,
  onPaymentError
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            amount: tokens,
            tokenPackage: packageId
          }
        });
        
        if (error) {
          throw new Error(error.message || 'Failed to create payment intent');
        }
        
        if (!data.clientSecret || !data.purchaseId) {
          throw new Error('Invalid response from payment service');
        }
        
        setPurchaseId(data.purchaseId);
        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error('Payment intent creation error:', err);
        setError(err.message || 'Failed to initialize payment');
        onPaymentError(new Error(err.message || 'Payment initialization failed'));
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [packageId, tokens, onPaymentError]);
  
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!purchaseId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: {
          paymentIntentId,
          purchaseId
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (data.success) {
        toast.success('Payment successful! Credits added to your account.');
        onPaymentSuccess(data.token_count || tokens);
      } else {
        throw new Error(data.message || 'Payment verification failed');
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      toast.error('Failed to verify payment');
      onPaymentError(err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-gray-600">Initializing payment...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete your purchase</CardTitle>
        <CardDescription>
          Purchasing {tokens} credits for £{amount.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clientSecret ? (
          <StripeProvider clientSecret={clientSecret}>
            <StripePaymentForm 
              amount={amount}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={onPaymentError}
            />
          </StripeProvider>
        ) : (
          <div className="py-4 text-center text-gray-500">
            Unable to initialize payment form
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StripeCheckout;
