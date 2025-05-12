import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Banknote, Coins, AlertCircle, ArrowLeft, Check, Package, Info } from 'lucide-react';
import StripeCheckout from '@/components/payment/StripeCheckout';

type TokenPackage = {
  id: string;
  name: string;
  tokens: number;
  price: number;
  pricePerToken: string;
  popular?: boolean;
};

const tokenPackages: TokenPackage[] = [
  { id: 'trial', name: 'Trial Pack', tokens: 13, price: 10, pricePerToken: '76p per token' },
  { id: 'starter', name: 'Starter Pack', tokens: 50, price: 36, pricePerToken: '72p per token' },
  { id: 'popular', name: 'Popular Pack', tokens: 100, price: 70, pricePerToken: '70p per token', popular: true },
  { id: 'pro', name: 'Pro Pack', tokens: 500, price: 300, pricePerToken: '60p per token' }
];

export default function AddTokens() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage>(tokenPackages[2]); // Default to popular pack
  const [tokenCount, setTokenCount] = useState<number | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
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
  
  const handleProceedToCheckout = () => {
    setIsCheckoutOpen(true);
  };
  
  const handlePaymentSuccess = (newTokenCount: number) => {
    setTokenCount(newTokenCount);
    setIsCheckoutOpen(false);
    // No redirection needed as payment happens in the page
  };
  
  const handlePaymentError = (error: Error) => {
    console.error('Payment error:', error);
    // Keep the checkout open so user can try again
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
          <div className="mb-6">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">About Credits</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>Credits are used for manually adding players to your bingo sessions. This is useful when:</p>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      <li>You manage your own ticket sales process outside the platform</li>
                      <li>You want to provide free tickets to certain players</li>
                      <li>You need to manage players who cannot purchase their own tickets</li>
                    </ul>
                    <p className="mt-2">Note: Players can also purchase their own tickets directly through the player join page.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
          
          {isCheckoutOpen ? (
            <StripeCheckout
              packageId={selectedPackage.id}
              tokens={selectedPackage.tokens}
              amount={selectedPackage.price}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
          ) : (
            <>
              <h3 className="font-semibold text-lg mb-4">Select a Package</h3>
              
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-2">
                          <Package className="h-4 w-4 text-gray-500" />
                          <span className="font-semibold text-lg">{pkg.tokens} Credits</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="font-bold text-lg">£{pkg.price}.00</div>
                          <div className="text-sm text-gray-500">{pkg.pricePerToken}</div>
                        </div>
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
                  onClick={handleProceedToCheckout}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Continue to Payment
                </Button>
              </div>
              
              <div className="mt-6 bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Important Information</p>
                    <p className="mt-1">Credits will be added to your account instantly after successful payment. You can use these credits to add players to your bingo sessions.</p>
                    <p className="mt-1">All prices include any applicable processing fees. No additional charges will be added during checkout.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
        
        <CardFooter className="border-t pt-6 flex justify-between">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          {isCheckoutOpen && (
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Back to Packages
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
