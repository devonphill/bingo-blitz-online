
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function AddTokens() {
  const navigate = useNavigate();
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Add Credits</CardTitle>
          <CardDescription>
            Purchase more credits to add players to your sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-lg mb-2">Credits Package</h3>
              <p className="text-gray-600 mb-4">
                Add 100 credits to your account for $10.00
              </p>
              <Button>Purchase Credits</Button>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
