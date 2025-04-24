
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, Menu } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardSidebar() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const menuItems = [
    ...(role === 'superuser' ? [
      {
        title: 'Game Rules',
        icon: Settings,
        onClick: () => navigate('/admin'),
      }
    ] : []),
    {
      title: 'Profile',
      icon: User,
      onClick: () => navigate('/profile'),
    },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
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
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton onClick={item.onClick}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
