
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, FileText, Users, FileBarChart, HelpCircle, Info } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';

export default function DashboardSidebar() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const adminMenuItems = [
    {
      title: 'Dashboard',
      icon: FileBarChart,
      onClick: () => navigate('/dashboard'),
    },
    {
      title: 'Reports',
      icon: FileText,
      onClick: () => navigate('/reports'),
    },
    {
      title: 'Profile',
      icon: User,
      onClick: () => navigate('/profile'),
    },
  ];

  const superuserMenuItems = [
    {
      title: 'Manage Superusers',
      icon: Users,
      onClick: () => navigate('/superuser/manage'),
    },
    {
      title: 'System Reports',
      icon: FileBarChart,
      onClick: () => navigate('/superuser/reports'),
    }
  ];

  const helpMenuItems = [
    {
      title: 'Host FAQ',
      icon: HelpCircle,
      onClick: () => navigate('/faq-hosts'),
    },
    {
      title: 'Player FAQ',
      icon: HelpCircle,
      onClick: () => navigate('/faq-players'),
    },
    {
      title: 'About Us',
      icon: Info,
      onClick: () => navigate('/about'),
    },
  ];

  return (
    <Sidebar>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback>
              {user?.email?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.email}</span>
            <span className="text-xs text-muted-foreground capitalize">{role || 'User'}</span>
          </div>
        </div>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1">
              {adminMenuItems.map((item) => (
                <div key={item.title}>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-3 w-full justify-start"
                    onClick={item.onClick}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Button>
                </div>
              ))}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        {role === 'superuser' && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav className="space-y-1">
                {superuserMenuItems.map((item) => (
                  <div key={item.title}>
                    <Button 
                      variant="ghost" 
                      className="flex items-center gap-3 w-full justify-start"
                      onClick={item.onClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Button>
                  </div>
                ))}
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Help & Support</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="space-y-1">
              {helpMenuItems.map((item) => (
                <div key={item.title}>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-3 w-full justify-start"
                    onClick={item.onClick}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Button>
                </div>
              ))}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
