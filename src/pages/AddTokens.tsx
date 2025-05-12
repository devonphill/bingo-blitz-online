
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Banknote, Coins, AlertCircle, ArrowLeft, Check, Package } from 'lucide-react';

type TokenPackage = {
  id: string;
  name: string;
  tokens: number;
  price: number;
  popular?: boolean;
};

const tokenPackages: TokenPackage[] = [
  { id: 'small', name: 'Starter Pack', tokens: 100, price: 10 },
  { id: 'medium', name: 'Popular Pack', tokens: 250, price: 20, popular: true },
  { id: 'large', name: 'Pro Pack', tokens: 500, price: 35 }
];

export default function AddTokens() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage>(tokenPackages[1]);
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  
  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('token_count')
          .eq('id', user?.id)
          .single();
        
        if (error) {
          throw error;
        }
        
        setTokenCount(data.token_count || 0);
      } catch (error) {
        console.error('Error fetching token count:', error);
        toast.error('Failed to load your token balance');
      } finally {
        setIsLoadingTokens(false);
      }
    };
    
    if (user?.id) {
      fetchTokens();
    }
  }, [user?.id]);
  
  const handlePurchase = async (pkg: TokenPackage) => {
    if (!user) {
      toast.error('Please sign in to purchase tokens');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          amount: pkg.tokens,
          tokenPackage: pkg.id
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to create checkout session');
      }
      
      if (!data.url) {
        throw new Error('Invalid response from checkout service');
      }
      
      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
      
      // Navigate to a tracking page that will check the payment status
      navigate(`/payment-success?session_id=${data.sessionId}&purchase_id=${data.purchaseId}`);
      
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to add credits to your account
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
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <CardTitle>Add Credits</CardTitle>
          </div>
          <CardDescription>
            Purchase more credits to add players to your sessions
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-700">Current Balance</h3>
            {isLoadingTokens ? (
              <div className="flex items-center space-x-2 mt-2">
                <Spinner size="sm" />
                <span>Loading your balance...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 mt-2">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-lg">{tokenCount || 0} Credits</span>
              </div>
            )}
          </div>
          
          <h3 className="font-semibold text-lg mb-4">Select a Package</h3>
          
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
            {tokenPackages.map((pkg) => (
              <Card 
                key={pkg.id}
                className={`cursor-pointer transition-all ${
                  selectedPackage.id === pkg.id 
                    ? 'ring-2 ring-blue-500' 
                    : 'hover:shadow-md'
                } ${pkg.popular ? 'relative' : ''}`}
                onClick={() => setSelectedPackage(pkg)}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 -right-3 bg-blue-500 text-white text-xs px-3 py-1 rounded-full">
                    Popular
                  </div>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{pkg.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-gray-500" />
                      <span className="font-semibold text-lg">{pkg.tokens} Credits</span>
                    </div>
                    <div className="font-bold text-lg">${pkg.price}.00</div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="w-full">
                    {selectedPackage.id === pkg.id && (
                      <div className="flex items-center text-blue-500 mb-2">
                        <Check className="h-4 w-4 mr-1" />
                        <span className="text-sm">Selected</span>
                      </div>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <div className="mt-8">
            <Button 
              className="w-full md:w-auto" 
              size="lg" 
              onClick={() => handlePurchase(selectedPackage)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  <Banknote className="mr-2 h-4 w-4" />
                  Purchase {selectedPackage.tokens} Credits for ${selectedPackage.price}
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Important Information</p>
                <p className="mt-1">Credits will be added to your account instantly after successful payment. You can use these credits to add players to your bingo sessions.</p>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t pt-6 flex justify-between">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
