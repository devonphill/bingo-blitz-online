
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Coins, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const purchaseId = searchParams.get('purchase_id');
  
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  
  useEffect(() => {
    const verifyPayment = async () => {
      if (!user || !sessionId || !purchaseId) {
        setLoading(false);
        return;
      }
      
      setVerifying(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            sessionId,
            purchaseId
          }
        });
        
        if (error) {
          throw new Error(error.message);
        }
        
        setSuccess(data.success);
        setMessage(data.message);
        
        if (data.success) {
          setTokenCount(data.token_count);
          toast.success('Credits added to your account!');
        } else {
          toast.error(data.message || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        setSuccess(false);
        setMessage('Failed to verify payment: ' + error.message);
        toast.error('Payment verification failed');
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    };
    
    if (user) {
      verifyPayment();
    } else {
      setLoading(false);
    }
  }, [user, sessionId, purchaseId]);
  
  if (loading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-600">Processing your payment...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to view your payment status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!sessionId || !purchaseId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Missing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Payment information is missing. Please try again or contact support.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/add-tokens')}>
              Return to Add Credits
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          {success === true ? (
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Payment Successful!
            </CardTitle>
          ) : success === false ? (
            <CardTitle className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              Payment Not Completed
            </CardTitle>
          ) : (
            <CardTitle>Payment Processing</CardTitle>
          )}
          <CardDescription>
            {message || 'Your payment is being processed'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {success === true && tokenCount !== null && (
            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <div className="flex items-center space-x-2">
                <Coins className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">New Balance</p>
                  <p className="text-lg font-bold">{tokenCount} Credits</p>
                </div>
              </div>
            </div>
          )}
          
          {success === false && (
            <div className="bg-red-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-red-600">
                Your payment was not completed. You can try again or contact support if you believe this is an error.
              </p>
            </div>
          )}
          
          {verifying && (
            <div className="flex items-center justify-center p-4">
              <Spinner size="md" />
              <p className="ml-2">Verifying payment...</p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between space-x-4">
          <Button variant="outline" onClick={() => navigate('/add-tokens')}>
            {success === false ? 'Try Again' : 'Purchase More Credits'}
          </Button>
          
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
