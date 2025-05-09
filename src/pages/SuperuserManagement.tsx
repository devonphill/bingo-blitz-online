import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

const SuperuserManagement = () => {
  const { user, isLoading, role } = useAuth();
  const navigate = useNavigate();
  
  const [newSuperuser, setNewSuperuser] = useState({ email: '', password: '', fullName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [superusers, setSuperusers] = useState<any[]>([]);
  const [loadingSuperusers, setLoadingSuperusers] = useState(true);

  // Load superusers on component mount
  React.useEffect(() => {
    if (role === 'superuser') {
      fetchSuperusers();
    }
  }, [role]);

  // Check if user is authenticated and is a superuser
  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (!isLoading && user && role !== 'superuser') {
      toast({
        title: "Access Denied",
        description: "You need superuser privileges to access this page.",
        variant: "destructive"
      });
      navigate('/dashboard');
    }
  }, [user, isLoading, role, navigate]);

  const fetchSuperusers = async () => {
    try {
      setLoadingSuperusers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, created_at')
        .eq('role', 'superuser');
        
      if (error) throw error;
      setSuperusers(data || []);
    } catch (error) {
      console.error('Error fetching superusers:', error);
      toast({
        title: "Error",
        description: "Failed to load superuser list.",
        variant: "destructive"
      });
    } finally {
      setLoadingSuperusers(false);
    }
  };

  const handleAddSuperuser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newSuperuser.email || !newSuperuser.password) {
      toast({
        title: "Validation Error",
        description: "Email and password are required.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Create user with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newSuperuser.email,
        password: newSuperuser.password,
        user_metadata: { full_name: newSuperuser.fullName },
        role: 'superuser',
      });
      
      if (authError) throw authError;
      
      if (authData && authData.user) {
        // 2. Update the profile to set role as superuser
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'superuser' })
          .eq('id', authData.user.id);
          
        if (profileError) throw profileError;
        
        toast({
          title: "Success",
          description: `Superuser ${newSuperuser.email} has been created.`,
        });
        
        // Reset form and refresh list
        setNewSuperuser({ email: '', password: '', fullName: '' });
        fetchSuperusers();
      }
    } catch (error: any) {
      console.error('Error creating superuser:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create superuser.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8 text-blue-700">Superuser Management</h1>
        
        {/* Add Superuser Form */}
        <Card className="p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4">Add New Superuser</h2>
          <form onSubmit={handleAddSuperuser} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                value={newSuperuser.fullName}
                onChange={(e) => setNewSuperuser({...newSuperuser, fullName: e.target.value})}
                placeholder="John Doe"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={newSuperuser.email}
                onChange={(e) => setNewSuperuser({...newSuperuser, email: e.target.value})}
                placeholder="superuser@example.com"
                disabled={isSubmitting}
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={newSuperuser.password}
                onChange={(e) => setNewSuperuser({...newSuperuser, password: e.target.value})}
                placeholder="••••••••"
                disabled={isSubmitting}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto"
            >
              {isSubmitting ? 'Creating...' : 'Add Superuser'}
            </Button>
          </form>
        </Card>
        
        {/* Existing Superusers */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Existing Superusers</h2>
          {loadingSuperusers ? (
            <div className="flex justify-center p-8">
              <Spinner size="md" />
            </div>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {superusers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4">
                        No superusers found. Add one using the form above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    superusers.map((su) => (
                      <TableRow key={su.id}>
                        <TableCell>{su.full_name || 'N/A'}</TableCell>
                        <TableCell>{su.username}</TableCell>
                        <TableCell>{new Date(su.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="bg-yellow-50 border border-yellow-200 p-4 rounded-md inline-block">
            Note: Superusers have full access to all system features and data. 
            Only add trusted individuals as superusers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuperuserManagement;
